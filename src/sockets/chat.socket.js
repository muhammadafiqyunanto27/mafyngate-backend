const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../config/db');

const users = new Map(); // Store online users: userId -> socketId

const chatSocket = (io) => {
  // Middleware for socket authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('Socket Auth Error: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret);
      socket.user = decoded;
      next();
    } catch (err) {
      console.log('Socket Auth Error: Invalid token', err.message);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`User connected to socket: ${userId}`);
    
    // Track online user
    users.set(userId, socket.id);
    
    // Join a personal room for targeted notifications
    socket.join(userId);

    // Get unread messages count on connection
    const sendUnreadCount = async () => {
      const unreadCount = await prisma.message.count({
        where: { receiverId: userId, isRead: false }
      });
      socket.emit('unread_count', { count: unreadCount });
    };
    sendUnreadCount();

    // Sending a message
    socket.on('send_message', async (data) => {
      const { content, receiverId } = data;
      
      try {
        // 1. Find existing conversation or create new one
        let conversation = await prisma.conversation.findFirst({
          where: {
            participants: {
              every: {
                userId: { in: [userId, receiverId] }
              }
            }
          }
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              participants: {
                create: [
                  { userId: userId },
                  { userId: receiverId }
                ]
              }
            }
          });
        }

        // 2. Save message to database
        const message = await prisma.message.create({
          data: {
            content,
            senderId: userId,
            receiverId,
            conversationId: conversation.id,
          },
          include: {
            sender: {
              select: { id: true, name: true, avatar: true, email: true }
            }
          }
        });

        // Send to receiver if online (using their private room)
        io.to(receiverId).emit('receive_message', message);
        
        // Also send notification event for navbar
        const receiverUnreadCount = await prisma.message.count({
          where: { receiverId: receiverId, isRead: false }
        });
        io.to(receiverId).emit('new_notification', { 
          type: 'CHAT', 
          message: `New message from ${message.sender.name || message.sender.email}`,
          count: receiverUnreadCount
        });

        // Confirm to sender
        socket.emit('message_sent', message);

      } catch (err) {
        console.error('Socket error sending message:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Mark messages as read via socket for real-time badge update
    socket.on('mark_read', async (data) => {
      const { senderId } = data;
      try {
        await prisma.message.updateMany({
          where: {
            receiverId: userId,
            senderId,
            isRead: false
          },
          data: { isRead: true }
        });
        
        const unreadCount = await prisma.message.count({
          where: { receiverId: userId, isRead: false }
        });
        socket.emit('unread_count', { count: unreadCount });
      } catch (err) {
        console.error('Socket error marking as read:', err);
      }
    });

    // Handle follow notifications real-time
    socket.on('follow_user', async (data) => {
      const { followingId } = data;
      try {
        const sender = await prisma.user.findUnique({ where: { id: userId } });
        const notification = await prisma.notification.create({
          data: {
            userId: followingId,
            type: 'FOLLOW',
            content: `${sender.name || sender.email} started following you`,
            senderId: userId
          }
        });
        
        io.to(followingId).emit('new_notification', notification);
      } catch (err) {
        console.error('Socket error following user:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      users.delete(userId);
    });
  });
};

module.exports = chatSocket;
