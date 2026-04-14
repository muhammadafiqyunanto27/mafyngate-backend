const config = require('./src/config/env');
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const chatSocket = require('./src/sockets/chat.socket');
const socketService = require('./src/sockets/socketService');

const PORT = config.port;
const server = http.createServer(app);

const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://mafyngate.vercel.app',
      'https://mafyngate-muhammads-projects-8c282662.vercel.app' // Additional public domain if any
    ],
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling'] 
});

// Initialize socket service and handlers
socketService.init(io);
chatSocket(io);

server.listen(PORT, () => {
  console.log(`Server (with Socket.io) is running on port ${PORT}`);
});
