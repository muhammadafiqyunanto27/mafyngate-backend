const SessionModel = require('./session.model');

class SessionRepository {
  async create(data) {
    return await SessionModel.create({ data });
  }

  async findByToken(refreshToken) {
    return await SessionModel.findFirst({
      where: { refresh_token: refreshToken },
    });
  }

  async deleteByToken(refreshToken) {
    return await SessionModel.deleteMany({
      where: { refresh_token: refreshToken },
    });
  }

  async deleteAllForUser(userId) {
    return await SessionModel.deleteMany({
      where: { user_id: userId },
    });
  }
}

module.exports = new SessionRepository();
