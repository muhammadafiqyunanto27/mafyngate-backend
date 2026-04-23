const fs = require('fs');
const path = require('path');

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  // Create a detailed error log
  const logEntry = `
[${new Date().toISOString()}] ${req.method} ${req.path}
Error: ${err.message}
Stack: ${err.stack}
--------------------------------------------------
`;

  // Write to a file I can read
  try {
    fs.appendFileSync(path.join(process.cwd(), 'debug_error.log'), logEntry);
  } catch (e) {
    console.error('Failed to write to debug_error.log', e);
  }

  // Also log to console for the user
  console.error(`[Error] ${req.method} ${req.path} >>`, err.message || err);

  let message = err.message || 'Internal Server Error';
  let genericStatusCode = statusCode;

  // ─── Prisma: Database Unreachable ────────────────────────────────────────────
  if (err.name === 'PrismaClientInitializationError') {
    genericStatusCode = 503;
    message = 'Database sedang tidak bisa dijangkau. Silakan coba lagi dalam beberapa menit.';
  // ─── Prisma: Too Many DB Connections ─────────────────────────────────────────
  } else if (err.message && err.message.includes('too many clients')) {
    genericStatusCode = 503;
    message = 'Server sedang overload. Silakan coba lagi dalam beberapa detik.';
  // ─── Prisma: DB Server Unreachable (generic) ──────────────────────────────────
  } else if (err.message && err.message.includes("Can't reach database server")) {
    genericStatusCode = 503;
    message = 'Koneksi database terputus. Server sedang recovery, mohon tunggu sebentar.';
  // ─── Prisma: Unique Constraint Violation ─────────────────────────────────────
  } else if (err.code === 'P2002') {
    genericStatusCode = 400;
    message = 'Data sudah terdaftar dalam sistem.';
  // ─── JWT: Secret Not Configured ──────────────────────────────────────────────
  } else if (err.message && err.message.includes('secretOrPrivateKey must have a value')) {
    genericStatusCode = 500;
    message = 'Konfigurasi server bermasalah (JWT). Hubungi admin.';
    console.error('[CRITICAL] JWT_ACCESS_SECRET or JWT_REFRESH_SECRET is not set in environment variables!');
  }

  res.status(genericStatusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;

