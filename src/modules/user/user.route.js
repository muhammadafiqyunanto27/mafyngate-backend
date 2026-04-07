const express = require('express');
const userController = require('./user.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const upload = require('../../middleware/upload.middleware');

const router = express.Router();

router.get('/me', authMiddleware, userController.getMe);
router.get('/users', authMiddleware, userController.getAllUsers);
router.get('/chat/messages/:userId', authMiddleware, userController.getMessages);
router.patch('/chat/read/:userId', authMiddleware, userController.markMessagesAsRead);
router.patch('/me', authMiddleware, userController.updateMe);
router.patch('/avatar', authMiddleware, upload.single('avatar'), userController.updateAvatar);
router.patch('/password', authMiddleware, userController.changePassword);
router.patch('/password', authMiddleware, userController.changePassword);
router.get('/activities', authMiddleware, userController.getActivities);
router.delete('/me', authMiddleware, userController.deleteMe);

module.exports = router;
