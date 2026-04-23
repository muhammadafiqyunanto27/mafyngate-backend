const { PrismaClient } = require('@prisma/client');

// ─── Singleton Pattern ────────────────────────────────────────────────────────
// CRITICAL: Never create more than ONE PrismaClient instance per process.
// Multiple instances cause "too many clients" errors on the free-tier DB.
// ─────────────────────────────────────────────────────────────────────────────
let prisma;

if (global.__prisma) {
  prisma = global.__prisma;
} else {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  // Warm up the connection pool on startup
  prisma.$connect()
    .then(() => {
      console.log('✅ [Database] Connected successfully to Railway Postgres.');
    })
    .catch((err) => {
      console.error('❌ [Database] Connection Failed!', err.message);
      // Don't crash the process — Railway will show a 503 via the error handler
    });

  global.__prisma = prisma;
}

// Graceful shutdown — release all DB connections on SIGINT/SIGTERM
const gracefulDisconnect = async (signal) => {
  console.log(`[Database] Received ${signal}. Disconnecting Prisma...`);
  await prisma.$disconnect();
  process.exit(0);
};

process.once('SIGINT',  () => gracefulDisconnect('SIGINT'));
process.once('SIGTERM', () => gracefulDisconnect('SIGTERM'));

module.exports = prisma;
