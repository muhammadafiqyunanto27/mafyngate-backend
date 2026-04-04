const userRepository = require('../user/user.repository');

class AuthRepository {
  async findUserByEmail(email) {
    return await userRepository.findByEmail(email);
  }

  async createUser(userData) {
    return await userRepository.create(userData);
  }
}

module.exports = new AuthRepository();
