const express = require('express');
const authController = require('./auth.controller');
const { loginLimiter } = require('../../middleware/rateLimit.middleware');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);

module.exports = router;
