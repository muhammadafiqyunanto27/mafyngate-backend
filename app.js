const express = require('express');
const cors = require('cors');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { apiLimiter } = require('./src/middleware/rateLimit.middleware');
const errorHandler = require('./src/middleware/error.middleware');
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
  'https://mafyngate.vercel.app',
  'https://mafyn-gate.vercel.app',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    const isLocalNetwork =
      origin.startsWith('http://192.168.') ||
      origin.startsWith('http://10.') ||
      origin.startsWith('http://172.') ||
      origin.includes('localhost:');
    if (isLocalNetwork) return callback(null, true);
    console.warn(`[CORS] Blocked request from: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// ─── Passport: Google OAuth Strategy ─────────────────────────────────────────
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/auth/google/callback`,
  },
  (accessToken, refreshToken, profile, done) => {
    // Pass the raw Google profile to the controller — auth service handles DB logic
    return done(null, profile);
  }
));

// Passport middleware (no sessions — we use JWT)
app.use(passport.initialize());

// Apply rate limiting to all requests
app.use(apiLimiter);

// Serve uploads
app.use('/uploads', express.static(path.resolve(uploadBase)));

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
