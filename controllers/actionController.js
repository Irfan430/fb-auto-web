const validator = require('validator');
const { v4: uuidv4 } = require('uuid');
const { FBSession, ActionHistory } = require('../models/User');
const fbService = require('../services/fbService');

class ActionController {
  /**
   * Execute Facebook action
   */
  async executeAction(req, res) {
    try {
      const { actionType, targetUrl, targetUid, commentText, sessionId } = req.body;
      const userIp = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      // Validation
      if (!actionType || !targetUrl) {
        return res.status(400).json({ error: 'Action type and target URL are required' });
      }

      const validActions = ['like', 'love', 'haha', 'wow', 'sad', 'angry', 'follow', 'comment'];
      if (!validActions.includes(actionType)) {
        return res.status(400).json({ error: 'Invalid action type' });
      }

      // Validate URL
      if (!validator.isURL(targetUrl, { protocols: ['http', 'https'] })) {
        return res.status(400).json({ error: 'Invalid target URL' });
      }

      // Check if URL is Facebook URL
      if (!targetUrl.includes('facebook.com') && !targetUrl.includes('fb.com')) {
        return res.status(400).json({ error: 'Target URL must be a Facebook URL' });
      }

      // For comment action, comment text is required
      if (actionType === 'comment' && (!commentText || commentText.trim().length === 0)) {
        return res.status(400).json({ error: 'Comment text is required for comment action' });
      }

      // Get available sessions
      let sessionsToUse = [];
      
      if (sessionId) {
        // Use specific session
        const session = await FBSession.findOne({ 
          _id: sessionId, 
          isActive: true,
          expiresAt: { $gt: new Date() }
        });
        
        if (!session) {
          return res.status(400).json({ error: 'Selected session is not available' });
        }
        
        sessionsToUse = [session];
      } else {
        // Use all available active sessions
        sessionsToUse = await FBSession.find({ 
          isActive: true,
          expiresAt: { $gt: new Date() }
        }).limit(5); // Limit to 5 sessions to avoid overwhelming
        
        if (sessionsToUse.length === 0) {
          return res.status(400).json({ error: 'No active Facebook sessions available' });
        }
      }

      console.log(`🎯 Executing ${actionType} action on ${targetUrl} using ${sessionsToUse.length} session(s)`);

      const results = [];
      const actionPromises = [];

      // Execute action for each session
      for (const session of sessionsToUse) {
        const actionPromise = this.executeActionForSession({
          session,
          actionType,
          targetUrl,
          targetUid,
          commentText,
          userIp,
          userAgent
        });
        
        actionPromises.push(actionPromise);
      }

      // Wait for all actions to complete
      const actionResults = await Promise.allSettled(actionPromises);

      // Process results
      for (let i = 0; i < actionResults.length; i++) {
        const result = actionResults[i];
        const session = sessionsToUse[i];
        
        if (result.status === 'fulfilled') {
          results.push({
            sessionId: session._id,
            fbUserId: session.fbUserId.substring(0, 4) + '****',
            status: 'success',
            message: result.value.message
          });
        } else {
          results.push({
            sessionId: session._id,
            fbUserId: session.fbUserId.substring(0, 4) + '****',
            status: 'failed',
            error: result.reason.message
          });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      console.log(`✅ Action completed: ${successCount} successful, ${failedCount} failed`);

      res.json({
        success: successCount > 0,
        message: `Action executed: ${successCount} successful, ${failedCount} failed`,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failedCount
        }
      });

    } catch (error) {
      console.error('Execute action error:', error);
      res.status(500).json({ error: 'Failed to execute action' });
    }
  }

  /**
   * Execute action for a single session
   */
  async executeActionForSession({ session, actionType, targetUrl, targetUid, commentText, userIp, userAgent }) {
    const actionId = uuidv4();
    
    try {
      // Create action history record
      const actionHistory = new ActionHistory({
        sessionId: session._id,
        fbUserId: session.fbUserId,
        actionType,
        targetUrl,
        targetUid: targetUid || '',
        commentText: commentText || '',
        status: 'pending',
        ipAddress: userIp,
        userAgent
      });
      
      await actionHistory.save();

      console.log(`🚀 [${actionId}] Starting ${actionType} action for session ${session._id}`);

      // Execute the action using Facebook service
      const result = await fbService.executeAction(
        session._id,
        actionType,
        targetUrl,
        commentText,
        session.userAgent
      );

      // Update action history with success
      actionHistory.status = 'success';
      actionHistory.executedAt = new Date();
      await actionHistory.save();

      console.log(`✅ [${actionId}] Action completed successfully`);
      
      return { success: true, message: result.message };

    } catch (error) {
      console.error(`❌ [${actionId}] Action failed:`, error.message);
      
      // Update action history with failure
      try {
        await ActionHistory.findOneAndUpdate(
          { sessionId: session._id, actionType, targetUrl, status: 'pending' },
          { 
            status: 'failed', 
            errorMessage: error.message,
            executedAt: new Date()
          },
          { sort: { createdAt: -1 } }
        );
      } catch (updateError) {
        console.error('Failed to update action history:', updateError);
      }

      throw error;
    }
  }

  /**
   * Get action history
   */
  async getActionHistory(req, res) {
    try {
      const { page = 1, limit = 20, sessionId, actionType, status } = req.query;
      const skip = (page - 1) * limit;

      // Build filter
      const filter = {};
      if (sessionId) filter.sessionId = sessionId;
      if (actionType) filter.actionType = actionType;
      if (status) filter.status = status;

      // Get total count
      const total = await ActionHistory.countDocuments(filter);

      // Get actions with pagination
      const actions = await ActionHistory.find(filter)
        .populate('sessionId', 'fbUserId fbUsername')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Format response
      const formattedActions = actions.map(action => ({
        id: action._id,
        sessionId: action.sessionId?._id,
        fbUserId: action.fbUserId ? action.fbUserId.substring(0, 4) + '****' : 'Unknown',
        fbUsername: action.sessionId?.fbUsername ? 
          action.sessionId.fbUsername.replace(/(.{2}).*(@.*)/, '$1****$2') : '',
        actionType: action.actionType,
        targetUrl: action.targetUrl,
        targetUid: action.targetUid,
        commentText: action.commentText ? action.commentText.substring(0, 50) + '...' : '',
        status: action.status,
        errorMessage: action.errorMessage,
        executedAt: action.executedAt,
        createdAt: action.createdAt
      }));

      res.json({
        success: true,
        actions: formattedActions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get action history error:', error);
      res.status(500).json({ error: 'Failed to retrieve action history' });
    }
  }

  /**
   * Get action statistics
   */
  async getActionStats(req, res) {
    try {
      const { timeframe = '7d' } = req.query; // 24h, 7d, 30d
      
      let dateFilter = {};
      const now = new Date();
      
      switch (timeframe) {
        case '24h':
          dateFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
          break;
        case '7d':
          dateFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
          break;
        case '30d':
          dateFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
          break;
        default:
          dateFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
      }

      // Get action statistics
      const [
        totalActions,
        successfulActions,
        failedActions,
        actionsByType,
        recentActions
      ] = await Promise.all([
        ActionHistory.countDocuments(dateFilter),
        ActionHistory.countDocuments({ ...dateFilter, status: 'success' }),
        ActionHistory.countDocuments({ ...dateFilter, status: 'failed' }),
        ActionHistory.aggregate([
          { $match: dateFilter },
          { $group: { _id: '$actionType', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        ActionHistory.find(dateFilter)
          .sort({ createdAt: -1 })
          .limit(5)
          .select('actionType targetUrl status createdAt')
      ]);

      const successRate = totalActions > 0 ? ((successfulActions / totalActions) * 100).toFixed(2) : 0;

      res.json({
        success: true,
        stats: {
          timeframe,
          total: totalActions,
          successful: successfulActions,
          failed: failedActions,
          successRate: `${successRate}%`,
          actionsByType: actionsByType.map(item => ({
            type: item._id,
            count: item.count
          })),
          recentActions: recentActions.map(action => ({
            type: action.actionType,
            url: action.targetUrl.length > 50 ? action.targetUrl.substring(0, 50) + '...' : action.targetUrl,
            status: action.status,
            time: action.createdAt
          }))
        }
      });

    } catch (error) {
      console.error('Get action stats error:', error);
      res.status(500).json({ error: 'Failed to retrieve action statistics' });
    }
  }

  /**
   * Cancel pending actions
   */
  async cancelPendingActions(req, res) {
    try {
      const result = await ActionHistory.updateMany(
        { status: 'pending' },
        { 
          status: 'failed', 
          errorMessage: 'Cancelled by user',
          executedAt: new Date()
        }
      );

      console.log(`🚫 Cancelled ${result.modifiedCount} pending actions`);

      res.json({
        success: true,
        message: `${result.modifiedCount} pending actions cancelled`
      });

    } catch (error) {
      console.error('Cancel actions error:', error);
      res.status(500).json({ error: 'Failed to cancel pending actions' });
    }
  }

  /**
   * Validate target URL
   */
  async validateTargetUrl(req, res) {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      // Basic URL validation
      if (!validator.isURL(url, { protocols: ['http', 'https'] })) {
        return res.json({ 
          valid: false, 
          error: 'Invalid URL format' 
        });
      }

      // Check if it's a Facebook URL
      if (!url.includes('facebook.com') && !url.includes('fb.com')) {
        return res.json({ 
          valid: false, 
          error: 'URL must be a Facebook URL' 
        });
      }

      // Extract potential UID from URL
      let extractedUid = '';
      const uidMatch = url.match(/(?:profile\.php\?id=|posts\/|groups\/)(\d+)/);
      if (uidMatch) {
        extractedUid = uidMatch[1];
      }

      res.json({
        valid: true,
        url,
        extractedUid,
        type: this.detectUrlType(url)
      });

    } catch (error) {
      console.error('URL validation error:', error);
      res.status(500).json({ error: 'Failed to validate URL' });
    }
  }

  /**
   * Detect Facebook URL type
   */
  detectUrlType(url) {
    if (url.includes('/posts/') || url.includes('/post/')) {
      return 'post';
    } else if (url.includes('/groups/')) {
      return 'group';
    } else if (url.includes('/pages/')) {
      return 'page';
    } else if (url.includes('/profile.php') || url.includes('/people/')) {
      return 'profile';
    } else if (url.includes('/photos/')) {
      return 'photo';
    } else if (url.includes('/videos/')) {
      return 'video';
    } else {
      return 'unknown';
    }
  }
}

module.exports = new ActionController();