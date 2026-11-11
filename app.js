const express = require('express');
const cors = require('cors');
const passport = require('passport');
const helmet = require('helmet');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { apiLimiter } = require('./src/middleware/rateLimit.middleware');
const errorHandler = require('./src/middleware/error.middleware');
const xssSanitizer = require('./src/middleware/xss.middleware');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const uploadBase = process.env.UPLOAD_PATH || 'uploads';

// Only create local upload directories if NOT using Cloudinary
if (process.env.USE_CLOUDINARY !== 'true') {
  const uploadDirs = [
    path.resolve(uploadBase),
    path.resolve(uploadBase, 'avatars'),
    path.resolve(uploadBase, 'chat'),
  ];

  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[Storage] Created local directory: ${dir}`);
    }
  });
} else {
  console.log('[Storage] Cloudinary is active. Local directories skipped.');
}

const app = express();

// Trust reverse proxy (Railway, Vercel, etc.) to allow Secure cookies
app.set('trust proxy', 1);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://mafyngate.web.id',
  'https://www.mafyngate.web.id', // Versi WWW
  'https://mafyngate.vercel.app',
  'https://mafyn-gate.vercel.app',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`[CORS] Blocked request from: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:", "blob:"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
app.use(express.json());
app.use(xssSanitizer);
app.use(cookieParser());

// ─── Passport: Google OAuth Strategy ─────────────────────────────────────────
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    proxy: true, // IMPORTANT: Trust Railway proxy to correctly resolve https://
  },
  (accessToken, refreshToken, profile, done) => {
    // Pass the raw Google profile to the controller — auth service handles DB logic
    return done(null, profile);
  }
));

// Passport middleware (no sessions — we use JWT)
app.use(passport.initialize());

// ─── Public status endpoints ─────────────────────────────────────────────────
// Deliberately registered BEFORE the rate limiter so external monitors and
// uptime checks never get throttled. No auth required, no sensitive data.
const prisma = require('./src/config/db');

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'mafyngate-api',
    status: 'ok',
    message: 'Server is running. Use GET /health for a detailed check.',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', async (req, res) => {
  const startedAt = Date.now();
  let db = 'connected';
  let dbLatencyMs = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startedAt;
  } catch (err) {
    db = 'error';
  }

  const healthy = db === 'connected';
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'ok' : 'degraded',
    service: 'mafyngate-api',
    db,
    dbLatencyMs,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Apply rate limiting to all requests
app.use(apiLimiter);

// Serve uploads (with path traversal protection)
app.use('/uploads', (req, res, next) => {
  const requestedPath = path.normalize(req.path);
  if (requestedPath.includes('..') || requestedPath.includes('\0')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
}, express.static(path.resolve(uploadBase)));

// Routes
const authRoutes = require('./src/modules/auth/auth.route');
const userRoutes = require('./src/modules/user/user.route');
const todoRoutes = require('./src/modules/todo/todo.route');
const pushRoutes = require('./src/modules/push/push.router');

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/todo', todoRoutes);
app.use('/push', pushRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
