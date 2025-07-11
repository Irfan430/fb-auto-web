/**
 * Dashboard Routes
 * Handles dashboard overview, system status, and user settings
 */

const express = require('express');
const router = express.Router();

const DashboardController = require('../controllers/dashboardController');

// Dashboard overview and status routes
router.get('/overview', DashboardController.getDashboardOverview);
router.get('/status', DashboardController.getSystemStatus);
router.get('/analytics', DashboardController.getActionAnalytics);

// User settings and data management routes
router.put('/settings', DashboardController.updateSettings);
router.get('/export', DashboardController.exportUserData);

module.exports = router;