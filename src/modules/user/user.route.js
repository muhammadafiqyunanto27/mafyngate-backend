const express = require('express');
const userController = require('./user.controller');
const authMiddleware = require('../../middleware/auth.middleware');

const router = express.Router();

router.get('/me', authMiddleware, userController.getMe);

module.exports = router;
