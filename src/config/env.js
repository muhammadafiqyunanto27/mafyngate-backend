require('dotenv').config();

// ─── Validation for Push Notifications ───────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  console.log('✅ [Push] VAPID Keys Detected. Background Notifications Ready.');
} else {
  console.warn('⚠️  [Push] VAPID Keys Missing. Background Notifications will NOT work.');
}

// ─── Validation for JWT Secrets ───────────────────────────────────────────────
if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  const msg = [
    '═══════════════════════════════════════════════════════',
    '  FATAL: JWT_ACCESS_SECRET or JWT_REFRESH_SECRET missing!',
    '  All login/register requests will fail without these.',
    '  → Set them in Railway → Variables and redeploy.',
    '═══════════════════════════════════════════════════════',
  ].join('\n');
  console.error(msg);
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    process.exit(1);
  }
} else {
  console.log('✅ [Auth] JWT Secrets Verified.');
}

// ─── Validation for Google OAuth ─────────────────────────────────────────────
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️  [Google OAuth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing. Google login will NOT work.');
} else {
  console.log('✅ [Google OAuth] Credentials Verified.');
}

// ─── Validation for SMTP ──────────────────────────────────────────────────────
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn('⚠️  [Mailer] SMTP_USER or SMTP_PASS missing. Password reset emails will NOT work.');
} else {
  console.log('✅ [Mailer] SMTP Credentials Detected.');
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
    email: process.env.VAPID_EMAIL || 'mailto:muham@example.com',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
};

