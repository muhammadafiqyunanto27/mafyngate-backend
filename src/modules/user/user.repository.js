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
    
    // Auto-delete activities older than 1 day
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    await prisma.activity.deleteMany({
      where: {
        user_id: userId,
        createdAt: { lt: oneDayAgo }
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
        bio: true,
        isPrivate: true,
        followers: {
          where: { followerId: currentUserId }
        },
        following: {
          where: { followingId: currentUserId }
        }
      }
    });
  }

  async follow(followerId, followingId, status = 'ACCEPTED') {
    const prisma = require('../../config/db');
    return await prisma.follow.create({
      data: { followerId, followingId, status }
    });
  }

  async updateFollowStatus(followerId, followingId, status) {
    const prisma = require('../../config/db');
    return await prisma.follow.update({
      where: {
        followerId_followingId: { followerId, followingId }
      },
      data: { status }
    });
  }

  async findPendingRequests(userId) {
    const prisma = require('../../config/db');
    const requests = await prisma.follow.findMany({
      where: {
        followingId: userId,
        status: 'PENDING'
      },
      include: {
        follower: {
          select: { id: true, name: true, email: true, avatar: true, bio: true }
        }
      }
    });

    // Filter out requests where the follower might have been deleted but the record remains
    return requests.filter(r => r.follower);
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
    
    // 1. Get all friends (ACCEPTED)
    const follows = await prisma.follow.findMany({
      where: {
        OR: [
          { followerId: userId, status: 'ACCEPTED' },
          { followingId: userId, status: 'ACCEPTED' },
        ],
      },
      include: {
        follower: true,
        following: true,
      },
    });

    // 2. Get all users with message history
    const messagedUsers = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      select: {
        senderId: true,
        receiverId: true,
        sender: true,
        receiver: true
      },
      distinct: ['senderId', 'receiverId']
    });

    // Map to unique other users
    const userMap = new Map();
    
    // Add from follows
    follows.forEach(conn => {
      const otherUser = conn.followerId === userId ? conn.following : conn.follower;
      if (otherUser && otherUser.id !== userId) {
        // We only care about the alias WE set for THEM (where we are the follower)
        const existing = userMap.get(otherUser.id) || otherUser;
        const contactAlias = (conn.followerId === userId) ? conn.alias : (existing.contactAlias || null);
        
        userMap.set(otherUser.id, { 
          ...existing, 
          contactAlias 
        });
      }
    });

    // Add from message history
    messagedUsers.forEach(msg => {
      const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
      if (otherUser && otherUser.id !== userId) {
        if (!userMap.has(otherUser.id)) {
          userMap.set(otherUser.id, { ...otherUser, contactAlias: null });
        }
      }
    });

    const users = Array.from(userMap.values()).map(({ password, ...u }) => u);
    const userIds = users.map(u => u.id);

    // 3. Bulk fetch data (unread counts and pinned status) to avoid N+1
    const [unreadCounts, participants] = await Promise.all([
      prisma.message.groupBy({
        by: ['senderId'],
        where: {
          receiverId: userId,
          senderId: { in: userIds },
          isRead: false
        },
        _count: { _all: true }
      }),
      prisma.conversationParticipant.findMany({
        where: {
          userId: userId,
          conversation: { participants: { some: { userId: { in: userIds } } } }
        },
        select: {
          isPinned: true,
          conversation: {
            select: {
              participants: {
                where: { userId: { in: userIds } },
                select: { userId: true }
              }
            }
          }
        }
      })
    ]);

    const unreadMap = new Map(unreadCounts.map(item => [item.senderId, item._count._all]));
    const pinnedMap = new Map();
    participants.forEach(p => {
       const otherParticipant = p.conversation.participants.find(part => part.userId !== userId);
       if (otherParticipant) {
         pinnedMap.set(otherParticipant.userId, p.isPinned);
       }
    });

    // 4. Enrich users with last message (1 query per user is okay vs 3)
    const enrichedUsers = await Promise.all(users.map(async (u) => {
      const lastMsg = await prisma.message.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: u.id },
            { senderId: u.id, receiverId: userId }
          ]
        },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true }
      });

      return {
        ...u,
        unreadCount: unreadMap.get(u.id) || 0,
        isPinned: pinnedMap.get(u.id) || false,
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          createdAt: lastMsg.createdAt
        } : null
      };
    }));

    // Sort: Pinned first, then by last message time
    return enrichedUsers.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
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
      
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: n.senderId
          }
        },
        select: { alias: true }
      });
      
      return {
        ...n,
        isFollowingSender: !!follow,
        senderAlias: follow?.alias || null
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

  async findMessagesByUsers(user1, user2) {
    const prisma = require('../../config/db');
    return await prisma.message.findMany({
      where: {
        conversation: { participants: { every: { userId: { in: [user1, user2] } } } }
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, email: true } },
        parent: {
          include: {
            sender: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
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

    return unreadMessages
      .map(m => m.sender)
      .filter(sender => sender !== null);
  }

  async setChatLockPassword(userId, hashedPassword) {
    return await UserModel.update({
      where: { id: userId },
      data: { chatLockPassword: hashedPassword }
    });
  }

  async hideConversation(userId, targetId) {
    const prisma = require('../../config/db');
    return await prisma.hiddenConversation.upsert({
      where: {
        userId_targetId: { userId, targetId }
      },
      create: { userId, targetId },
      update: {} // No change needed if already exists
    });
  }

  async showConversation(userId, targetId) {
    const prisma = require('../../config/db');
    return await prisma.hiddenConversation.deleteMany({
      where: { userId, targetId }
    });
  }

  async getHiddenConversationIds(userId) {
    const prisma = require('../../config/db');
    const hidden = await prisma.hiddenConversation.findMany({
      where: { userId },
      select: { targetId: true }
    });
    return hidden.map(h => h.targetId);
  }

  async deleteFullConversation(user1Id, user2Id) {
    const prisma = require('../../config/db');
    return await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: user1Id, receiverId: user2Id },
          { senderId: user2Id, receiverId: user1Id }
        ]
      }
    });
  }

  async resetHiddenChats(userId) {
    const prisma = require('../../config/db');
    const hidden = await this.getHiddenConversationIds(userId);
    
    // Delete all messages with those users
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: { in: hidden } },
          { receiverId: userId, senderId: { in: hidden } }
        ]
      }
    });

    // Clear hidden conversation list and password
    await prisma.hiddenConversation.deleteMany({ where: { userId } });
    await UserModel.update({
      where: { id: userId },
      data: { chatLockPassword: null }
    });
  }

  async updateFollowAlias(followerId, followingId, alias) {
    const prisma = require('../../config/db');
    return await prisma.follow.update({
      where: {
        followerId_followingId: { followerId, followingId }
      },
      data: { alias }
    });
  }
}

module.exports = new UserRepository();
