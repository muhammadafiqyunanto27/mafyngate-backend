const sessionRepository = require('./session.repository');

class SessionService {
  async createSession(userId, refreshToken, userAgent, ipAddress) {
    // 10 years expiry for refresh token (3650 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3650);

    return await sessionRepository.create({
      user_id: userId,
      refresh_token: refreshToken,
      user_agent: userAgent || '',
      ip_address: ipAddress || '',
      expires_at: expiresAt,
    });
  }

  async findSession(refreshToken) {
    const session = await sessionRepository.findByToken(refreshToken);
    if (!session) return null;
    
    if (new Date() > new Date(session.expires_at)) {
      await this.deleteSession(refreshToken);
      return null;
    }
    
    return session;
  }

  async deleteSession(refreshToken) {
    return await sessionRepository.deleteByToken(refreshToken);
  }

  async deleteAllSessionsForUser(userId) {
    return await sessionRepository.deleteAllForUser(userId);
  }
}

module.exports = new SessionService();
