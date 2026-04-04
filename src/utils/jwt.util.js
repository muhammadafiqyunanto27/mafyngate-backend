const jwt = require('jsonwebtoken');
const config = require('../config/env');

const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: '15m',
  });

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: '7d',
  });

  return { accessToken, refreshToken };
};

module.exports = { generateTokens };
