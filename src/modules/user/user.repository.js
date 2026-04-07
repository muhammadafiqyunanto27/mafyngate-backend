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
    return await UserModel.findUnique({
      where: { id: userId },
      select: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }
}

module.exports = new UserRepository();
