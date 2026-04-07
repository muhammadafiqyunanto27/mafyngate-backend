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

  async deleteById(id) {
    return await UserModel.delete({
      where: { id },
    });
  }
}

module.exports = new UserRepository();
