const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const authRepository = require('./auth.repository');
const sessionService = require('../session/session.service');
const jwtUtil = require('../../utils/jwt.util');
const config = require('../../config/env');
const { logActivity } = require('../../utils/activityLogger');
const { sendPasswordResetEmail } = require('../../utils/mailer');
const prisma = require('../../config/db');

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

    // Google-only accounts don't have a password
    if (!user.password) {
      throw { statusCode: 401, message: 'Akun ini terdaftar via Google. Silakan login dengan Google.' };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    const tokens = jwtUtil.generateTokens({ id: user.id });

    await sessionService.createSession(
      user.id,
      tokens.refreshToken,
      metadata.userAgent,
      metadata.ipAddress
    );

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

  // ─── Google OAuth ─────────────────────────────────────────────────────────
  async loginOrCreateGoogleUser(googleProfile, metadata = {}) {
    const email = googleProfile.emails[0].value;
    const googleId = googleProfile.id;
    const name = googleProfile.displayName;
    const avatar = googleProfile.photos?.[0]?.value || '';

    // Try find by googleId first, then by email
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await authRepository.findUserByEmail(email);
      if (user) {
        // Link Google ID to existing email account
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      } else {
        // Create brand new user via Google
        user = await prisma.user.create({
          data: {
            email,
            googleId,
            name,
            avatar,
            password: null, // Google users have no password initially
          },
        });
        await logActivity(user.id, 'REGISTER', 'Account created via Google OAuth');
      }
    }

    const tokens = jwtUtil.generateTokens({ id: user.id });

    await sessionService.createSession(
      user.id,
      tokens.refreshToken,
      metadata.userAgent,
      metadata.ipAddress
    );

    await logActivity(user.id, 'LOGIN', 'Logged in via Google OAuth');

    return { user, ...tokens };
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────
  async forgotPassword(email) {
    const user = await authRepository.findUserByEmail(email);

    // Always return success to prevent email enumeration attacks
    if (!user) return;

    // Google-only accounts can't reset password via email
    if (!user.password && user.googleId) return;

    // Invalidate all existing tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        token: rawToken,
        userId: user.id,
        expiresAt,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail(user.email, resetUrl);
  }

  // ─── Reset Password ───────────────────────────────────────────────────────
  async resetPassword(token, newPassword) {
    if (!token || !newPassword) {
      throw { statusCode: 400, message: 'Token dan password baru wajib diisi.' };
    }

    if (newPassword.length < 6) {
      throw { statusCode: 400, message: 'Password minimal 6 karakter.' };
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) {
      throw { statusCode: 400, message: 'Link reset tidak valid atau sudah digunakan.' };
    }

    if (record.used) {
      throw { statusCode: 400, message: 'Link reset sudah pernah digunakan.' };
    }

    if (new Date() > new Date(record.expiresAt)) {
      throw { statusCode: 400, message: 'Link reset sudah kadaluarsa. Minta link baru.' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password & mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
      // Invalidate all sessions (security: force re-login on all devices)
      prisma.session.deleteMany({
        where: { user_id: record.userId },
      }),
    ]);

    await logActivity(record.userId, 'RESET_PASSWORD', 'Password reset successfully');
  }

  // ─── Token Refresh ────────────────────────────────────────────────────────
  async refresh(refreshToken) {
    if (!refreshToken) {
      throw { statusCode: 400, message: 'Refresh token is required' };
    }

    const session = await sessionService.findSession(refreshToken);
    if (!session) {
      throw { statusCode: 401, message: 'Invalid or expired refresh token session' };
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (error) {
      await sessionService.deleteSession(refreshToken);
      throw { statusCode: 401, message: 'Invalid or expired refresh token' };
    }

    const newAccessToken = jwt.sign(
      { id: payload.id },
      config.jwt.accessSecret,
      { expiresIn: '15m' }
    );

    return { accessToken: newAccessToken };
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
