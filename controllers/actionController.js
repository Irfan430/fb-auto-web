/**
 * Action Controller
 * Handles Facebook actions like like, react, follow, comment using stored sessions
 */

const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const fbService = require('../services/fbService');

class ActionController {
    /**
     * Perform Facebook action
     */
    async performAction(req, res) {
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

            const { actionType, targetUrl, comment, selectedSessions } = req.body;

            // Find user
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

            // Get active sessions
            let sessionsToUse = user.activeFacebookSessions;
            
            // Filter by selected sessions if provided
            if (selectedSessions && selectedSessions.length > 0) {
                sessionsToUse = sessionsToUse.filter(session => 
                    selectedSessions.includes(session.fbId)
                );
            }

            if (sessionsToUse.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No active Facebook sessions available'
                });
            }

            console.log(`🎯 Performing ${actionType} action on ${targetUrl} for user: ${req.session.userId}`);
            console.log(`📱 Using ${sessionsToUse.length} Facebook session(s)`);

            const targetId = fbService.extractTargetId(targetUrl);
            const results = [];

            // Perform action for each session
            for (const session of sessionsToUse) {
                const actionId = uuidv4();
                const startTime = Date.now();

                try {
                    // Update session last used
                    user.updateSessionLastUsed(session.fbId);

                    // Perform the action
                    const actionResult = await fbService.performAction(
                        actionType,
                        targetUrl,
                        session.cookies,
                        session.userAgent,
                        comment
                    );

                    const actionData = {
                        actionId,
                        actionType,
                        targetUrl,
                        targetId,
                        fbSessionId: session.fbId,
                        maskedFbId: User.maskFacebookId(session.fbId),
                        comment: comment || null,
                        status: actionResult.success ? 'success' : 'failed',
                        errorMessage: actionResult.success ? null : actionResult.error,
                        executionTime: actionResult.executionTime,
                        timestamp: new Date()
                    };

                    // Add to user's action history
                    user.addActionHistory(actionData);

                    results.push({
                        fbId: User.maskFacebookId(session.fbId),
                        fbName: session.fbName,
                        success: actionResult.success,
                        message: actionResult.success ? actionResult.result : actionResult.error,
                        executionTime: actionResult.executionTime
                    });

                    console.log(`${actionResult.success ? '✅' : '❌'} Action ${actionType} for ${User.maskFacebookId(session.fbId)}: ${actionResult.success ? 'Success' : actionResult.error}`);

                } catch (sessionError) {
                    console.error(`❌ Action failed for session ${User.maskFacebookId(session.fbId)}:`, sessionError);
                    
                    // Check if session is invalid
                    if (sessionError.message.includes('Session expired') || sessionError.message.includes('invalid')) {
                        user.deactivateFacebookSession(session.fbId);
                        console.log(`🗑️ Deactivated invalid session: ${User.maskFacebookId(session.fbId)}`);
                    }

                    const actionData = {
                        actionId,
                        actionType,
                        targetUrl,
                        targetId,
                        fbSessionId: session.fbId,
                        maskedFbId: User.maskFacebookId(session.fbId),
                        comment: comment || null,
                        status: 'failed',
                        errorMessage: sessionError.message,
                        executionTime: Date.now() - startTime,
                        timestamp: new Date()
                    };

                    user.addActionHistory(actionData);

                    results.push({
                        fbId: User.maskFacebookId(session.fbId),
                        fbName: session.fbName,
                        success: false,
                        message: sessionError.message,
                        executionTime: Date.now() - startTime
                    });
                }

                // Add delay between actions to avoid rate limiting
                if (sessionsToUse.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
                }
            }

            // Save user data
            await user.save();

            const successCount = results.filter(r => r.success).length;
            const failureCount = results.length - successCount;

            res.json({
                success: true,
                message: `Action completed: ${successCount} successful, ${failureCount} failed`,
                results,
                summary: {
                    total: results.length,
                    successful: successCount,
                    failed: failureCount,
                    actionType,
                    targetUrl
                }
            });

        } catch (error) {
            console.error('❌ Perform action error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to perform action',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Get action history
     */
    async getActionHistory(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const { page = 1, limit = 20, actionType, status } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            const user = await User.findOne({ userId: req.session.userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            let actionHistory = [...user.actionHistory];

            // Filter by action type
            if (actionType) {
                actionHistory = actionHistory.filter(action => 
                    action.actionType === actionType
                );
            }

            // Filter by status
            if (status) {
                actionHistory = actionHistory.filter(action => 
                    action.status === status
                );
            }

            // Sort by timestamp (newest first)
            actionHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Paginate
            const total = actionHistory.length;
            const startIndex = (pageNum - 1) * limitNum;
            const endIndex = startIndex + limitNum;
            const paginatedHistory = actionHistory.slice(startIndex, endIndex);

            res.json({
                success: true,
                history: paginatedHistory,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                    hasNext: endIndex < total,
                    hasPrev: pageNum > 1
                }
            });

        } catch (error) {
            console.error('❌ Get action history error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get action history',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Get action statistics
     */
    async getActionStats(req, res) {
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

            // Calculate statistics from action history
            const actionHistory = user.actionHistory;
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const stats = {
                total: user.statistics,
                today: {
                    total: actionHistory.filter(a => new Date(a.timestamp) >= today).length,
                    successful: actionHistory.filter(a => new Date(a.timestamp) >= today && a.status === 'success').length,
                    failed: actionHistory.filter(a => new Date(a.timestamp) >= today && a.status === 'failed').length
                },
                thisWeek: {
                    total: actionHistory.filter(a => new Date(a.timestamp) >= thisWeek).length,
                    successful: actionHistory.filter(a => new Date(a.timestamp) >= thisWeek && a.status === 'success').length,
                    failed: actionHistory.filter(a => new Date(a.timestamp) >= thisWeek && a.status === 'failed').length
                },
                thisMonth: {
                    total: actionHistory.filter(a => new Date(a.timestamp) >= thisMonth).length,
                    successful: actionHistory.filter(a => new Date(a.timestamp) >= thisMonth && a.status === 'success').length,
                    failed: actionHistory.filter(a => new Date(a.timestamp) >= thisMonth && a.status === 'failed').length
                },
                byActionType: {},
                recentActions: actionHistory
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, 10)
            };

            // Count by action type
            actionHistory.forEach(action => {
                if (!stats.byActionType[action.actionType]) {
                    stats.byActionType[action.actionType] = {
                        total: 0,
                        successful: 0,
                        failed: 0
                    };
                }
                stats.byActionType[action.actionType].total++;
                if (action.status === 'success') {
                    stats.byActionType[action.actionType].successful++;
                } else if (action.status === 'failed') {
                    stats.byActionType[action.actionType].failed++;
                }
            });

            res.json({
                success: true,
                stats
            });

        } catch (error) {
            console.error('❌ Get action stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get action statistics',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Cancel pending actions
     */
    async cancelPendingActions(req, res) {
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

            // Update pending actions to cancelled
            let cancelledCount = 0;
            user.actionHistory.forEach(action => {
                if (action.status === 'pending') {
                    action.status = 'cancelled';
                    cancelledCount++;
                }
            });

            await user.save();

            console.log(`🚫 Cancelled ${cancelledCount} pending actions for user: ${req.session.userId}`);

            res.json({
                success: true,
                message: `${cancelledCount} pending actions cancelled`,
                cancelledCount
            });

        } catch (error) {
            console.error('❌ Cancel pending actions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to cancel pending actions',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Validate target URL
     */
    async validateTargetUrl(req, res) {
        try {
            const { targetUrl } = req.body;

            if (!targetUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Target URL is required'
                });
            }

            // Basic Facebook URL validation
            const facebookUrlPattern = /^https?:\/\/(www\.)?(facebook|fb)\.com\/.+/i;
            
            if (!facebookUrlPattern.test(targetUrl)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Facebook URL',
                    isValid: false
                });
            }

            const targetId = fbService.extractTargetId(targetUrl);

            res.json({
                success: true,
                message: 'Valid Facebook URL',
                isValid: true,
                targetId,
                url: targetUrl
            });

        } catch (error) {
            console.error('❌ Validate target URL error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to validate target URL',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
}

// Validation rules
const actionValidation = [
    body('actionType')
        .isIn(['like', 'love', 'haha', 'sad', 'angry', 'wow', 'follow', 'comment', 'unfollow', 'unlike'])
        .withMessage('Invalid action type'),
    body('targetUrl')
        .isURL({ protocols: ['http', 'https'] })
        .withMessage('Valid target URL is required')
        .custom((value) => {
            const facebookUrlPattern = /^https?:\/\/(www\.)?(facebook|fb)\.com\/.+/i;
            if (!facebookUrlPattern.test(value)) {
                throw new Error('Must be a Facebook URL');
            }
            return true;
        }),
    body('comment')
        .optional()
        .isLength({ max: 8000 })
        .withMessage('Comment must be less than 8000 characters'),
    body('selectedSessions')
        .optional()
        .isArray()
        .withMessage('Selected sessions must be an array')
];

const urlValidation = [
    body('targetUrl')
        .isURL({ protocols: ['http', 'https'] })
        .withMessage('Valid URL is required')
];

module.exports = {
    ActionController: new ActionController(),
    actionValidation,
    urlValidation
};