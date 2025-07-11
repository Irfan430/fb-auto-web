const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  next();
};

// API authentication middleware
const requireAuthAPI = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * @route GET /dashboard
 * @desc Render dashboard page
 * @access Private
 */
router.get('/', requireAuth, dashboardController.renderDashboard);

/**
 * @route GET /dashboard/data
 * @desc Get dashboard data (API endpoint)
 * @access Private
 */
router.get('/data', requireAuthAPI, dashboardController.getDashboardDataAPI);

/**
 * @route GET /dashboard/system-status
 * @desc Get system status and health metrics
 * @access Private
 */
router.get('/system-status', requireAuthAPI, dashboardController.getSystemStatus);

/**
 * @route POST /dashboard/cleanup
 * @desc Cleanup expired sessions and old actions
 * @access Private
 */
router.post('/cleanup', requireAuthAPI, dashboardController.cleanupDashboard);

module.exports = router;