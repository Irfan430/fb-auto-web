/**
 * Authentication Controller
 * Handles user login, Facebook session management, and cookie storage
 */

const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const fbService = require('../services/fbService');

class AuthController {
    /**
     * User registration/login
     */
    async login(req, res) {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: errors.array()
                });
            }

            const { userId, email, password } = req.body;
            
            // Find or create user
            let user = await User.findOne({ 
                $or: [
                    { userId: userId },
                    { email: email }
                ]
            });

            if (!user) {
                // Create new user
                user = new User({
                    userId: userId || `user_${Date.now()}`,
                    email: email,
                    password: password
                });
                await user.save();
                console.log(`✅ New user created: ${user.userId}`);
            } else {
                // Verify existing user
                if (password && !(await user.comparePassword(password))) {
                    return res.status(401).json({
                        success: false,
                        message: 'Invalid credentials'
                    });
                }
                
                // Update login statistics
                user.statistics.loginCount += 1;
                user.statistics.lastLoginDate = new Date();
                await user.save();
            }

            // Clean up expired sessions
            user.cleanupExpiredSessions();
            await user.save();

            // Create session
            req.session.userId = user.userId;
            req.session.user = {
                userId: user.userId,
                email: user.email,
                role: user.role,
                isActive: user.isActive
            };

            res.json({
                success: true,
                message: 'Login successful',
                user: {
                    userId: user.userId,
                    email: user.email,
                    role: user.role,
                    activeSessions: user.activeFacebookSessions.length,
                    totalActions: user.statistics.totalActions
                }
            });

        } catch (error) {
            console.error('❌ Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Login failed',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Add Facebook session via credentials
     */
    async addFacebookCredentials(req, res) {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: errors.array()
                });
            }

            if (!req.session.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const { fbEmail, fbPassword } = req.body;

            console.log(`🔐 Attempting Facebook login for user: ${req.session.userId}`);

            // Perform Facebook login using Puppeteer
            const loginResult = await fbService.loginWithCredentials(fbEmail, fbPassword);

            if (!loginResult.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Facebook login failed',
                    error: loginResult.error || 'Invalid Facebook credentials'
                });
            }

            // Find user and add Facebook session
            const user = await User.findOne({ userId: req.session.userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Add Facebook session to user
            user.addFacebookSession({
                fbId: loginResult.fbId,
                fbName: loginResult.fbName,
                cookies: loginResult.cookies,
                userAgent: loginResult.userAgent
            });

            await user.save();

            console.log(`✅ Facebook session added for user: ${req.session.userId}, FB ID: ${User.maskFacebookId(loginResult.fbId)}`);

            res.json({
                success: true,
                message: 'Facebook account added successfully',
                facebook: {
                    fbId: User.maskFacebookId(loginResult.fbId),
                    fbName: loginResult.fbName,
                    isActive: true
                },
                activeSessions: user.activeFacebookSessions.length
            });

        } catch (error) {
            console.error('❌ Facebook credentials error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add Facebook account',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Add Facebook session via cookies
     */
    async addFacebookCookies(req, res) {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: errors.array()
                });
            }

            if (!req.session.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const { cookies, userAgent } = req.body;

            console.log(`🍪 Validating Facebook cookies for user: ${req.session.userId}`);

            // Validate Facebook session
            const validation = await fbService.validateSession(cookies, userAgent);

            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Facebook cookies',
                    error: 'Cookies are expired or invalid'
                });
            }

            // Find user and add Facebook session
            const user = await User.findOne({ userId: req.session.userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Add Facebook session to user
            user.addFacebookSession({
                fbId: validation.userInfo.id,
                fbName: validation.userInfo.name,
                cookies: cookies,
                userAgent: userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });

            await user.save();

            console.log(`✅ Facebook cookies validated and added for user: ${req.session.userId}, FB ID: ${User.maskFacebookId(validation.userInfo.id)}`);

            res.json({
                success: true,
                message: 'Facebook cookies added successfully',
                facebook: {
                    fbId: User.maskFacebookId(validation.userInfo.id),
                    fbName: validation.userInfo.name,
                    isActive: true
                },
                activeSessions: user.activeFacebookSessions.length
            });

        } catch (error) {
            console.error('❌ Facebook cookies error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add Facebook cookies',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Remove Facebook session
     */
    async removeFacebookSession(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const { fbId } = req.params;

            const user = await User.findOne({ userId: req.session.userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Find and deactivate the session
            const session = user.facebookSessions.find(s => s.fbId === fbId);
            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: 'Facebook session not found'
                });
            }

            user.deactivateFacebookSession(fbId);
            await user.save();

            console.log(`🗑️ Facebook session removed for user: ${req.session.userId}, FB ID: ${User.maskFacebookId(fbId)}`);

            res.json({
                success: true,
                message: 'Facebook session removed successfully',
                activeSessions: user.activeFacebookSessions.length
            });

        } catch (error) {
            console.error('❌ Remove Facebook session error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to remove Facebook session',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Get user's Facebook sessions
     */
    async getFacebookSessions(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user = await User.findOne({ userId: req.session.userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Clean up expired sessions first
            user.cleanupExpiredSessions();
            await user.save();

            const activeSessions = user.activeFacebookSessions.map(session => ({
                fbId: User.maskFacebookId(session.fbId),
                fbName: session.fbName,
                isActive: session.isActive,
                lastUsed: session.lastUsed,
                expiresAt: session.expiresAt,
                createdAt: session.createdAt
            }));

            res.json({
                success: true,
                sessions: activeSessions,
                total: activeSessions.length
            });

        } catch (error) {
            console.error('❌ Get Facebook sessions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get Facebook sessions',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Logout user
     */
    async logout(req, res) {
        try {
            const userId = req.session.userId;
            
            req.session.destroy((err) => {
                if (err) {
                    console.error('❌ Session destruction error:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Logout failed'
                    });
                }

                res.clearCookie('connect.sid');
                console.log(`👋 User logged out: ${userId}`);
                
                res.json({
                    success: true,
                    message: 'Logout successful'
                });
            });

        } catch (error) {
            console.error('❌ Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Logout failed',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Get current user info
     */
    async getCurrentUser(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user = await User.findOne({ userId: req.session.userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Clean up expired sessions
            user.cleanupExpiredSessions();
            await user.save();

            res.json({
                success: true,
                user: {
                    userId: user.userId,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive,
                    activeSessions: user.activeFacebookSessions.length,
                    statistics: user.statistics,
                    settings: user.settings,
                    createdAt: user.createdAt
                }
            });

        } catch (error) {
            console.error('❌ Get current user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user info',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
}

// Validation rules
const loginValidation = [
    body('userId')
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('User ID must be between 3 and 50 characters'),
    body('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .optional()
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
];

const facebookCredentialsValidation = [
    body('fbEmail')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid Facebook email'),
    body('fbPassword')
        .isLength({ min: 1 })
        .withMessage('Facebook password is required')
];

const facebookCookiesValidation = [
    body('cookies')
        .isLength({ min: 10 })
        .withMessage('Valid Facebook cookies are required'),
    body('userAgent')
        .optional()
        .isLength({ min: 10 })
        .withMessage('User agent must be at least 10 characters')
];

module.exports = {
    AuthController: new AuthController(),
    loginValidation,
    facebookCredentialsValidation,
    facebookCookiesValidation
};