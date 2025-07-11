/**
 * Action Routes
 * Handles Facebook actions and action history management
 */

const express = require('express');
const router = express.Router();

const { 
    ActionController, 
    actionValidation, 
    urlValidation 
} = require('../controllers/actionController');

// Action execution routes
router.post('/perform', actionValidation, ActionController.performAction);
router.post('/validate-url', urlValidation, ActionController.validateTargetUrl);

// Action history and analytics routes
router.get('/history', ActionController.getActionHistory);
router.get('/stats', ActionController.getActionStats);
router.post('/cancel-pending', ActionController.cancelPendingActions);

module.exports = router;