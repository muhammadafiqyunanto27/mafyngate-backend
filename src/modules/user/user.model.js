const prisma = require('../../config/db');

// Export the user model from prisma directly to act as our model abstraction
module.exports = prisma.user;
