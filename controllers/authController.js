const validator = require('validator');
const { User, FBSession } = require('../models/User');
const fbService = require('../services/fbService');

class AuthController {
  /**
   * User registration
   */
  async register(req, res) {
    try {
      const { username, email, password, confirmPassword } = req.body;

      // Validation
      if (!username || !email || !password || !confirmPassword) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
      }

      if (!validator.isEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User with this email or username already exists' });
      }

      // Create new user
      const user = new User({
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password
      });

      await user.save();

      // Create session
      req.session.userId = user._id;
      req.session.username = user.username;

      console.log(`✅ New user registered: ${user.username}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * User login
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validation
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      // Find user
      const user = await User.findOne({
        $or: [
          { username: username.trim() },
          { email: username.toLowerCase().trim() }
        ]
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Create session
      req.session.userId = user._id;
      req.session.username = user.username;

      console.log(`✅ User logged in: ${user.username}`);

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Facebook login with credentials
   */
  async facebookLogin(req, res) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Facebook email and password are required' });
      }

      if (!validator.isEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      console.log(`🔐 Attempting Facebook login for: ${email}`);

      // Use Facebook service to login
      const loginResult = await fbService.loginWithCredentials(email, password);

      if (!loginResult.success) {
        return res.status(400).json({ error: loginResult.error });
      }

      // Check if this FB account already exists in our database
      let fbSession = await FBSession.findOne({ fbUserId: loginResult.fbUserId });

      if (fbSession) {
        // Update existing session
        fbSession.cookies = loginResult.cookies;
        fbSession.userAgent = loginResult.userAgent;
        fbSession.isActive = true;
        fbSession.lastUsed = new Date();
        fbSession.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await fbSession.save();
      } else {
        // Create new session
        fbSession = new FBSession({
          fbUserId: loginResult.fbUserId,
          fbUsername: email, // Store email as username for reference
          cookies: loginResult.cookies,
          userAgent: loginResult.userAgent,
          isActive: true
        });
        await fbSession.save();

        // Add session to current user
        if (req.session.userId) {
          await User.findByIdAndUpdate(req.session.userId, {
            $addToSet: { fbSessions: fbSession._id }
          });
        }
      }

      console.log(`✅ Facebook session created/updated for: ${loginResult.fbUserId}`);

      res.json({
        success: true,
        message: 'Facebook login successful',
        session: {
          id: fbSession._id,
          fbUserId: fbSession.fbUserId.substring(0, 4) + '****', // Masked for privacy
          isActive: fbSession.isActive,
          createdAt: fbSession.createdAt
        }
      });

    } catch (error) {
      console.error('Facebook login error:', error);
      res.status(500).json({ error: 'Facebook login failed. Please try again.' });
    }
  }

  /**
   * Add Facebook session via cookies
   */
  async addFacebookCookies(req, res) {
    try {
      const { cookies, fbUserId } = req.body;

      // Validation
      if (!cookies || !fbUserId) {
        return res.status(400).json({ error: 'Cookies and Facebook User ID are required' });
      }

      // Validate cookies format
      let parsedCookies;
      try {
        parsedCookies = JSON.parse(cookies);
        if (!Array.isArray(parsedCookies) || parsedCookies.length === 0) {
          throw new Error('Invalid cookies format');
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid cookies format. Please provide valid JSON array.' });
      }

      console.log(`🍪 Adding Facebook cookies for user: ${fbUserId}`);

      // Validate cookies by testing them
      const validation = await fbService.validateCookies(cookies);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid or expired cookies' });
      }

      // Check if this FB account already exists
      let fbSession = await FBSession.findOne({ fbUserId });

      if (fbSession) {
        // Update existing session
        fbSession.cookies = cookies;
        fbSession.isActive = true;
        fbSession.lastUsed = new Date();
        fbSession.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await fbSession.save();
      } else {
        // Create new session
        fbSession = new FBSession({
          fbUserId,
          cookies,
          isActive: true
        });
        await fbSession.save();

        // Add session to current user
        if (req.session.userId) {
          await User.findByIdAndUpdate(req.session.userId, {
            $addToSet: { fbSessions: fbSession._id }
          });
        }
      }

      console.log(`✅ Facebook cookies added/updated for: ${fbUserId}`);

      res.json({
        success: true,
        message: 'Facebook cookies added successfully',
        session: {
          id: fbSession._id,
          fbUserId: fbSession.fbUserId.substring(0, 4) + '****', // Masked for privacy
          isActive: fbSession.isActive,
          createdAt: fbSession.createdAt
        }
      });

    } catch (error) {
      console.error('Add cookies error:', error);
      res.status(500).json({ error: 'Failed to add Facebook cookies' });
    }
  }

  /**
   * Get user's Facebook sessions
   */
  async getFacebookSessions(req, res) {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await User.findById(req.session.userId).populate('fbSessions');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Clean up expired sessions first
      await fbService.cleanupExpiredSessions();

      // Get active sessions
      const activeSessions = await FBSession.find({
        _id: { $in: user.fbSessions },
        isActive: true,
        expiresAt: { $gt: new Date() }
      });

      const sessionData = activeSessions.map(session => ({
        id: session._id,
        fbUserId: session.fbUserId.substring(0, 4) + '****', // Masked for privacy
        fbUsername: session.fbUsername ? session.fbUsername.replace(/(.{2}).*(@.*)/, '$1****$2') : '', // Masked email
        isActive: session.isActive,
        lastUsed: session.lastUsed,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      }));

      res.json({
        success: true,
        sessions: sessionData,
        totalActive: sessionData.length
      });

    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({ error: 'Failed to retrieve Facebook sessions' });
    }
  }

  /**
   * Remove Facebook session
   */
  async removeFacebookSession(req, res) {
    try {
      const { sessionId } = req.params;

      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Find and deactivate session
      const fbSession = await FBSession.findById(sessionId);
      if (!fbSession) {
        return res.status(404).json({ error: 'Session not found' });
      }

      fbSession.isActive = false;
      await fbSession.save();

      console.log(`🗑️ Facebook session removed: ${sessionId}`);

      res.json({
        success: true,
        message: 'Facebook session removed successfully'
      });

    } catch (error) {
      console.error('Remove session error:', error);
      res.status(500).json({ error: 'Failed to remove Facebook session' });
    }
  }

  /**
   * User logout
   */
  async logout(req, res) {
    try {
      const username = req.session.username;
      
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.status(500).json({ error: 'Logout failed' });
        }

        res.clearCookie('fbAutoSession');
        console.log(`👋 User logged out: ${username}`);
        
        res.json({
          success: true,
          message: 'Logout successful'
        });
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  /**
   * Check authentication status
   */
  async checkAuth(req, res) {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ authenticated: false });
      }

      const user = await User.findById(req.session.userId);
      if (!user) {
        return res.status(401).json({ authenticated: false });
      }

      res.json({
        authenticated: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });

    } catch (error) {
      console.error('Auth check error:', error);
      res.status(500).json({ error: 'Authentication check failed' });
    }
  }
}

module.exports = new AuthController();