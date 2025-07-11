const express = require('express');
const router = express.Router();
const actionController = require('../controllers/actionController');

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * @route POST /action/execute
 * @desc Execute Facebook action (like, comment, follow, etc.)
 * @access Private
 */
router.post('/execute', requireAuth, actionController.executeAction);

/**
 * @route GET /action/history
 * @desc Get action history with pagination and filters
 * @access Private
 */
router.get('/history', requireAuth, actionController.getActionHistory);

/**
 * @route GET /action/stats
 * @desc Get action statistics
 * @access Private
 */
router.get('/stats', requireAuth, actionController.getActionStats);

/**
 * @route POST /action/cancel-pending
 * @desc Cancel all pending actions
 * @access Private
 */
router.post('/cancel-pending', requireAuth, actionController.cancelPendingActions);

/**
 * @route POST /action/validate-url
 * @desc Validate Facebook target URL
 * @access Private
 */
router.post('/validate-url', requireAuth, actionController.validateTargetUrl);

module.exports = router;