const userRepository = require('./user.repository');

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
}

module.exports = new UserController();
