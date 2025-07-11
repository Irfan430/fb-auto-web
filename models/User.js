const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Facebook Session Schema
const fbSessionSchema = new mongoose.Schema({
  fbUserId: {
    type: String,
    required: true,
    index: true
  },
  fbUsername: {
    type: String,
    default: ''
  },
  cookies: {
    type: String, // Encrypted/encoded cookie string
    required: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  userAgent: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
});

// Action History Schema
const actionHistorySchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FBSession',
    required: true
  },
  fbUserId: {
    type: String,
    required: true,
    index: true
  },
  actionType: {
    type: String,
    enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry', 'follow', 'comment'],
    required: true
  },
  targetUrl: {
    type: String,
    required: true
  },
  targetUid: {
    type: String,
    default: ''
  },
  commentText: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  errorMessage: {
    type: String,
    default: ''
  },
  executedAt: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Application User Schema (for web app login)
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  fbSessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FBSession'
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove expired sessions method
fbSessionSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Static method to clean expired sessions
fbSessionSchema.statics.cleanExpiredSessions = async function() {
  try {
    const result = await this.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { isActive: false }
      ]
    });
    console.log(`🧹 Cleaned ${result.deletedCount} expired/inactive sessions`);
    return result;
  } catch (error) {
    console.error('Error cleaning expired sessions:', error);
    throw error;
  }
};

// Static method to get active sessions count
fbSessionSchema.statics.getActiveSessionsCount = async function() {
  return this.countDocuments({ isActive: true, expiresAt: { $gt: new Date() } });
};

// Indexes for performance
fbSessionSchema.index({ fbUserId: 1, isActive: 1 });
fbSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
actionHistorySchema.index({ fbUserId: 1, executedAt: -1 });
actionHistorySchema.index({ sessionId: 1 });

const User = mongoose.model('User', userSchema);
const FBSession = mongoose.model('FBSession', fbSessionSchema);
const ActionHistory = mongoose.model('ActionHistory', actionHistorySchema);

module.exports = {
  User,
  FBSession,
  ActionHistory
};