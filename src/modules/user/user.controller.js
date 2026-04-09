const userRepository = require('./user.repository');
const { logActivity } = require('../../utils/activityLogger');
const path = require('path');
const fs = require('fs');
const socketService = require('../../sockets/socketService');

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

      // Security: Strip password from returned user data
      const { password, ...safeUser } = user;
      
      res.status(200).json({ success: true, message: 'User fetched successfully', data: safeUser });
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
      res.status(200).json({ success: true, message: 'Activities fetched successfully', data: data.activities });
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

      // Log activity
      await logActivity(userId, 'PASSWORD_CHANGED', 'Successfully changed account password');

      res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deleteMe(req, res, next) {
    try {
      const userId = req.user.id;
      
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
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const avatarPath = `/uploads/${req.file.filename}`;
      
      const user = await userRepository.findById(userId);
      
      // Delete old avatar if it exists and is not the default
      if (user.avatar && user.avatar.startsWith('/uploads/')) {
        const oldFile = path.join(__dirname, '../../../', user.avatar);
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        }
      }

      const updatedUser = await userRepository.updateById(userId, { avatar: avatarPath });
      
      await logActivity(userId, 'PROFILE_UPDATED', 'Updated profile picture');

      const { password, ...safeUser } = updatedUser;
      res.status(200).json({ success: true, message: 'Avatar updated successfully', data: safeUser });
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
        .map(({ password, ...user }) => user);

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
      res.status(200).json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }

  async markMessagesAsRead(req, res, next) {
    try {
      const currentUserId = req.user.id;
      const senderId = req.params.userId;
      await userRepository.updateMessagesReadStatus(currentUserId, senderId);
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
      
      const mappedUsers = users.map(u => ({
        ...u,
        isFollowing: u.followers.length > 0,
        followsMe: u.following.length > 0
      }));

      res.status(200).json({ success: true, data: mappedUsers });
    } catch (error) {
      next(error);
    }
  }

  async followUser(req, res, next) {
    try {
      const followerId = req.user.id;
      const followingId = req.params.userId;
      await userRepository.follow(followerId, followingId);
      res.status(200).json({ success: true, message: 'Followed successfully' });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({ success: false, message: 'Already following' });
      }
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

      res.status(200).json({ success: true, data: filtered });
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
      res.status(200).json({ success: true, data: updated });
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

      await userRepository.deleteMessages(userId, messageIds);
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
        return res.status(401).json({ success: false, message: 'Invalid lock password' });
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
      await userRepository.deleteFullConversation(userId, targetId);
      res.status(200).json({ success: true, message: 'Full conversation deleted' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
