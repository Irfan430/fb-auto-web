const moment = require('moment');
const { User, FBSession, ActionHistory } = require('../models/User');
const fbService = require('../services/fbService');

class DashboardController {
  /**
   * Render dashboard page
   */
  async renderDashboard(req, res) {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.redirect('/login.html');
      }

      const user = await User.findById(req.session.userId);
      if (!user) {
        req.session.destroy();
        return res.redirect('/login.html');
      }

      // Clean up expired sessions
      await fbService.cleanupExpiredSessions();

      // Get dashboard data
      const dashboardData = await this.getDashboardData(user._id);

      // Render dashboard with data
      res.render('dashboard', {
        user: {
          username: user.username,
          email: user.email
        },
        ...dashboardData,
        moment // Pass moment to template for date formatting
      });

    } catch (error) {
      console.error('Dashboard render error:', error);
      res.status(500).send('Internal server error');
    }
  }

  /**
   * Get dashboard data API endpoint
   */
  async getDashboardDataAPI(req, res) {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const dashboardData = await this.getDashboardData(req.session.userId);
      
      res.json({
        success: true,
        data: dashboardData
      });

    } catch (error) {
      console.error('Dashboard data API error:', error);
      res.status(500).json({ error: 'Failed to load dashboard data' });
    }
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(userId) {
    try {
      // Get user with Facebook sessions
      const user = await User.findById(userId).populate('fbSessions');

      // Get active Facebook sessions
      const activeSessions = await FBSession.find({
        _id: { $in: user.fbSessions },
        isActive: true,
        expiresAt: { $gt: new Date() }
      });

      // Get recent action history (last 10 actions)
      const recentActions = await ActionHistory.find()
        .populate('sessionId', 'fbUserId fbUsername')
        .sort({ createdAt: -1 })
        .limit(10);

      // Get action statistics for the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [
        totalActionsLast7Days,
        successfulActionsLast7Days,
        failedActionsLast7Days,
        actionsByType,
        totalSessions,
        activePendingActions
      ] = await Promise.all([
        ActionHistory.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        ActionHistory.countDocuments({ 
          createdAt: { $gte: sevenDaysAgo }, 
          status: 'success' 
        }),
        ActionHistory.countDocuments({ 
          createdAt: { $gte: sevenDaysAgo }, 
          status: 'failed' 
        }),
        ActionHistory.aggregate([
          { $match: { createdAt: { $gte: sevenDaysAgo } } },
          { $group: { _id: '$actionType', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        FBSession.countDocuments({ isActive: true }),
        ActionHistory.countDocuments({ status: 'pending' })
      ]);

      // Format session data
      const sessionData = activeSessions.map(session => ({
        id: session._id,
        fbUserId: session.fbUserId.substring(0, 4) + '****',
        fbUsername: session.fbUsername ? 
          session.fbUsername.replace(/(.{2}).*(@.*)/, '$1****$2') : 'N/A',
        isActive: session.isActive,
        lastUsed: session.lastUsed,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        timeUntilExpiry: this.formatTimeUntilExpiry(session.expiresAt)
      }));

      // Format action history
      const formattedActions = recentActions.map(action => ({
        id: action._id,
        sessionId: action.sessionId?._id,
        fbUserId: action.fbUserId ? action.fbUserId.substring(0, 4) + '****' : 'Unknown',
        actionType: action.actionType,
        targetUrl: this.truncateUrl(action.targetUrl),
        status: action.status,
        errorMessage: action.errorMessage,
        executedAt: action.executedAt,
        createdAt: action.createdAt,
        timeAgo: this.formatTimeAgo(action.createdAt)
      }));

      // Calculate success rate
      const successRate = totalActionsLast7Days > 0 ? 
        ((successfulActionsLast7Days / totalActionsLast7Days) * 100).toFixed(1) : 0;

      // Get daily action chart data (last 7 days)
      const dailyActions = await this.getDailyActionChart();

      return {
        sessions: sessionData,
        recentActions: formattedActions,
        stats: {
          totalSessions: totalSessions,
          activeSessions: activeSessions.length,
          totalActionsLast7Days,
          successfulActionsLast7Days,
          failedActionsLast7Days,
          successRate: `${successRate}%`,
          pendingActions: activePendingActions,
          actionsByType: actionsByType.map(item => ({
            type: item._id,
            count: item.count
          }))
        },
        charts: {
          dailyActions
        }
      };

    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get daily action chart data
   */
  async getDailyActionChart() {
    try {
      const last7Days = [];
      const now = new Date();

      // Generate last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const [successful, failed] = await Promise.all([
          ActionHistory.countDocuments({
            createdAt: { $gte: date, $lt: nextDay },
            status: 'success'
          }),
          ActionHistory.countDocuments({
            createdAt: { $gte: date, $lt: nextDay },
            status: 'failed'
          })
        ]);

        last7Days.push({
          date: date.toISOString().split('T')[0],
          label: moment(date).format('MMM DD'),
          successful,
          failed,
          total: successful + failed
        });
      }

      return last7Days;

    } catch (error) {
      console.error('Error getting daily action chart:', error);
      return [];
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus(req, res) {
    try {
      const [
        totalUsers,
        totalSessions,
        activeSessions,
        totalActions,
        pendingActions,
        recentErrors
      ] = await Promise.all([
        User.countDocuments({ isActive: true }),
        FBSession.countDocuments(),
        FBSession.countDocuments({ isActive: true, expiresAt: { $gt: new Date() } }),
        ActionHistory.countDocuments(),
        ActionHistory.countDocuments({ status: 'pending' }),
        ActionHistory.find({ status: 'failed' })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('errorMessage createdAt actionType')
      ]);

      const sessionHealth = totalSessions > 0 ? ((activeSessions / totalSessions) * 100).toFixed(1) : 0;

      res.json({
        success: true,
        system: {
          status: 'operational',
          uptime: process.uptime(),
          users: {
            total: totalUsers,
            active: totalUsers // Assuming all users are active for now
          },
          sessions: {
            total: totalSessions,
            active: activeSessions,
            health: `${sessionHealth}%`
          },
          actions: {
            total: totalActions,
            pending: pendingActions
          },
          recentErrors: recentErrors.map(error => ({
            type: error.actionType,
            message: error.errorMessage,
            time: error.createdAt
          }))
        }
      });

    } catch (error) {
      console.error('System status error:', error);
      res.status(500).json({ error: 'Failed to get system status' });
    }
  }

  /**
   * Cleanup dashboard - remove expired sessions and old actions
   */
  async cleanupDashboard(req, res) {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const [cleanupResult, oldActionsResult] = await Promise.all([
        // Clean expired sessions
        FBSession.cleanExpiredSessions(),
        
        // Remove action history older than 30 days
        ActionHistory.deleteMany({
          createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
      ]);

      console.log(`🧹 Cleanup completed: ${cleanupResult.deletedCount} sessions, ${oldActionsResult.deletedCount} old actions`);

      res.json({
        success: true,
        message: 'Cleanup completed successfully',
        cleaned: {
          expiredSessions: cleanupResult.deletedCount,
          oldActions: oldActionsResult.deletedCount
        }
      });

    } catch (error) {
      console.error('Cleanup dashboard error:', error);
      res.status(500).json({ error: 'Cleanup failed' });
    }
  }

  /**
   * Format time until expiry
   */
  formatTimeUntilExpiry(expiryDate) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry - now;

    if (diffMs <= 0) {
      return 'Expired';
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${minutes}m`;
    }
  }

  /**
   * Format time ago
   */
  formatTimeAgo(date) {
    return moment(date).fromNow();
  }

  /**
   * Truncate URL for display
   */
  truncateUrl(url, maxLength = 50) {
    if (url.length <= maxLength) {
      return url;
    }
    return url.substring(0, maxLength) + '...';
  }
}

module.exports = new DashboardController();