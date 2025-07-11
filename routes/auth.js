const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * @route POST /auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', authController.register);

/**
 * @route POST /auth/login
 * @desc User login
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route POST /auth/facebook-login
 * @desc Facebook login with credentials (Puppeteer simulation)
 * @access Private
 */
router.post('/facebook-login', requireAuth, authController.facebookLogin);

/**
 * @route POST /auth/facebook-cookies
 * @desc Add Facebook session via cookies
 * @access Private
 */
router.post('/facebook-cookies', requireAuth, authController.addFacebookCookies);

/**
 * @route GET /auth/facebook-sessions
 * @desc Get user's Facebook sessions
 * @access Private
 */
router.get('/facebook-sessions', requireAuth, authController.getFacebookSessions);

/**
 * @route DELETE /auth/facebook-sessions/:sessionId
 * @desc Remove a Facebook session
 * @access Private
 */
router.delete('/facebook-sessions/:sessionId', requireAuth, authController.removeFacebookSession);

/**
 * @route POST /auth/logout
 * @desc User logout
 * @access Private
 */
router.post('/logout', authController.logout);

/**
 * @route GET /auth/check
 * @desc Check authentication status
 * @access Public
 */
router.get('/check', authController.checkAuth);

module.exports = router;