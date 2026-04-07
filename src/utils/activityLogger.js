const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const logActivity = async (userId, type, message) => {
  try {
    await prisma.activity.create({
      data: {
        user_id: userId,
        type,
        message,
      },
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};

module.exports = { logActivity };
