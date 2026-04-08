const prisma = require('../config/db');

const logActivity = async (userId, type, message) => {
  try {
    const activity = await prisma.activity.create({
      data: {
        user_id: userId,
        type,
        message,
      },
    });

    // Emit real-time activity event
    const socketService = require('../sockets/socketService');
    socketService.getIo().to(userId).emit('activity_logged', activity);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};

module.exports = { logActivity };
