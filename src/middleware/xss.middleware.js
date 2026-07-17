const xss = require('xss');

/**
 * Recursively sanitizes string inputs to prevent XSS attacks.
 * It handles strings, arrays, and nested objects.
 */
const cleanInput = (value) => {
  if (typeof value === 'string') {
    // Sanitize string
    return xss(value);
  }
  
  if (value !== null && typeof value === 'object') {
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        value[key] = cleanInput(value[key]);
      }
    }
  }
  
  return value;
};

/**
 * Middleware to sanitize incoming request payload (body, query, params)
 */
const xssSanitizer = (req, res, next) => {
  if (req.body) {
    req.body = cleanInput(req.body);
  }
  if (req.query) {
    req.query = cleanInput(req.query);
  }
  if (req.params) {
    req.params = cleanInput(req.params);
  }
  next();
};

module.exports = xssSanitizer;
