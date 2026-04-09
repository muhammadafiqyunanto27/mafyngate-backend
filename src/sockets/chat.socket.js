const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../config/db');

const users = new Map(); // Store online users: userId -> socketId

const chatSocket = (io) => {
  // Middleware for socket authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error: No token provided'));

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id.toString();
    console.log(`[Socket] User Connected: ${userId}`);
    
    users.set(userId, socket.id);
    socket.join(userId);

    const sendUnreadCount = async () => {
      try {
        const count = await prisma.notification.count({
          where: { userId, isRead: false }
        });
        socket.emit('unread_count', { count });
      } catch (err) {}
    };
    sendUnreadCount();

    // Sending a message
    socket.on('send_message', async (data) => {
      const { content, receiverId } = data;
      const receiverIdStr = receiverId.toString();
      try {
        let conversation = await prisma.conversation.findFirst({
          where: {
            participants: {
              every: { userId: { in: [userId, receiverIdStr] } }
            }
          }
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              participants: {
                create: [{ userId: userId }, { userId: receiverIdStr }]
              }
            }
          });
        }

        const message = await prisma.message.create({
          data: {
            content,
            senderId: userId,
            receiverId: receiverIdStr,
            conversationId: conversation.id,
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true, email: true } }
          }
        });

        io.to(receiverIdStr).emit('receive_message', message);
        
        const senderName = message.sender.name || message.sender.email.split('@')[0];
        const notification = await prisma.notification.create({
          data: {
            userId: receiverIdStr,
            type: 'CHAT',
            content: `${senderName}: ${content.substring(0, 50)}`,
            senderId: userId
          }
        });

        io.to(receiverIdStr).emit('new_notification', notification);
        socket.emit('message_sent', message);
      } catch (err) {
        console.error('[Socket] Chat error:', err);
      }
    });

    // Handle follow notifications with deduplication
    socket.on('follow_user', async (data) => {
      const { followingId } = data;
      const followingIdStr = followingId.toString();
      
      try {
        const sender = await prisma.user.findUnique({ where: { id: userId } });
        const senderName = sender.name || sender.email.split('@')[0];
        
        // Check mutual follow status
        const isFollowBack = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: followingIdStr,
              followingId: userId
            }
          }
        });

        const content = isFollowBack ? `${senderName} followed you back` : `${senderName} is following you`;

        // UPSERT Notification (Update existing FOLLOW notification from this user or create new)
        const existingNotif = await prisma.notification.findFirst({
          where: {
            userId: followingIdStr,
            senderId: userId,
            type: 'FOLLOW'
          }
        });

        let notification;
        if (existingNotif) {
          notification = await prisma.notification.update({
            where: { id: existingNotif.id },
            data: { content, isRead: false, createdAt: new Date() }
          });
        } else {
          notification = await prisma.notification.create({
            data: {
              userId: followingIdStr,
              type: 'FOLLOW',
              content,
              senderId: userId
            }
          });
        }
        
        console.log(`[Socket] Follow Notif emitted to ${followingIdStr}`);
        io.to(followingIdStr).emit('new_notification', {
          ...notification,
          isFollowingSender: !!isFollowBack
        });
      } catch (err) {
        console.error('[Socket] Follow error:', err);
      }
    });

    // WebRTC Signaling
    socket.on('call_user', (data) => {
      const { userToCall, signalData, from, name, avatar, type } = data;
      io.to(userToCall.toString()).emit('incoming_call', { signal: signalData, from, name, avatar, type });
    });

    socket.on('answer_call', (data) => {
      const { signal, to } = data;
      io.to(to.toString()).emit('call_accepted', signal);
    });

    socket.on('reject_call', (data) => {
      const { to } = data;
      io.to(to.toString()).emit('call_rejected');
    });

    socket.on('end_call', (data) => {
      const { to } = data;
      io.to(to.toString()).emit('call_ended');
    });

    socket.on('disconnect', () => {
      users.delete(userId);
    });
  });
};

module.exports = chatSocket;
