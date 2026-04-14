const express = require('express');
const cors = require('cors');
const { apiLimiter } = require('./src/middleware/rateLimit.middleware');
const errorHandler = require('./src/middleware/error.middleware');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://mafyngate.vercel.app',
  'https://mafyn-gate.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow internal/server-to-server or development tools (no origin)
    if (!origin) return callback(null, true);

    // 2. Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // 3. Allow typical local network development IPs (for mobile testing)
    const isLocalNetwork = 
      origin.startsWith('http://192.168.') || 
      origin.startsWith('http://10.') || 
      origin.startsWith('http://172.') ||
      origin.includes('localhost:');

    if (isLocalNetwork) return callback(null, true);

    // Otherwise, deny
    console.warn(`[CORS] Blocked request from: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Apply rate limiting to all requests
app.use(apiLimiter);

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
