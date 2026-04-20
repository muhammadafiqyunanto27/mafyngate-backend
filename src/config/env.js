require('dotenv').config();

// Diagnostic Log for Push Notifications
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  console.log('✅ [Push] VAPID Keys Detected. Background Notifications Ready.');
} else {
  console.error('❌ [Push] VAPID Keys Missing! Background Notifications will NOT work.');
  console.log('   Please add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to your env variables.');
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
