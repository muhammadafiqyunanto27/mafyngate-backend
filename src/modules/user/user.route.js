const express = require('express');
const userController = require('./user.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const upload = require('../../middleware/upload.middleware');

const router = express.Router();

// Public Routes
router.post('/support', userController.submitSupport);

// Authenticated Routes
router.get('/me', authMiddleware, userController.getMe);
router.get('/users', authMiddleware, userController.getAllUsers);
router.get('/search', authMiddleware, userController.searchUsers);
router.get('/connections', authMiddleware, userController.getConnections);
router.get('/notifications', authMiddleware, userController.getNotifications);
router.patch('/notifications/read', authMiddleware, userController.markNotificationsAsRead);
router.delete('/notifications/:id', authMiddleware, userController.deleteNotification);
router.delete('/notifications', authMiddleware, userController.clearNotifications);
router.delete('/notifications/sender/:senderId', authMiddleware, userController.deleteNotificationsBySender);
router.post('/follow/:userId', authMiddleware, userController.followUser);
router.delete('/unfollow/:userId', authMiddleware, userController.unfollowUser);
router.get('/chat/messages/:userId', authMiddleware, userController.getMessages);
router.patch('/chat/read/:userId', authMiddleware, userController.markMessagesAsRead);
router.get('/chat/unread-count', authMiddleware, userController.getUnreadCount);
router.get('/chat/unread-conversations', authMiddleware, userController.getUnreadConversations);
router.get('/notifications/unread-count', authMiddleware, userController.getUnreadNotificationCount);
router.delete('/chat/messages', authMiddleware, userController.deleteChatMessages);
router.patch('/chat/message', authMiddleware, userController.editChatMessage);
router.patch('/me', authMiddleware, userController.updateMe);
router.post('/avatar', authMiddleware, upload.single('avatar'), userController.updateAvatar);
router.delete('/avatar', authMiddleware, userController.deleteAvatar);
router.patch('/password', authMiddleware, userController.changePassword);

// Chat Lock & Hide Routes
router.post('/chat/lock-password', authMiddleware, userController.setChatLockPassword);
router.post('/chat/unlock', authMiddleware, userController.unlockHiddenChats);
router.post('/chat/hide', authMiddleware, userController.toggleHideConversation);
router.delete('/chat/lock-reset', authMiddleware, userController.resetHiddenChats);
router.delete('/chat/conversation/:targetId', authMiddleware, userController.deleteFullConversation);

router.get('/activities', authMiddleware, userController.getActivities);
router.delete('/me', authMiddleware, userController.deleteMe);

// Profile & Connection Management
router.get('/profile/:userId', authMiddleware, userController.getProfile);
router.get('/requests/pending', authMiddleware, userController.getPendingRequests);
router.post('/requests/accept/:userId', authMiddleware, userController.acceptConnection);
router.post('/requests/decline/:userId', authMiddleware, userController.declineConnection);

module.exports = router;
