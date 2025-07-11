/**
 * Authentication Routes
 * Handles user login, Facebook session management, and user operations
 */

const express = require('express');
const router = express.Router();

const { 
    AuthController, 
    loginValidation, 
    facebookCredentialsValidation, 
    facebookCookiesValidation 
} = require('../controllers/authController');

// User authentication routes
router.post('/login', loginValidation, AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', AuthController.getCurrentUser);

// Facebook session management routes
router.post('/facebook/credentials', facebookCredentialsValidation, AuthController.addFacebookCredentials);
router.post('/facebook/cookies', facebookCookiesValidation, AuthController.addFacebookCookies);
router.get('/facebook/sessions', AuthController.getFacebookSessions);
router.delete('/facebook/sessions/:fbId', AuthController.removeFacebookSession);

module.exports = router;