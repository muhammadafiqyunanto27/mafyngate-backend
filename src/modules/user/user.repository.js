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
}

module.exports = new UserRepository();
