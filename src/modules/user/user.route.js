const express = require('express');
const userController = require('./user.controller');
const authMiddleware = require('../../middleware/auth.middleware');

const router = express.Router();

router.get('/me', authMiddleware, userController.getMe);
router.patch('/me', authMiddleware, userController.updateMe);
router.patch('/password', authMiddleware, userController.changePassword);
router.get('/activities', authMiddleware, userController.getActivities);
router.delete('/me', authMiddleware, userController.deleteMe);

module.exports = router;
