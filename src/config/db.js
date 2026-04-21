const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Test Connection on Startup
prisma.$connect()
  .then(() => {
    console.log('✅ [Database] Connected successfully to Railway Postgres.');
  })
  .catch((err) => {
    console.error('❌ [Database] Connection Failed!', err.message);
  });

module.exports = prisma;
