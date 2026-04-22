const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../config/db');
const PushController = require('../modules/push/push.controller');
const { getAbsoluteUrl, getFrontendUrl } = require('../utils/urlHelper');

const users = new Map(); // userId -> Set of socketIds
const userRooms = new Map(); // socketId -> targetUserId (who they are chatting with)

// Store active call attempts that can be "picked up" if a user comes online
// Key: targetUserId, Value: { signalData, from, name, avatar, type, timestamp }
const pendingCalls = new Map();

// Cleanup stale calls every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [userId, callData] of pendingCalls.entries()) {
    if (now - callData.timestamp > 60000) { // 60 seconds TTL
      pendingCalls.delete(userId);
    }
  }
}, 30000);

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
    
    if (!users.has(userId)) users.set(userId, new Set());
    users.get(userId).add(socket.id);
    socket.join(userId);

    // --- PICK UP PENDING CALLS ---
    // If someone was calling this user while they were offline, re-emit the signal now
    const pendingCall = pendingCalls.get(userId);
    if (pendingCall && (Date.now() - pendingCall.timestamp < 60000)) {
       console.log(`[Socket] Re-emitting pending call for user ${userId} from ${pendingCall.name}`);
       socket.emit('incoming_call', {
         signal: pendingCall.signalData,
         from: pendingCall.from,
         name: pendingCall.name,
         avatar: pendingCall.avatar,
         type: pendingCall.type,
         isRecovered: true
       });
    }

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
        let conversation;
        if (userId === receiverIdStr) {
          conversation = await prisma.conversation.findFirst({
          where: { 
            participants: { 
              AND: [
                { some: { userId: userId } },
                { none: { userId: { not: userId } } }
              ]
            } 
          }
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: { participants: { create: [{ userId: userId }] } }
          });
        }
      } else {
        conversation = await prisma.conversation.findFirst({
          where: {
            AND: [
              { participants: { some: { userId: userId } } },
              { participants: { some: { userId: receiverIdStr } } },
              { participants: { every: { userId: { in: [userId, receiverIdStr] } } } }
            ]
          }
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: { participants: { create: [{ userId: userId }, { userId: receiverIdStr }] } }
          });
        }
      }

        // Check if receiver is currently looking at this chat across any of their active tabs
        const receiverSockets = users.get(receiverIdStr) || new Set();
        let isReceiverInRoom = false;
        for (const sid of receiverSockets) {
          if (userRooms.get(sid) === userId) {
            isReceiverInRoom = true;
            break;
          }
        }

        const message = await prisma.message.create({
          data: { 
            content: content || (type === 'IMAGE' ? '[Photo]' : type === 'VIDEO' ? '[Video]' : type === 'VOICE' ? '[Voice Note]' : fileName || 'File'), 
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

        const senderName = message.sender.name || message.sender.email.split('@')[0];
        
        // Strip email before sending to clients for privacy
        const sanitizedMessage = {
          ...message,
          fileUrl: message.fileUrl ? getAbsoluteUrl(message.fileUrl) : null,
          parent: message.parent ? {
            ...message.parent,
            fileUrl: message.parent.fileUrl ? getAbsoluteUrl(message.parent.fileUrl) : null
          } : null,
          sender: {
            ...message.sender,
            avatar: getAbsoluteUrl(message.sender.avatar),
            email: undefined
          }
        };


        io.to(receiverIdStr).emit('receive_message', sanitizedMessage);
        
        // ONLY create notification if they are NOT in the room
        if (!isReceiverInRoom) {
          const notification = await prisma.notification.create({
            data: {
              userId: receiverIdStr,
              type: 'CHAT',
              content: `${senderName}: ${type === 'PROFILE' ? (() => { try { return `Profile: ${JSON.parse(content).name}`; } catch(e) { return 'shared a profile'; } })() : (type === 'IMAGE' ? '[Photo]' : type === 'VIDEO' ? '[Video]' : content.substring(0, 50))}`,
              senderId: userId
            }
          });

          io.to(receiverIdStr).emit('new_notification', notification);
          broadcastUnreadCount(receiverIdStr);
          broadcastUnreadChatsCount(receiverIdStr);

          // PUSH NOTIFICATION
          PushController.sendToUser(receiverIdStr, {
            title: `Message from ${senderName}`,
            body: content.substring(0, 100),
            icon: message.sender.avatar ? getAbsoluteUrl(message.sender.avatar) : getFrontendUrl('/logo.png'),
            url: getFrontendUrl(`/messages?userId=${userId}`),
            type: 'CHAT'
          });
        }
        
        io.to(userId).emit('message_sent', sanitizedMessage);
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
      const absoluteAvatar = getAbsoluteUrl(avatar);
      const receiverIdStr = userToCall.toString();

      // Store in pending calls so it can be recovered if the user is reconnecting
      pendingCalls.set(receiverIdStr, {
        signalData,
        from,
        name,
        avatar: absoluteAvatar,
        type,
        timestamp: Date.now()
      });

      io.to(receiverIdStr).emit('incoming_call', { signal: signalData, from, name, avatar: absoluteAvatar, type });
      
      // PUSH NOTIFICATION for Calling
      PushController.sendToUser(userToCall, {
        title: `Incoming ${type} Call`,
        body: `${name || 'Someone'} is calling you...`,
        icon: absoluteAvatar || getFrontendUrl('/logo.png'),
        url: getFrontendUrl('/messages'),
        type: 'CALL'
      });
    });

    socket.on('answer_call', (data) => {
      const { signal, to } = data;
      const receiverIdStr = to.toString();
      pendingCalls.delete(userId); // Caller answered, cleanup
      pendingCalls.delete(receiverIdStr); // Target answered
      io.to(receiverIdStr).emit('call_accepted', signal);
    });

    socket.on('reject_call', (data) => {
      const { to } = data;
      pendingCalls.delete(to.toString());
      pendingCalls.delete(userId);
      io.to(to.toString()).emit('call_rejected');
    });

    socket.on('end_call', (data) => {
      const { to } = data;
      pendingCalls.delete(to.toString());
      pendingCalls.delete(userId);
      io.to(to.toString()).emit('call_ended');
    });

    socket.on('mirror_toggled', (data) => {
      const { to, isMirrored } = data;
      io.to(to.toString()).emit('remote_mirror_toggled', { isMirrored });
    });

    socket.on('media_state_changed', (data) => {
      const { to, type, isEnabled } = data;
      io.to(to.toString()).emit('remote_media_changed', { type, isEnabled });
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
      if (users.has(userId)) {
        users.get(userId).delete(socket.id);
        if (users.get(userId).size === 0) {
          users.delete(userId);
          io.emit('user_status', { userId, status: 'offline' });
        }
      }
      userRooms.delete(socket.id);
    });
  });
};

module.exports = chatSocket;
