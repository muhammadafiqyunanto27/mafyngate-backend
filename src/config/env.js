require('dotenv').config();

// Diagnostic Log for Push Notifications
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  console.log('✅ [Push] VAPID Keys Detected. Background Notifications Ready.');
} else {
  console.error('❌ [Push] VAPID Keys Missing! Background Notifications will NOT work.');
}

// Validation for JWT Secrets
if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.error('CRITICAL: JWT Secrets are missing in environment variables!');
  console.error('Please ensure JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are set in .env');
} else {
  console.log('✅ [Auth] JWT Secrets Verified.');
}

module.exports = {
  port: process.env.PORT || 5000,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    email: process.env.VAPID_EMAIL || 'mailto:muham@example.com'
  }
};
