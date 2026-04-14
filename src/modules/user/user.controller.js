const userRepository = require('./user.repository');
const { logActivity } = require('../../utils/activityLogger');
const path = require('path');
const fs = require('fs');
const socketService = require('../../sockets/socketService');
const { deleteFile } = require('../../utils/fileHelper');
const { getAbsoluteUrl } = require('../../utils/urlHelper');
const sessionService = require('../session/session.service');

class UserController {
  async submitSupport(req, res, next) {
    try {
      const { name, email, message } = req.body;
      const logEntry = `[${new Date().toISOString()}] Name: ${name}, Email: ${email}\nMessage: ${message}\n-------------------\n`;
      fs.appendFileSync(path.join(__dirname, '../../../bug_reports.log'), logEntry);
      res.status(200).json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      // req.user is attached by the auth middleware
      const userId = req.user.id;
      
      const user = await userRepository.findById(userId);
      
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Security: Strip password and sensitive hashes from returned user data
      const { password, chatLockPassword, ...safeUser } = user;
      
      // Auto-fallback for name if empty
      if (!safeUser.name && safeUser.email) {
        safeUser.name = safeUser.email.split('@')[0];
      }
      
      res.status(200).json({ 
        success: true, 
        message: 'User fetched successfully', 
        data: { 
          ...safeUser, 
          avatar: getAbsoluteUrl(safeUser.avatar),
          hasChatLock: !!chatLockPassword 
        } 
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMe(req, res, next) {
    try {
      const userId = req.user.id;
      const { name, email } = req.body;
      
      // Update the user
      const updatedUser = await userRepository.updateById(userId, {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(req.body.bio !== undefined && { bio: req.body.bio }),
        ...(req.body.isPrivate !== undefined && { isPrivate: req.body.isPrivate }),
      });

      // Log activity
      await logActivity(userId, 'PROFILE_UPDATED', `Updated profile information (${name ? 'Name change' : ''}${name && email ? ', ' : ''}${email ? 'Email change' : ''})`);

      const { password, ...safeUser } = updatedUser;
      res.status(200).json({ success: true, message: 'Profile updated successfully', data: safeUser });
    } catch (error) {
      // Handle unique email constraint
      if (error.code === 'P2002') {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      next(error);
    }
  }

  async getActivities(req, res, next) {
    try {
      const userId = req.user.id;
      const data = await userRepository.findActivities(userId);
      res.status(200).json({ 
        success: true, 
        message: 'Activities fetched successfully', 
        data: (data && data.activities) ? data.activities : [] 
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;
      
      const user = await userRepository.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const bcrypt = require('bcrypt');
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect current password' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await userRepository.updateById(userId, { password: hashedPassword });

      // Security: Invalidate all other sessions on password change
      await sessionService.deleteAllSessionsForUser(userId);

      // Log activity
      await logActivity(userId, 'PASSWORD_CHANGED', 'Successfully changed account password and logged out other devices');

      res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deleteMe(req, res, next) {
    try {
      const userId = req.user.id;
      
      // Cleanup all sessions before deleting user
      await sessionService.deleteAllSessionsForUser(userId);
      
      // Permanently delete user
      await userRepository.deleteById(userId);

      res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updateAvatar(req, res, next) {
    try {
      const userId = req.user.id;
      if (!req.file) {
        console.error('[AvatarUpload] No file provided in request. Check field name (should be "avatar").');
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      console.log(`[AvatarUpload] Received file: ${req.file.originalname}, Size: ${req.file.size}, Path: ${req.file.path}`);
      const avatarPath = req.file.path.replace(/\\/g, '/');
      
      const user = await userRepository.findById(userId);
      if (!user) {
        console.error(`[AvatarUpload] User ${userId} not found in database.`);
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      // Delete old avatar if it exists (handles both Local and Cloudinary)
      if (user.avatar) {
        try {
          await deleteFile(user.avatar);
        } catch (delErr) {
          console.error(`[AvatarUpload] Cleanup error (non-fatal): ${delErr.message}`);
        }
      }

      console.log(`[AvatarUpload] Updating database for user ${userId}...`);
      const updatedUser = await userRepository.updateById(userId, { avatar: avatarPath });
      
      if (!updatedUser) throw new Error('Failed to update user record');

      await logActivity(userId, 'PROFILE_UPDATED', 'Updated profile picture');

      const { password, ...safeUser } = updatedUser;
      safeUser.avatar = getAbsoluteUrl(safeUser.avatar);
      console.log(`[AvatarUpload] Success for user ${userId}`);
      res.status(200).json({ success: true, message: 'Avatar updated successfully', data: safeUser });
    } catch (error) {
      console.error(`[AvatarUpload] CRITICAL ERROR:`, error);
      next(error);
    }
  }

  async deleteAvatar(req, res, next) {
    try {
      const userId = req.user.id;
      const user = await userRepository.findById(userId);
      
      if (user.avatar) {
        await deleteFile(user.avatar);
      }

      const updatedUser = await userRepository.updateById(userId, { avatar: null });
      await logActivity(userId, 'PROFILE_UPDATED', 'Removed profile picture');

      const { password, ...safeUser } = updatedUser;
      res.status(200).json({ success: true, message: 'Avatar removed', data: safeUser });
    } catch (error) {
      next(error);
    }
  }

  async getAllUsers(req, res, next) {
    try {
      const userId = req.user.id;
      const users = await userRepository.findAll();
      
      const filteredUsers = users
        .filter(user => user.id !== userId)
        .map(u => ({
          id: u.id,
          name: u.name || (u.email ? u.email.split('@')[0] : 'Unknown'),
          avatar: getAbsoluteUrl(u.avatar),
          bio: u.bio,
          isPrivate: u.isPrivate
        }));

      res.status(200).json({ success: true, data: filteredUsers });
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req, res, next) {
    try {
      const currentUserId = req.user.id;
      const otherUserId = req.params.userId;
      const messages = await userRepository.findMessagesByUsers(currentUserId, otherUserId);
      
      const safeMessages = messages.map(m => {
        const sanitizedSender = {
          ...m.sender,
          name: m.sender.name || (m.sender.email ? m.sender.email.split('@')[0] : 'Unknown'),
          email: undefined
        };
        
        return {
          ...m,
          sender: sanitizedSender,
          fileUrl: m.fileUrl ? getAbsoluteUrl(m.fileUrl) : null,
          parent: m.parent ? {
            ...m.parent,
            fileUrl: m.parent.fileUrl ? getAbsoluteUrl(m.parent.fileUrl) : null,
            sender: {
              ...m.parent.sender,
              name: m.parent.sender.name || 'User'
            }
          } : null
        };
      });

      res.status(200).json({ success: true, data: safeMessages });
    } catch (error) {
      next(error);
    }
  }

  async markMessagesAsRead(req, res, next) {
    try {
      const currentUserId = req.user.id;
      const senderId = req.params.userId;
      await userRepository.updateMessagesReadStatus(currentUserId, senderId);
      
      // Update real-time unread counts for recipient (current user)
      const io = socketService.getIo();
      io.to(currentUserId.toString()).emit('unread_chats_count_refresh');
      
      // Notify sender that messages were read
      io.to(senderId.toString()).emit('messages_read', { by: currentUserId });

      res.status(200).json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
      next(error);
    }
  }

  async searchUsers(req, res, next) {
    try {
      const { q } = req.query;
      const userId = req.user.id;
      const users = await userRepository.searchUsers(q, userId);
      
      const mappedUsers = users.map(u => {
        const myFollow = u.followers[0];
        const theirFollow = u.following[0];
        
        return {
          id: u.id,
          name: u.name || (u.email ? u.email.split('@')[0] : 'Unknown'),
          avatar: getAbsoluteUrl(u.avatar),
          isFollowing: !!myFollow,
          followStatus: myFollow?.status || 'NONE',
          followsMe: !!theirFollow,
          theirFollowStatus: theirFollow?.status || 'NONE'
        };
      });

      res.status(200).json({ success: true, data: mappedUsers });
    } catch (error) {
      next(error);
    }
  }

  async followUser(req, res, next) {
    try {
      const followerId = req.user.id;
      const followingId = req.params.userId;
      
      if (followerId === followingId) {
        return res.status(400).json({ success: false, message: 'Self-follow not allowed' });
      }

      const targetUser = await userRepository.findById(followingId);
      if (!targetUser) return res.status(404).json({ success: false, message: 'Target user not found' });

      // 1. Check if WE are already being followed by them (PENDING or ACCEPTED)
      const prism = require('../../config/db');
      const inboundFollow = await prism.follow.findUnique({
        where: { followerId_followingId: { followerId: followingId, followingId: followerId } }
      });

      // 2. Determine our NEW status for following them
      let status = targetUser.isPrivate ? 'PENDING' : 'ACCEPTED';
      
      // 3. Follback Logic: If they are already following US, and WE follow them back,
      // we might want to automatically ACCEPT their request if it was PENDING.
      if (inboundFollow && inboundFollow.status === 'PENDING') {
         await userRepository.updateFollowStatus(followingId, followerId, 'ACCEPTED');
         // If we follow them back, and they are public, we should both be ACCEPTED
         // but if they are private, we still start as PENDING for THEM unless we want auto-accept mutuals
         // Let's make it so following back a pending user makes both ACCEPTED for better UX
         status = 'ACCEPTED';
      }

      // 4. Create or Update Follow record (Upsert)
      await prism.follow.upsert({
        where: { followerId_followingId: { followerId, followingId } },
        update: { status },
        create: { followerId, followingId, status }
      });
      
      const follower = await userRepository.findById(followerId);
      const isMutual = inboundFollow && inboundFollow.status === 'ACCEPTED';
      
      // 5. Custom notification based on context
      let notifyType = status === 'PENDING' ? 'CONNECTION_REQUEST' : 'FOLLOW';
      let content = status === 'PENDING' 
        ? `${follower.name || follower.email} wants to connect`
        : (inboundFollow ? `${follower.name || follower.email} followed you back` : `${follower.name || follower.email} started following you`);
      
      const notification = await userRepository.createNotification({
        userId: followingId,
        senderId: followerId,
        type: notifyType,
        content
      });

      const io = socketService.getIo();
      io.to(followingId.toString()).emit('new_notification', {
        id: notification.id,
        type: notifyType,
        content,
        senderId: followerId,
        isMutual: status === 'ACCEPTED',
        createdAt: new Date()
      });

      // 6. Broadcast updates
      io.to(followerId.toString()).emit('connection_update', { targetId: followingId, status });
      io.to(followingId.toString()).emit('connection_update', { targetId: followerId, status: status === 'ACCEPTED' ? 'ACCEPTED' : 'RECEIVED_REQUEST' });

      res.status(200).json({ 
        success: true, 
        message: status === 'PENDING' ? 'Request sent' : 'Connected successfully',
        status 
      });
    } catch (error) {
      next(error);
    }
  }

  async unfollowUser(req, res, next) {
    try {
      const followerId = req.user.id;
      const followingId = req.params.userId;
      await userRepository.unfollow(followerId, followingId);
      
      // Cleanup: Remove the follow notification from the other user's list
      const prisma = require('../../config/db');
      await prisma.notification.deleteMany({
        where: {
          userId: followingId,
          senderId: followerId,
          type: 'FOLLOW'
        }
      });

      res.status(200).json({ success: true, message: 'Unfollowed successfully' });

      // Notify both parties of the disconnection
      const io = socketService.getIo();
      io.to(followerId.toString()).emit('connection_update', { targetId: followingId, status: 'NONE' });
      io.to(followingId.toString()).emit('connection_update', { targetId: followerId, status: 'NONE' });
    } catch (error) {
      next(error);
    }
  }

  async getConnections(req, res, next) {
    try {
      const userId = req.user.id;
      const { includeHidden } = req.query; // If true, ignore hidden filter
      const connections = await userRepository.findConnections(userId);
      
      let filtered = connections;
      if (includeHidden !== 'true') {
        const hiddenIds = await userRepository.getHiddenConversationIds(userId);
        filtered = connections.filter(c => !hiddenIds.includes(c.id));
      }

      const mappedConnections = filtered.map(u => ({
        ...u,
        email: undefined, // Hide email for privacy
        avatar: getAbsoluteUrl(u.avatar),
        name: u.name || (u.email ? u.email.split('@')[0] : 'Unknown')
      }));

      res.status(200).json({ success: true, data: mappedConnections });
    } catch (error) {
      next(error);
    }
  }

  async getNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const notifications = await userRepository.findNotifications(userId);
      res.status(200).json({ success: true, data: notifications });
    } catch (error) {
      next(error);
    }
  }

  async deleteNotification(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      await userRepository.deleteNotification(userId, id);
      res.status(200).json({ success: true, message: 'Notification deleted' });
    } catch (error) {
      next(error);
    }
  }

  async clearNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      await userRepository.clearAllNotifications(userId);
      
      // Update real-time count across all tabs
      const io = socketService.getIo();
      io.to(userId.toString()).emit('unread_count', { count: 0 });

      res.status(200).json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
      next(error);
    }
  }

  async markNotificationsAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      await userRepository.markAllNotificationsAsRead(userId);
      
      // Update real-time count across all tabs
      const io = socketService.getIo();
      io.to(userId.toString()).emit('unread_count', { count: 0 });

      res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  }

  async editChatMessage(req, res, next) {
    try {
      const userId = req.user.id;
      const { messageId, content } = req.body;
      
      if (!messageId || !content) {
        return res.status(400).json({ success: false, message: 'Message ID and content are required' });
      }

      const updated = await userRepository.updateMessage(userId, messageId, content);
      
      // Update real-time for both participants
      const io = socketService.getIo();
      io.to(userId.toString()).emit('message_updated', updated);
      io.to(updated.receiverId.toString()).emit('message_updated', updated);

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  async uploadChatFile(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      
      res.status(200).json({ 
        success: true, 
        data: { 
          url: getAbsoluteUrl(req.file.path),
          name: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype 
        } 
      });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;
      const count = await userRepository.countUnreadMessages(userId);
      res.status(200).json({ success: true, count });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadNotificationCount(req, res, next) {
    try {
      const userId = req.user.id;
      const count = await userRepository.countUnreadNotifications(userId);
      res.status(200).json({ success: true, count });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadConversations(req, res, next) {
    try {
      const userId = req.user.id;
      const data = await userRepository.findUnreadConversations(userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deleteChatMessages(req, res, next) {
    try {
      const userId = req.user.id;
      const { messageIds } = req.body; // Expects an array
      
      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid message IDs' });
      }

      const prisma = require('../../config/db');
      
      // 1. Fetch messages first to find associated files
      const messagesToDelete = await prisma.message.findMany({
        where: { id: { in: messageIds }, senderId: userId }
      });

      // 2. Physical File Deletion (Cloudinary or Local)
      for (const msg of messagesToDelete) {
        if (msg.fileUrl) {
          await deleteFile(msg.fileUrl);
        }
      }

      // 3. Database Deletion
      await userRepository.deleteMessages(userId, messageIds);
      
      const { targetId } = req.body;
      if (targetId) {
        const io = socketService.getIo();
        io.to(targetId.toString()).emit('messages_deleted', { messageIds });
      }

      res.status(200).json({ success: true, message: 'Messages deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async setChatLockPassword(req, res, next) {
    try {
      const userId = req.user.id;
      const { password } = req.body;
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      await userRepository.setChatLockPassword(userId, hashedPassword);
      res.status(200).json({ success: true, message: 'Chat lock password set successfully' });
    } catch (error) {
      next(error);
    }
  }

  async toggleHideConversation(req, res, next) {
    try {
      const userId = req.user.id;
      const { targetId, hide } = req.body;
      if (hide) {
        await userRepository.hideConversation(userId, targetId);
      } else {
        await userRepository.showConversation(userId, targetId);
      }
      res.status(200).json({ success: true, message: hide ? 'Conversation hidden' : 'Conversation revealed' });
    } catch (error) {
      next(error);
    }
  }

  async unlockHiddenChats(req, res, next) {
    try {
      const userId = req.user.id;
      const { password } = req.body;
      const user = await userRepository.findById(userId);
      
      if (!user.chatLockPassword) {
        return res.status(400).json({ success: false, message: 'No chat lock password set' });
      }

      const bcrypt = require('bcrypt');
      const isMatch = await bcrypt.compare(password, user.chatLockPassword);
      if (!isMatch) {
        return res.status(403).json({ success: false, message: 'Invalid lock password' });
      }

      const connections = await userRepository.findConnections(userId);
      const hiddenIds = await userRepository.getHiddenConversationIds(userId);
      const hiddenChats = connections.filter(c => hiddenIds.includes(c.id));

      res.status(200).json({ success: true, data: hiddenChats });
    } catch (error) {
      next(error);
    }
  }

  async resetHiddenChats(req, res, next) {
    try {
      const userId = req.user.id;
      await userRepository.resetHiddenChats(userId);
      res.status(200).json({ success: true, message: 'Hidden chats wiped and password reset' });
    } catch (error) {
      next(error);
    }
  }

  async deleteFullConversation(req, res, next) {
    try {
      const userId = req.user.id;
      const { targetId } = req.params;
      const prisma = require('../../config/db');
      const conversation = await prisma.conversation.findFirst({
        where: { participants: { every: { userId: { in: [userId, targetId] } } } }
      });

      if (conversation) {
        // 1. Fetch ALL messages in this conversation to find files
        const messages = await prisma.message.findMany({
          where: { conversationId: conversation.id }
        });

        // 2. Delete physical files
        for (const msg of messages) {
          if (msg.fileUrl) {
            await deleteFile(msg.fileUrl);
          }
        }

        // 3. Database Cleanup
        await userRepository.deleteFullConversation(userId, targetId);
      }
      
      const io = socketService.getIo();
      io.to(targetId.toString()).emit('messages_deleted', { 
        messageIds: [], // All messages
        everyone: true,
        by: userId
      });
      
      res.status(200).json({ success: true, message: 'Full conversation deleted' });
    } catch (error) {
      next(error);
    }
  }

  async togglePinConversation(req, res, next) {
    try {
      const userId = req.user.id;
      const { targetId } = req.params;
      const prisma = require('../../config/db');
      
      // Find conversation between these users
      const conversation = await prisma.conversation.findFirst({
        where: { participants: { every: { userId: { in: [userId, targetId] } } } }
      });

      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      const participant = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: conversation.id, userId } }
      });

      const updated = await prisma.conversationParticipant.update({
        where: { id: participant.id },
        data: { isPinned: !participant.isPinned }
      });

      res.status(200).json({ success: true, data: { isPinned: updated.isPinned } });
    } catch (error) {
      next(error);
    }
  }

  async deleteNotificationsBySender(req, res, next) {
    try {
      const userId = req.user.id;
      const { senderId } = req.params;
      const prisma = require('../../config/db');
      await prisma.notification.deleteMany({
        where: {
          userId,
          senderId,
          type: 'CHAT'
        }
      });
      res.status(200).json({ success: true, message: 'Notifications cleared' });
    } catch (error) {
      next(error);
    }
  }

  async acceptConnection(req, res, next) {
    try {
      const userId = req.user.id; // The one who is being followed
      const requesterId = req.params.userId; // The one who requested

      await userRepository.updateFollowStatus(requesterId, userId, 'ACCEPTED');
      
      // Notify the requester
      const acceptor = await userRepository.findById(userId);
      const content = `${acceptor.name || acceptor.email} accepted your connection request`;
      
      const notification = await userRepository.createNotification({
        userId: requesterId,
        senderId: userId,
        type: 'CONNECTION_ACCEPTED',
        content
      });

      // Emit real-time notification
      const io = socketService.getIo();
      io.to(requesterId.toString()).emit('new_notification', {
        id: notification.id,
        type: 'CONNECTION_ACCEPTED',
        content,
        senderId: userId,
        createdAt: new Date()
      });

      res.status(200).json({ success: true, message: 'Connection accepted' });

      // Signal both users to refresh their connection status
      io.to(userId.toString()).emit('connection_update', { targetId: requesterId, status: 'ACCEPTED' });
      io.to(requesterId.toString()).emit('connection_update', { targetId: userId, status: 'ACCEPTED' });
    } catch (error) {
      next(error);
    }
  }

  async declineConnection(req, res, next) {
    try {
      const userId = req.user.id;
      const requesterId = req.params.userId;

      await userRepository.unfollow(requesterId, userId);
      
      // Notify the requester
      const decliner = await userRepository.findById(userId);
      const content = `${decliner.name || decliner.email} declined your connection request`;
      
      const notification = await userRepository.createNotification({
        userId: requesterId,
        senderId: userId,
        type: 'CONNECTION_DECLINED',
        content
      });
      
      const io = socketService.getIo();
      io.to(requesterId.toString()).emit('new_notification', {
        id: notification.id,
        type: 'CONNECTION_DECLINED',
        content,
        senderId: userId,
        createdAt: new Date()
      });

      res.status(200).json({ success: true, message: 'Connection declined' });
    } catch (error) {
      next(error);
    }
  }

  async getPendingRequests(req, res, next) {
    try {
      const userId = req.user.id;
      const requests = await userRepository.findPendingRequests(userId);
      res.status(200).json({ success: true, data: requests });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const currentUserId = req.user.id;
      const targetId = req.params.userId;
      
      const user = await userRepository.findById(targetId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      // Check connection status
      const prisma = require('../../config/db');
      const connection = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: targetId
          }
        }
      });

      const isFollowing = connection?.status === 'ACCEPTED';
      const isPending = connection?.status === 'PENDING';

      // Check if THEY follow ME (for Follow Back logic)
      const inbound = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: targetId,
            followingId: currentUserId
          }
        }
      });
      const followsMe = !!inbound;
      const inboundStatus = inbound?.status || 'NONE';

      // Privacy Logic
      // If private and not following, hide sensitive data
      const shouldHide = user.isPrivate && !isFollowing && currentUserId !== targetId;

      const safeProfile = {
        id: user.id,
        name: user.name || user.email.split('@')[0],
        avatar: getAbsoluteUrl(user.avatar),
        bio: shouldHide ? null : user.bio,
        isPrivate: user.isPrivate,
        isFollowing,
        isPending,
        followsMe,
        inboundStatus,
        email: currentUserId === targetId ? user.email : undefined // Hide email for everyone except owner
      };

      res.status(200).json({ success: true, data: safeProfile });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
