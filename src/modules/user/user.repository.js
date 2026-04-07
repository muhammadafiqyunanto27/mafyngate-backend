const UserModel = require('./user.model');

class UserRepository {
  async create(userData) {
    return await UserModel.create({
      data: userData,
    });
  }

  async findByEmail(email) {
    return await UserModel.findUnique({
      where: { email },
    });
  }

  async findById(id) {
    return await UserModel.findUnique({
      where: { id },
    });
  }

  async updateById(id, data) {
    return await UserModel.update({
      where: { id },
      data,
    });
  }

  async findActivities(userId) {
    const prisma = require('../../config/db');
    
    // Auto-delete activities older than 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    await prisma.activity.deleteMany({
      where: {
        user_id: userId,
        createdAt: { lt: oneWeekAgo }
      }
    });

    return await UserModel.findUnique({
      where: { id: userId },
      select: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Fetch more for 'Show More' functionality on frontend
        },
      },
    });
  }

  async findAll() {
    return await UserModel.findMany();
  }

  async findMessagesByUsers(user1Id, user2Id) {
    const prisma = require('../../config/db');
    return await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user1Id, receiverId: user2Id },
          { senderId: user2Id, receiverId: user1Id },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async updateMessagesReadStatus(receiverId, senderId) {
    const prisma = require('../../config/db');
    return await prisma.message.updateMany({
      where: {
        receiverId,
        senderId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }

  async searchUsers(query, currentUserId) {
    const prisma = require('../../config/db');
    return await UserModel.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
          { id: { not: currentUserId } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        followers: {
          where: { followerId: currentUserId }
        }
      }
    });
  }

  async follow(followerId, followingId) {
    const prisma = require('../../config/db');
    return await prisma.follow.create({
      data: { followerId, followingId }
    });
  }

  async unfollow(followerId, followingId) {
    const prisma = require('../../config/db');
    return await prisma.follow.delete({
      where: {
        followerId_followingId: { followerId, followingId }
      }
    });
  }

  async getMutualFollowers(userId) {
    const prisma = require('../../config/db');
    // Users followed by userId who ALSO follow userId back
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true }
    });
    
    const followingIds = following.map(f => f.followingId);

    return await UserModel.findMany({
      where: {
        id: { in: followingIds },
        following: {
          some: { followingId: userId }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true
      }
    });
  }

  async createNotification(data) {
    const prisma = require('../../config/db');
    return await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        content: data.content,
        senderId: data.senderId
      }
    });
  }

  async findNotifications(userId) {
    const prisma = require('../../config/db');
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteNotification(userId, id) {
    const prisma = require('../../config/db');
    return await prisma.notification.delete({
      where: { id, userId }
    });
  }

  async clearAllNotifications(userId) {
    const prisma = require('../../config/db');
    return await prisma.notification.deleteMany({
      where: { userId }
    });
  }

  async deleteById(id) {
    return await UserModel.delete({
      where: { id },
    });
  }
}

module.exports = new UserRepository();
