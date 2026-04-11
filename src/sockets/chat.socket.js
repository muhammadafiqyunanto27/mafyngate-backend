const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../config/db');

const users = new Map(); // userId -> socketId
const userRooms = new Map(); // socketId -> targetUserId (who they are chatting with)

const chatSocket = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Auth error: No token'));
    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Auth error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id.toString();
    console.log(`[Socket] User ${userId} connected`);
    
    users.set(userId, socket.id);
    socket.join(userId);

    // Broadcast that this user is now online to anyone interested
    io.emit('user_status', { userId, status: 'online' });

    // Function to broadcast unread count to all tabs of a user
    const broadcastUnreadCount = async (targetUserId) => {
      try {
        const count = await prisma.notification.count({
          where: { userId: targetUserId.toString(), isRead: false }
        });
        io.to(targetUserId.toString()).emit('unread_count', { count });
      } catch (err) {
        console.error('[Socket] Unread count error:', err);
      }
    };

    const broadcastUnreadChatsCount = async (targetUserId) => {
      try {
        const unreadConversations = await prisma.message.findMany({
          where: { receiverId: targetUserId.toString(), isRead: false },
          distinct: ['senderId']
        });
        io.to(targetUserId.toString()).emit('unread_chats_count', { count: unreadConversations.length });
      } catch (err) {
        console.error('[Socket] Unread chats count error:', err);
      }
    };

    broadcastUnreadCount(userId);
    broadcastUnreadChatsCount(userId);

    socket.on('join_chat', (data) => {
      const { targetId } = data;
      userRooms.set(socket.id, targetId.toString());
      console.log(`[Socket] User ${userId} joined chat with ${targetId}`);
    });

    socket.on('leave_chat', () => {
      userRooms.delete(socket.id);
      console.log(`[Socket] User ${userId} left chat`);
    });

    socket.on('send_message', async (data) => {
      const { content, receiverId, type, fileUrl, fileName, fileSize, parentId } = data;
      const receiverIdStr = receiverId.toString();
      try {
        let conversation = await prisma.conversation.findFirst({
          where: { participants: { every: { userId: { in: [userId, receiverIdStr] } } } }
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: { participants: { create: [{ userId: userId }, { userId: receiverIdStr }] } }
          });
        }

        // Check if receiver is currently looking at this chat
        const receiverSocketId = users.get(receiverIdStr);
        const isReceiverInRoom = receiverSocketId && userRooms.get(receiverSocketId) === userId;

        const message = await prisma.message.create({
          data: { 
            content: content || fileName || 'File', 
            senderId: userId, 
            receiverId: receiverIdStr, 
            conversationId: conversation.id,
            isRead: !!isReceiverInRoom,
            type: type || 'TEXT',
            fileUrl,
            fileName,
            fileSize,
            parentId: parentId || null
          },
          include: { 
            sender: { select: { id: true, name: true, avatar: true, email: true } },
            parent: {
              include: {
                sender: { select: { id: true, name: true } }
              }
            }
          }
        });

        io.to(receiverIdStr).emit('receive_message', message);
        
        // ONLY create notification if they are NOT in the room
        if (!isReceiverInRoom) {
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
          broadcastUnreadCount(receiverIdStr);
          broadcastUnreadChatsCount(receiverIdStr);
        }
        
        socket.emit('message_sent', message);
      } catch (err) {
        console.error('[Socket] Chat error:', err);
      }
    });


    socket.on('mark_read', async (data) => {
      broadcastUnreadChatsCount(userId);
    });

    socket.on('mark_notification_read', async (data) => {
       // Optional: explicit broadcast after marking read
       broadcastUnreadCount(userId);
    });

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

    socket.on('mirror_toggled', (data) => {
      const { to, isMirrored } = data;
      io.to(to.toString()).emit('remote_mirror_toggled', { isMirrored });
    });

    socket.on('typing', (data) => {
      const { to } = data;
      io.to(to.toString()).emit('user_typing', { from: userId });
    });

    socket.on('stop_typing', (data) => {
      const { to } = data;
      io.to(to.toString()).emit('user_stop_typing', { from: userId });
    });

    socket.on('get_user_status', (data) => {
      const { targetId } = data;
      const isOnline = users.has(targetId.toString());
      socket.emit('user_status', { userId: targetId.toString(), status: isOnline ? 'online' : 'offline' });
    });

    socket.on('messages_deleted', (data) => {
      const { targetId, messageIds, everyone } = data;
      // Broadcast to the other user
      io.to(targetId.toString()).emit('messages_deleted', { messageIds, everyone });
      // Update unread counts
      broadcastUnreadChatsCount(userId);
      broadcastUnreadChatsCount(targetId.toString());
    });

    socket.on('connection_update', (data) => {
      const { targetId, status } = data;
      io.to(targetId.toString()).emit('connection_update', { targetId: userId, status });
    });

    socket.on('disconnect', () => {
      users.delete(userId);
      userRooms.delete(socket.id);
      io.emit('user_status', { userId, status: 'offline' });
    });
  });
};

module.exports = chatSocket;
