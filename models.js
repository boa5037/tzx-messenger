import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ========== USER MODEL ==========
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Veuillez entrer un nom'],
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  email: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  password: {
    type: String,
    required: [true, 'Veuillez entrer un mot de passe'],
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
    select: false
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [150, 'La bio ne peut pas dépasser 150 caractères']
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ========== CONVERSATION MODEL ==========
const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  isGroup: {
    type: Boolean,
    default: false
  },
  groupName: {
    type: String,
    required: function() {
      return this.isGroup;
    }
  },
  groupImage: {
    type: String
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ========== MESSAGE MODEL ==========
const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Le message ne peut pas être vide'],
    maxlength: [5000, 'Le message est trop long']
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'audio'],
    default: 'text'
  },
  fileUrl: {
    type: String
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better performance
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
userSchema.index({ email: 1, phone: 1 });

export const User = mongoose.model('User', userSchema);
export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
