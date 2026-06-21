import express from 'express';
import jwt from 'jsonwebtoken';
import { User, Conversation } from './models.js';

const router = express.Router();

// ========== MIDDLEWARE ==========
export const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ========== AUTHENTIFICATION ==========

// Register & Login (Simple - just name + password)
router.post('/auth', async (req, res) => {
  try {
    const { name, password } = req.body;

    // Validation
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password required' });
    }

    // Find or create user
    let user = await User.findOne({ name });

    if (!user) {
      // Create new user
      user = new User({
        name,
        password,
        avatar: name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'
      });
      await user.save();
    } else {
      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Wrong password' });
      }
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== USER ROUTES ==========

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      avatar: req.user.avatar,
      bio: req.user.bio,
      isOnline: req.user.isOnline,
      lastSeen: req.user.lastSeen
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, bio, avatar } = req.body;
    
    if (name) req.user.name = name;
    if (bio) req.user.bio = bio;
    if (avatar) req.user.avatar = avatar;

    await req.user.save();

    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      avatar: req.user.avatar,
      bio: req.user.bio
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search users
router.get('/search', auth, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Query too short' });
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: req.userId }
    }).limit(20);

    res.json(users.map(u => ({
      id: u._id,
      name: u.name,
      avatar: u.avatar,
      isOnline: u.isOnline
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
