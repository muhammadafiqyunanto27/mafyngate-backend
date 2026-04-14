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

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;
