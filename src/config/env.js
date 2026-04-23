require('dotenv').config();

// ─── Validation for Push Notifications ───────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  console.log('✅ [Push] VAPID Keys Detected. Background Notifications Ready.');
} else {
  console.warn('⚠️  [Push] VAPID Keys Missing. Background Notifications will NOT work.');
}

// ─── Validation for JWT Secrets ───────────────────────────────────────────────
// CRITICAL: Without these, every login/register silently fails.
// If missing in production → crash immediately so Railway restarts with a clear log.
if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  const msg = [
    '═══════════════════════════════════════════════════════',
    '  FATAL: JWT_ACCESS_SECRET or JWT_REFRESH_SECRET missing!',
    '  All login/register requests will fail without these.',
    '  → Set them in Railway → Variables and redeploy.',
    '═══════════════════════════════════════════════════════',
  ].join('\n');
  console.error(msg);

  // In production: crash fast so Railway shows a clear crash log.
  // In development: just warn so devs don't get stuck.
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    process.exit(1);
  }
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
