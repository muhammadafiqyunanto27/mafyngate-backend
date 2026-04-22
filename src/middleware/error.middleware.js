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
  console.error(`[Error] ${req.method} ${req.path} >>`, err);

  let message = err.message || 'Internal Server Error';
  let genericStatusCode = statusCode;

  // Handle Prisma Connection Errors specifically
  if (err.name === 'PrismaClientInitializationError') {
    genericStatusCode = 503; // Service Unavailable
    message = 'Sistem sedang mengalami masalah koneksi ke database. Silakan hubungi admin atau periksa status Railway Anda.';
  } else if (err.code === 'P2002') {
    genericStatusCode = 400;
    message = 'Data sudah terdaftar dalam sistem.';
  }

  res.status(genericStatusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;
