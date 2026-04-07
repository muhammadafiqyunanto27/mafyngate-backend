const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authRepository = require('./auth.repository');
const sessionService = require('../session/session.service');
const jwtUtil = require('../../utils/jwt.util');
const config = require('../../config/env');
const { logActivity } = require('../../utils/activityLogger');

class AuthService {
  async register(email, password) {
    const existingUser = await authRepository.findUserByEmail(email);
    if (existingUser) {
      throw { statusCode: 400, message: 'User already exists' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await authRepository.createUser({
      email,
      password: hashedPassword,
    });

    // Log activity
    await logActivity(newUser.id, 'REGISTER', 'Account created successfully');

    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    };
  }

  async login(email, password, metadata = {}) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    const tokens = jwtUtil.generateTokens({ id: user.id });
    
    // Store session
    await sessionService.createSession(
      user.id,
      tokens.refreshToken,
      metadata.userAgent,
      metadata.ipAddress
    );

    // Log activity
    await logActivity(user.id, 'LOGIN', 'Successfully logged into the system');
    
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken) {
    if (!refreshToken) {
      throw { statusCode: 400, message: 'Refresh token is required' };
    }
    
    // 1. Check if token exists and is valid in DB
    const session = await sessionService.findSession(refreshToken);
    if (!session) {
      throw { statusCode: 401, message: 'Invalid or expired refresh token session' };
    }

    // 2. Verify JWT signature
    let payload;
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (error) {
      // If expired mathematically via JWT, delete from DB just in case
      await sessionService.deleteSession(refreshToken);
      throw { statusCode: 401, message: 'Invalid or expired refresh token' };
    }

    // 3. Issue new access token
    const newAccessToken = jwt.sign(
      { id: payload.id }, 
      config.jwt.accessSecret, 
      { expiresIn: '15m' }
    );

    return {
      accessToken: newAccessToken
    };
  }

  async logout(refreshToken) {
    if (!refreshToken) {
      throw { statusCode: 400, message: 'Refresh token is required' };
    }
    await sessionService.deleteSession(refreshToken);
  }

  async logoutAll(refreshToken) {
    if (!refreshToken) {
      throw { statusCode: 400, message: 'Refresh token is required' };
    }
    const session = await sessionService.findSession(refreshToken);
    if (!session) {
      throw { statusCode: 401, message: 'Invalid session' };
    }
    await sessionService.deleteAllSessionsForUser(session.user_id);
  }
}

module.exports = new AuthService();
