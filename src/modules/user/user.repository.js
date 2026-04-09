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
        },
        following: {
          where: { followingId: currentUserId }
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
    // Using deleteMany instead of delete to avoid "Record to delete not found" error
    return await prisma.follow.deleteMany({
      where: {
        followerId,
        followingId
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

  async findConnections(userId) {
    const prisma = require('../../config/db');
    // Get all follows where current user is involved
    const connections = await prisma.follow.findMany({
      where: {
        OR: [
          { followerId: userId },
          { followingId: userId },
        ],
      },
      include: {
        follower: true,
        following: true,
      },
    });

    // Map to unique other users
    const userMap = new Map();
    connections.forEach(conn => {
      const otherUser = conn.followerId === userId ? conn.following : conn.follower;
      if (otherUser.id !== userId) {
        userMap.set(otherUser.id, otherUser);
      }
    });

    const users = Array.from(userMap.values());

    // Enrich with last message info
    const enrichedUsers = await Promise.all(users.map(async (u) => {
      const lastMsg = await prisma.message.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: u.id },
            { senderId: u.id, receiverId: userId }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      return {
        ...u,
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          createdAt: lastMsg.createdAt
        } : null
      };
    }));

    // Sort by last message time (descending)
    return enrichedUsers.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
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
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    // Check if the current user is following each sender
    const mapped = await Promise.all(notifications.map(async (n) => {
      if (!n.senderId) return { ...n, isFollowingSender: false };
      
      const isFollowing = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: n.senderId
          }
        }
      });
      
      return {
        ...n,
        isFollowingSender: !!isFollowing
      };
    }));

    return mapped;
  }

  async deleteNotification(userId, id) {
    const prisma = require('../../config/db');
    return await prisma.notification.delete({
      where: { id, userId }
    });
  }

  async markAllNotificationsAsRead(userId) {
    const prisma = require('../../config/db');
    return await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  }

  async clearAllNotifications(userId) {
    const prisma = require('../../config/db');
    return await prisma.notification.deleteMany({
      where: { userId }
    });
  }

  async updateMessage(userId, messageId, content) {
    const prisma = require('../../config/db');
    return await prisma.message.update({
      where: { id: messageId, senderId: userId },
      data: { 
        content,
        isEdited: true 
      },
      include: {
        sender: {
          select: { id: true, name: true, avatar: true, email: true }
        }
      }
    });
  }

  async deleteMessages(userId, messageIds) {
    const prisma = require('../../config/db');
    // Only allow deleting messages sent by this user
    return await prisma.message.deleteMany({
      where: {
        id: { in: messageIds },
        senderId: userId
      }
    });
  }

  async deleteById(id) {
    return await UserModel.delete({
      where: { id },
    });
  }
  
  async countUnreadMessages(userId) {
    const prisma = require('../../config/db');
    return await prisma.message.count({
      where: {
        receiverId: userId,
        isRead: false
      }
    });
  }

  async countUnreadNotifications(userId) {
    const prisma = require('../../config/db');
    return await prisma.notification.count({
      where: {
        userId: userId,
        isRead: false
      }
    });
  }

  async findUnreadConversations(userId) {
    const prisma = require('../../config/db');
    const unreadMessages = await prisma.message.findMany({
      where: {
        receiverId: userId,
        isRead: false
      },
      distinct: ['senderId'],
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return unreadMessages.map(m => m.sender);
  }
}

module.exports = new UserRepository();
