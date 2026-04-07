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

app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'https://mafyngate.vercel.app' // Vercel production domain
  ],
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

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/todo', todoRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
