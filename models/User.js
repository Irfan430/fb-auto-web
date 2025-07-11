/**
 * User Model - MongoDB Schema
 * Stores Facebook sessions, user data, and action history
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Facebook Session Schema
const facebookSessionSchema = new mongoose.Schema({
    fbId: {
        type: String,
        required: true,
        trim: true
    },
    fbName: {
        type: String,
        trim: true
    },
    cookies: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUsed: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    },
    userAgent: {
        type: String,
        default: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Action History Schema
const actionHistorySchema = new mongoose.Schema({
    actionId: {
        type: String,
        required: true,
        unique: true
    },
    actionType: {
        type: String,
        required: true,
        enum: ['like', 'love', 'haha', 'sad', 'angry', 'wow', 'follow', 'comment', 'unfollow', 'unlike']
    },
    targetUrl: {
        type: String,
        required: true
    },
    targetId: {
        type: String,
        required: true
    },
    fbSessionId: {
        type: String,
        required: true
    },
    maskedFbId: {
        type: String,
        required: true
    },
    comment: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'cancelled'],
        default: 'pending'
    },
    errorMessage: {
        type: String,
        default: null
    },
    executionTime: {
        type: Number, // in milliseconds
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Main User Schema
const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        minlength: 6
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    facebookSessions: [facebookSessionSchema],
    actionHistory: [actionHistorySchema],
    settings: {
        autoCleanup: {
            type: Boolean,
            default: true
        },
        maxSessions: {
            type: Number,
            default: 10
        },
        notificationEmail: {
            type: String,
            default: null
        }
    },
    statistics: {
        totalActions: {
            type: Number,
            default: 0
        },
        successfulActions: {
            type: Number,
            default: 0
        },
        failedActions: {
            type: Number,
            default: 0
        },
        lastLoginDate: {
            type: Date,
            default: Date.now
        },
        loginCount: {
            type: Number,
            default: 0
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for better query performance
userSchema.index({ userId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ 'facebookSessions.fbId': 1 });
userSchema.index({ 'facebookSessions.isActive': 1 });
userSchema.index({ 'actionHistory.timestamp': -1 });
userSchema.index({ 'actionHistory.status': 1 });

// Virtual for masked Facebook IDs
userSchema.virtual('activeFacebookSessions').get(function() {
    return this.facebookSessions.filter(session => session.isActive && session.expiresAt > new Date());
});

// Virtual for recent actions
userSchema.virtual('recentActions').get(function() {
    return this.actionHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20); // Last 20 actions
});

// Pre-save middleware to hash passwords
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const saltRounds = 12;
        this.password = await bcrypt.hash(this.password, saltRounds);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to add Facebook session
userSchema.methods.addFacebookSession = function(sessionData) {
    // Remove existing session with same fbId
    this.facebookSessions = this.facebookSessions.filter(
        session => session.fbId !== sessionData.fbId
    );
    
    // Add new session
    this.facebookSessions.push({
        fbId: sessionData.fbId,
        fbName: sessionData.fbName,
        cookies: sessionData.cookies,
        userAgent: sessionData.userAgent,
        isActive: true,
        lastUsed: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    
    // Enforce max sessions limit
    if (this.facebookSessions.length > this.settings.maxSessions) {
        this.facebookSessions = this.facebookSessions
            .sort((a, b) => b.lastUsed - a.lastUsed)
            .slice(0, this.settings.maxSessions);
    }
};

// Method to deactivate Facebook session
userSchema.methods.deactivateFacebookSession = function(fbId) {
    const session = this.facebookSessions.find(s => s.fbId === fbId);
    if (session) {
        session.isActive = false;
    }
};

// Method to add action to history
userSchema.methods.addActionHistory = function(actionData) {
    this.actionHistory.push(actionData);
    
    // Update statistics
    this.statistics.totalActions += 1;
    if (actionData.status === 'success') {
        this.statistics.successfulActions += 1;
    } else if (actionData.status === 'failed') {
        this.statistics.failedActions += 1;
    }
    
    // Keep only last 100 actions
    if (this.actionHistory.length > 100) {
        this.actionHistory = this.actionHistory
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 100);
    }
};

// Method to clean up expired sessions
userSchema.methods.cleanupExpiredSessions = function() {
    const now = new Date();
    this.facebookSessions = this.facebookSessions.filter(
        session => session.expiresAt > now && session.isActive
    );
};

// Method to get masked Facebook ID
userSchema.statics.maskFacebookId = function(fbId) {
    if (!fbId || fbId.length < 6) return fbId;
    return fbId.substring(0, 3) + '*'.repeat(fbId.length - 6) + fbId.substring(fbId.length - 3);
};

// Method to update session last used
userSchema.methods.updateSessionLastUsed = function(fbId) {
    const session = this.facebookSessions.find(s => s.fbId === fbId && s.isActive);
    if (session) {
        session.lastUsed = new Date();
    }
};

const User = mongoose.model('User', userSchema);

module.exports = User;