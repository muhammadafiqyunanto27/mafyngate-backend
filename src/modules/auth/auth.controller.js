const authService = require('./auth.service');

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
        ipAddress: req.ip || req.connection?.remoteAddress
      };

      const result = await authService.login(email, password, metadata);
      
      const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
      const isSecure = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
      
      // Cookie options - Optimized for Cross-Browser & PERSISTENCE on Localhost
      // Note: sameSite 'none' requires 'secure: true'. 
      // Most browsers allow secure: true on localhost even without HTTPS.
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction || isSecure, 
        sameSite: isProduction || isSecure ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      };

      // Special handling for localhost cross-origin dev if necessary
      if (!isProduction && req.headers.origin && req.headers.origin.includes('localhost')) {
         // Some browsers/environments prefer lax for localhost if not using https
         cookieOptions.sameSite = 'lax';
         cookieOptions.secure = false; 
      }

      // Send refresh token as HTTP Only cookie
      res.cookie('refreshToken', result.refreshToken, cookieOptions);
      
      // Do not send refresh token in JSON payload
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
      
      const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
      const isSecure = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
      
      // Clear cookie regardless
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isSecure || isProduction,
        sameSite: (isSecure || isProduction) ? 'none' : 'lax',
        path: '/',
        partitioned: isSecure || isProduction
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
        partitioned: isSecure || isProduction
      });
      res.status(200).json({ success: true, message: 'Logged out from all devices' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
