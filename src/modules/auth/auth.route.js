const express = require('express');
const passport = require('passport');
const authController = require('./auth.controller');
const { loginLimiter } = require('../../middleware/rateLimit.middleware');

const router = express.Router();

// ─── Standard Auth ────────────────────────────────────────────────────────────
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);

// ─── Forgot / Reset Password ──────────────────────────────────────────────────
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// ─── Google OAuth ─────────────────────────────────────────────────────────────
// Step 1: Redirect user to Google login
router.get('/google', passport.authenticate('google', {
  scope: ['email', 'profile'],
  session: false,
}));

// Step 2: Google redirects here after login
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/google/fail' }),
  authController.googleCallback
);

router.get('/google/fail', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/login?error=google_failed`);
});

module.exports = router;
