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
}

module.exports = new UserController();
