/**
 * Dashboard Controller
 * Handles dashboard data, user overview, and system status
 */

const User = require('../models/User');
const { checkDBHealth } = require('../config/db');

class DashboardController {
    /**
     * Get dashboard overview data
     */
    async getDashboardOverview(req, res) {
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

            // Calculate recent activity (last 24 hours)
            const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentActions = user.actionHistory.filter(
                action => new Date(action.timestamp) >= last24Hours
            );

            // Get active sessions with masked IDs
            const activeSessions = user.activeFacebookSessions.map(session => ({
                fbId: User.maskFacebookId(session.fbId),
                fbName: session.fbName,
                lastUsed: session.lastUsed,
                expiresAt: session.expiresAt,
                isActive: session.isActive,
                createdAt: session.createdAt
            }));

            // Get recent action history (last 10 actions)
            const recentActionHistory = user.actionHistory
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10)
                .map(action => ({
                    actionId: action.actionId,
                    actionType: action.actionType,
                    targetUrl: action.targetUrl,
                    maskedFbId: action.maskedFbId,
                    status: action.status,
                    comment: action.comment ? action.comment.substring(0, 100) + '...' : null,
                    timestamp: action.timestamp,
                    executionTime: action.executionTime
                }));

            // Calculate action statistics by type
            const actionsByType = {};
            user.actionHistory.forEach(action => {
                if (!actionsByType[action.actionType]) {
                    actionsByType[action.actionType] = {
                        total: 0,
                        successful: 0,
                        failed: 0
                    };
                }
                actionsByType[action.actionType].total++;
                if (action.status === 'success') {
                    actionsByType[action.actionType].successful++;
                } else if (action.status === 'failed') {
                    actionsByType[action.actionType].failed++;
                }
            });

            const overview = {
                user: {
                    userId: user.userId,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive,
                    createdAt: user.createdAt,
                    lastLoginDate: user.statistics.lastLoginDate,
                    loginCount: user.statistics.loginCount
                },
                sessions: {
                    active: activeSessions,
                    total: activeSessions.length,
                    maxAllowed: user.settings.maxSessions
                },
                statistics: {
                    total: user.statistics,
                    recent24h: {
                        total: recentActions.length,
                        successful: recentActions.filter(a => a.status === 'success').length,
                        failed: recentActions.filter(a => a.status === 'failed').length
                    },
                    byActionType: actionsByType
                },
                recentActions: recentActionHistory,
                settings: user.settings
            };

            res.json({
                success: true,
                overview
            });

        } catch (error) {
            console.error('❌ Get dashboard overview error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get dashboard overview',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Get system status and health
     */
    async getSystemStatus(req, res) {
        try {
            // Check database health
            const dbHealth = await checkDBHealth();
            
            // Memory usage
            const memoryUsage = process.memoryUsage();
            
            // Uptime
            const uptime = process.uptime();
            
            // Environment info
            const envInfo = {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                environment: process.env.NODE_ENV || 'development'
            };

            // System statistics (if user is admin)
            let systemStats = null;
            if (req.session.user && req.session.user.role === 'admin') {
                const totalUsers = await User.countDocuments();
                const activeUsers = await User.countDocuments({ isActive: true });
                const totalSessions = await User.aggregate([
                    { $match: { isActive: true } },
                    { $project: { sessionCount: { $size: '$facebookSessions' } } },
                    { $group: { _id: null, total: { $sum: '$sessionCount' } } }
                ]);
                
                const totalActions = await User.aggregate([
                    { $match: { isActive: true } },
                    { $project: { actionCount: { $size: '$actionHistory' } } },
                    { $group: { _id: null, total: { $sum: '$actionCount' } } }
                ]);

                systemStats = {
                    users: {
                        total: totalUsers,
                        active: activeUsers
                    },
                    sessions: {
                        total: totalSessions[0]?.total || 0
                    },
                    actions: {
                        total: totalActions[0]?.total || 0
                    }
                };
            }

            const status = {
                server: {
                    status: 'online',
                    uptime: uptime,
                    memory: {
                        used: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
                        total: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
                        external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100
                    },
                    environment: envInfo
                },
                database: dbHealth,
                system: systemStats,
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                status
            });

        } catch (error) {
            console.error('❌ Get system status error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get system status',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Update user settings
     */
    async updateSettings(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const { autoCleanup, maxSessions, notificationEmail } = req.body;

            const user = await User.findOne({ userId: req.session.userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Update settings
            if (typeof autoCleanup === 'boolean') {
                user.settings.autoCleanup = autoCleanup;
            }
            
            if (maxSessions && maxSessions >= 1 && maxSessions <= 50) {
                user.settings.maxSessions = maxSessions;
                
                // Enforce max sessions if reduced
                if (user.facebookSessions.length > maxSessions) {
                    user.facebookSessions = user.facebookSessions
                        .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
                        .slice(0, maxSessions);
                }
            }
            
            if (notificationEmail !== undefined) {
                user.settings.notificationEmail = notificationEmail;
            }

            await user.save();

            console.log(`⚙️ Settings updated for user: ${req.session.userId}`);

            res.json({
                success: true,
                message: 'Settings updated successfully',
                settings: user.settings
            });

        } catch (error) {
            console.error('❌ Update settings error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update settings',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Get action analytics
     */
    async getActionAnalytics(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const { period = '7d' } = req.query;

            const user = await User.findOne({ userId: req.session.userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Calculate date range based on period
            const now = new Date();
            let startDate;
            
            switch (period) {
                case '24h':
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case '90d':
                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }

            // Filter actions by date range
            const periodActions = user.actionHistory.filter(
                action => new Date(action.timestamp) >= startDate
            );

            // Group actions by day
            const actionsByDay = {};
            periodActions.forEach(action => {
                const day = new Date(action.timestamp).toISOString().split('T')[0];
                if (!actionsByDay[day]) {
                    actionsByDay[day] = {
                        total: 0,
                        successful: 0,
                        failed: 0,
                        byType: {}
                    };
                }
                
                actionsByDay[day].total++;
                if (action.status === 'success') {
                    actionsByDay[day].successful++;
                } else if (action.status === 'failed') {
                    actionsByDay[day].failed++;
                }
                
                if (!actionsByDay[day].byType[action.actionType]) {
                    actionsByDay[day].byType[action.actionType] = 0;
                }
                actionsByDay[day].byType[action.actionType]++;
            });

            // Calculate success rate
            const totalPeriodActions = periodActions.length;
            const successfulPeriodActions = periodActions.filter(a => a.status === 'success').length;
            const successRate = totalPeriodActions > 0 ? 
                Math.round((successfulPeriodActions / totalPeriodActions) * 100) : 0;

            // Top performing sessions
            const sessionPerformance = {};
            periodActions.forEach(action => {
                if (!sessionPerformance[action.maskedFbId]) {
                    sessionPerformance[action.maskedFbId] = {
                        total: 0,
                        successful: 0,
                        failed: 0
                    };
                }
                
                sessionPerformance[action.maskedFbId].total++;
                if (action.status === 'success') {
                    sessionPerformance[action.maskedFbId].successful++;
                } else if (action.status === 'failed') {
                    sessionPerformance[action.maskedFbId].failed++;
                }
            });

            const analytics = {
                period,
                dateRange: {
                    start: startDate.toISOString(),
                    end: now.toISOString()
                },
                summary: {
                    totalActions: totalPeriodActions,
                    successfulActions: successfulPeriodActions,
                    failedActions: totalPeriodActions - successfulPeriodActions,
                    successRate: successRate
                },
                timeline: actionsByDay,
                sessionPerformance: Object.entries(sessionPerformance)
                    .map(([fbId, stats]) => ({ fbId, ...stats }))
                    .sort((a, b) => b.successful - a.successful)
                    .slice(0, 10)
            };

            res.json({
                success: true,
                analytics
            });

        } catch (error) {
            console.error('❌ Get action analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get action analytics',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Export user data
     */
    async exportUserData(req, res) {
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

            // Prepare export data (excluding sensitive info)
            const exportData = {
                user: {
                    userId: user.userId,
                    email: user.email,
                    role: user.role,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                },
                settings: user.settings,
                statistics: user.statistics,
                facebookSessions: user.facebookSessions.map(session => ({
                    fbId: User.maskFacebookId(session.fbId),
                    fbName: session.fbName,
                    isActive: session.isActive,
                    lastUsed: session.lastUsed,
                    expiresAt: session.expiresAt,
                    createdAt: session.createdAt
                    // Note: cookies and userAgent excluded for security
                })),
                actionHistory: user.actionHistory.map(action => ({
                    actionId: action.actionId,
                    actionType: action.actionType,
                    targetUrl: action.targetUrl,
                    targetId: action.targetId,
                    maskedFbId: action.maskedFbId,
                    comment: action.comment,
                    status: action.status,
                    errorMessage: action.errorMessage,
                    executionTime: action.executionTime,
                    timestamp: action.timestamp
                    // Note: fbSessionId excluded for security
                })),
                exportedAt: new Date().toISOString()
            };

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="facebook-auto-tool-export-${user.userId}-${Date.now()}.json"`);
            
            res.json(exportData);

            console.log(`📤 Data exported for user: ${req.session.userId}`);

        } catch (error) {
            console.error('❌ Export user data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export user data',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
}

module.exports = new DashboardController();