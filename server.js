import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes, { auth } from './routes.js';
import { User, Conversation, Message } from './models.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.SOCKET_IO_CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());

// ========== DATABASE CONNECTION ==========
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatflow')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ========== ROUTES ==========
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// ========== SOCKET.IO - ÉVÉNEMENTS EN TEMPS RÉEL ==========

const userSockets = new Map(); // userId -> socketId

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Connection
io.on('connection', async (socket) => {
  const userId = socket.userId;
  console.log(`✅ User ${userId} connected with socket ${socket.id}`);
  
  userSockets.set(userId, socket.id);

  try {
    // Update user online status
    await User.findByIdAndUpdate(userId, { 
      isOnline: true,
      lastSeen: new Date()
    });

    // Broadcast user online
    io.emit('user:online', { userId, isOnline: true });

    // ========== CONVERSATION EVENTS ==========

    // Get conversations
    socket.on('conversations:list', async (callback) => {
      try {
        const conversations = await Conversation.find({
          participants: userId
        })
          .populate('participants', 'name avatar isOnline')
          .populate('lastMessage')
          .sort({ lastMessageAt: -1 });

        callback({
          success: true,
          conversations: conversations.map(c => ({
            id: c._id,
            participants: c.participants.filter(p => p._id.toString() !== userId),
            isGroup: c.isGroup,
            groupName: c.groupName,
            lastMessage: c.lastMessage,
            lastMessageAt: c.lastMessageAt
          }))
        });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Get or create direct conversation
    socket.on('conversation:direct', async (targetUserId, callback) => {
      try {
        let conversation = await Conversation.findOne({
          isGroup: false,
          participants: { $all: [userId, targetUserId] }
        })
          .populate('participants', 'name avatar isOnline')
          .populate('lastMessage');

        if (!conversation) {
          // Create new conversation
          conversation = new Conversation({
            participants: [userId, targetUserId],
            isGroup: false
          });
          await conversation.save();
          await conversation.populate('participants', 'name avatar isOnline');
        }

        callback({
          success: true,
          conversation: {
            id: conversation._id,
            participants: conversation.participants.filter(p => p._id.toString() !== userId),
            isGroup: conversation.isGroup,
            lastMessage: conversation.lastMessage,
            lastMessageAt: conversation.lastMessageAt
          }
        });

        // Join conversation room
        socket.join(`conversation:${conversation._id}`);
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // ========== MESSAGE EVENTS ==========

    // Get messages for conversation
    socket.on('messages:list', async (conversationId, callback) => {
      try {
        const messages = await Message.find({ conversation: conversationId })
          .populate('sender', 'name avatar')
          .sort({ createdAt: 1 });

        callback({
          success: true,
          messages: messages.map(m => ({
            id: m._id,
            conversation: m.conversation,
            sender: {
              id: m.sender._id,
              name: m.sender.name,
              avatar: m.sender.avatar
            },
            content: m.content,
            messageType: m.messageType,
            createdAt: m.createdAt,
            readBy: m.readBy
          }))
        });

        // Mark messages as read
        await Message.updateMany(
          { conversation: conversationId, sender: { $ne: userId } },
          { $addToSet: { 'readBy': { user: userId, readAt: new Date() } } }
        );
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Send message
    socket.on('message:send', async (data, callback) => {
      try {
        const { conversationId, content, messageType = 'text' } = data;

        // Create message
        const message = new Message({
          conversation: conversationId,
          sender: userId,
          content,
          messageType,
          readBy: [{ user: userId, readAt: new Date() }]
        });

        await message.save();
        await message.populate('sender', 'name avatar');

        // Update conversation last message
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          lastMessageAt: new Date()
        });

        const messageData = {
          id: message._id,
          conversation: message.conversation,
          sender: {
            id: message.sender._id,
            name: message.sender.name,
            avatar: message.sender.avatar
          },
          content: message.content,
          messageType: message.messageType,
          createdAt: message.createdAt,
          readBy: message.readBy
        };

        // Emit to conversation room
        io.to(`conversation:${conversationId}`).emit('message:new', messageData);

        callback({ success: true, message: messageData });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Typing indicator
    socket.on('typing:start', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('typing:indicator', {
        userId,
        isTyping: true
      });
    });

    socket.on('typing:stop', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('typing:indicator', {
        userId,
        isTyping: false
      });
    });

    // Mark messages as read
    socket.on('message:read', async (conversationId, callback) => {
      try {
        await Message.updateMany(
          { conversation: conversationId, sender: { $ne: userId } },
          { $addToSet: { 'readBy': { user: userId, readAt: new Date() } } }
        );

        io.to(`conversation:${conversationId}`).emit('messages:read', { userId, conversationId });
        callback({ success: true });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // ========== DISCONNECTION ==========
    socket.on('disconnect', async () => {
      console.log(`❌ User ${userId} disconnected`);
      userSockets.delete(userId);

      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date()
        });

        io.emit('user:offline', { userId, isOnline: false });
      } catch (error) {
        console.error('Error updating user offline status:', error);
      }
    });

  } catch (error) {
    console.error('Socket connection error:', error);
    socket.disconnect();
  }
});

// ========== SERVER START ==========
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║          🚀 ChatFlow Backend Started           ║
╠════════════════════════════════════════════════╣
║  Server:    http://localhost:${PORT}              ║
║  WebSocket: ws://localhost:${PORT}               ║
║  Env:       ${process.env.NODE_ENV || 'development'}                  ║
╚════════════════════════════════════════════════╝
  `);
});

export default app;
