const userRepository = require('./user.repository');
const { logActivity } = require('../../utils/activityLogger');
const path = require('path');
const fs = require('fs');

class UserController {
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
        isFollowing: u.followers.length > 0
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
      res.status(200).json({ success: true, message: 'Unfollowed successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getConnections(req, res, next) {
    try {
      const userId = req.user.id;
      const mutuals = await userRepository.getMutualFollowers(userId);
      res.status(200).json({ success: true, data: mutuals });
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
      res.status(200).json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
      next(error);
    }
  }

  async markNotificationsAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      await userRepository.markAllNotificationsAsRead(userId);
      res.status(200).json({ success: true, message: 'All notifications marked as read' });
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
}

module.exports = new UserController();
