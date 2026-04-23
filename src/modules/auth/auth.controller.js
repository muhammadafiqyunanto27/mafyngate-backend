const authService = require('./auth.service');
const config = require('../../config/env');

// Cookie options helper
const getCookieOptions = () => ({
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
  partitioned: true,
});

class AuthController {
  async register(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ success: false, message: 'Email and password are required and must be strings' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      }

      const user = await authService.register(email, password);
      res.status(201).json({ success: true, message: 'User registered successfully', data: user });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
      }

      const metadata = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection?.remoteAddress,
      };

      const result = await authService.login(email, password, metadata);

      res.cookie('refreshToken', result.refreshToken, getCookieOptions());

      const { refreshToken, ...responseData } = result;
      res.status(200).json({ success: true, message: 'Login successful', data: responseData });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ success: false, message: 'No refresh token provided' });
      }

      const result = await authService.refresh(refreshToken);
      res.status(200).json({ success: true, message: 'Token refreshed', data: result });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        partitioned: true,
      });
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async logoutAll(req, res, next) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        await authService.logoutAll(refreshToken);
      }

      const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
      const isSecure = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isSecure || isProduction,
        sameSite: (isSecure || isProduction) ? 'none' : 'lax',
        path: '/',
        partitioned: isSecure || isProduction,
      });
      res.status(200).json({ success: true, message: 'Logged out from all devices' });
    } catch (error) {
      next(error);
    }
  }

  // ─── Forgot Password ───────────────────────────────────────────────────────
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ success: false, message: 'Email wajib diisi.' });
      }

      // Always respond with success to prevent email enumeration
      await authService.forgotPassword(email);

      res.status(200).json({
        success: true,
        message: 'Kalau email terdaftar, link reset password sudah dikirim. Cek inbox atau spam kamu.',
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── Reset Password ────────────────────────────────────────────────────────
  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ success: false, message: 'Token dan password wajib diisi.' });
      }

      await authService.resetPassword(token, password);

      res.status(200).json({
        success: true,
        message: 'Password berhasil direset. Silakan login dengan password baru.',
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── Google OAuth Callback ────────────────────────────────────────────────
  async googleCallback(req, res, next) {
    try {
      const googleProfile = req.user; // set by passport
      const metadata = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection?.remoteAddress,
      };

      const result = await authService.loginOrCreateGoogleUser(googleProfile, metadata);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, getCookieOptions());

      // Redirect to frontend with access token in URL (frontend saves to localStorage)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard?token=${result.accessToken}`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/login?error=google_failed`);
    }
  }
}

module.exports = new AuthController();
