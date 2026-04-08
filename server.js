const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./src/config/env');
const chatSocket = require('./src/sockets/chat.socket');
const socketService = require('./src/sockets/socketService');

const PORT = config.port;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://mafyngate.vercel.app'
    ],
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true
  }
});

// Initialize socket service and handlers
socketService.init(io);
chatSocket(io);

server.listen(PORT, () => {
  console.log(`Server (with Socket.io) is running on port ${PORT}`);
});
