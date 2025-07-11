const puppeteer = require('puppeteer');
const UserAgent = require('user-agents');
const { FBSession, ActionHistory } = require('../models/User');

class FacebookService {
  constructor() {
    this.browsers = new Map(); // Store browser instances per session
  }

  /**
   * Simulate Facebook login and extract cookies
   */
  async loginWithCredentials(email, password) {
    let browser = null;
    let page = null;

    try {
      console.log('🔐 Starting Facebook login simulation...');
      
      // Launch browser with stealth settings
      browser = await puppeteer.launch({
        headless: process.env.NODE_ENV === 'production' ? 'new' : false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });

      page = await browser.newPage();
      
      // Set realistic user agent
      const userAgent = new UserAgent({ deviceCategory: 'desktop' });
      await page.setUserAgent(userAgent.toString());
      
      // Set viewport
      await page.setViewport({ width: 1366, height: 768 });

      // Navigate to Facebook login
      await page.goto('https://www.facebook.com/login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for login form
      await page.waitForSelector('#email', { timeout: 10000 });
      await page.waitForSelector('#pass', { timeout: 10000 });

      // Fill login form
      await page.type('#email', email, { delay: 100 });
      await page.type('#pass', password, { delay: 100 });

      // Submit form
      await Promise.all([
        page.click('button[name="login"], input[name="login"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
      ]);

      // Check if login was successful
      const currentUrl = page.url();
      
      if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
        throw new Error('Login failed - invalid credentials or security check required');
      }

      // Extract user info
      const fbUserId = await this.extractFacebookUserId(page);
      
      // Get all cookies
      const cookies = await page.cookies();
      const cookieString = this.serializeCookies(cookies);

      console.log('✅ Facebook login successful');
      
      return {
        success: true,
        fbUserId,
        cookies: cookieString,
        userAgent: userAgent.toString()
      };

    } catch (error) {
      console.error('❌ Facebook login error:', error.message);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Validate existing cookies by testing a Facebook request
   */
  async validateCookies(cookieString) {
    let browser = null;
    let page = null;

    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      page = await browser.newPage();
      
      // Set cookies
      const cookies = this.parseCookies(cookieString);
      await page.setCookie(...cookies);

      // Navigate to Facebook home
      await page.goto('https://www.facebook.com', {
        waitUntil: 'networkidle2',
        timeout: 15000
      });

      const currentUrl = page.url();
      
      // If redirected to login, cookies are invalid
      if (currentUrl.includes('login')) {
        return { valid: false };
      }

      // Try to extract user ID to confirm session is valid
      const fbUserId = await this.extractFacebookUserId(page);
      
      return {
        valid: true,
        fbUserId
      };

    } catch (error) {
      console.error('Cookie validation error:', error.message);
      return { valid: false };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Execute Facebook action (like, comment, follow, etc.)
   */
  async executeAction(sessionId, actionType, targetUrl, commentText = '', userAgent = '') {
    let browser = null;
    let page = null;

    try {
      // Get session from database
      const session = await FBSession.findById(sessionId);
      if (!session || !session.isActive) {
        throw new Error('Session not found or inactive');
      }

      // Validate session first
      const validation = await this.validateCookies(session.cookies);
      if (!validation.valid) {
        // Mark session as inactive
        await FBSession.findByIdAndUpdate(sessionId, { isActive: false });
        throw new Error('Session cookies are invalid or expired');
      }

      console.log(`🎯 Executing ${actionType} action on ${targetUrl}`);

      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      page = await browser.newPage();
      
      // Set user agent
      if (userAgent) {
        await page.setUserAgent(userAgent);
      }

      // Set cookies
      const cookies = this.parseCookies(session.cookies);
      await page.setCookie(...cookies);

      // Navigate to target URL
      await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      let result = { success: false, message: '' };

      // Execute specific action
      switch (actionType) {
        case 'like':
        case 'love':
        case 'haha':
        case 'wow':
        case 'sad':
        case 'angry':
          result = await this.executeReaction(page, actionType);
          break;
        
        case 'comment':
          result = await this.executeComment(page, commentText);
          break;
        
        case 'follow':
          result = await this.executeFollow(page);
          break;
        
        default:
          throw new Error(`Unsupported action type: ${actionType}`);
      }

      // Update session last used
      await FBSession.findByIdAndUpdate(sessionId, { lastUsed: new Date() });

      console.log(`✅ Action ${actionType} completed successfully`);
      return result;

    } catch (error) {
      console.error(`❌ Action execution error:`, error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Execute reaction (like, love, etc.)
   */
  async executeReaction(page, reactionType) {
    try {
      // Look for like button or reaction button
      const reactionSelectors = [
        '[aria-label*="Like"]',
        '[aria-label*="React"]',
        '[data-testid="UFI2ReactionLink"]',
        'a[role="button"][href*="reaction"]'
      ];

      let reactionButton = null;
      for (const selector of reactionSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          reactionButton = await page.$(selector);
          if (reactionButton) break;
        } catch (e) {
          continue;
        }
      }

      if (!reactionButton) {
        throw new Error('Reaction button not found on the page');
      }

      if (reactionType === 'like') {
        // Simple click for like
        await reactionButton.click();
      } else {
        // Long press for other reactions
        await reactionButton.hover();
        await page.waitForTimeout(1000);
        
        // Look for specific reaction in the popup
        const reactionSelectors = {
          love: '[aria-label*="Love"]',
          haha: '[aria-label*="Haha"]',
          wow: '[aria-label*="Wow"]',
          sad: '[aria-label*="Sad"]',
          angry: '[aria-label*="Angry"]'
        };

        const targetReaction = reactionSelectors[reactionType];
        if (targetReaction) {
          await page.waitForSelector(targetReaction, { timeout: 5000 });
          await page.click(targetReaction);
        } else {
          await reactionButton.click(); // Fallback to simple like
        }
      }

      await page.waitForTimeout(2000); // Wait for action to complete
      
      return {
        success: true,
        message: `${reactionType} reaction added successfully`
      };

    } catch (error) {
      throw new Error(`Failed to add ${reactionType} reaction: ${error.message}`);
    }
  }

  /**
   * Execute comment
   */
  async executeComment(page, commentText) {
    try {
      if (!commentText || commentText.trim().length === 0) {
        throw new Error('Comment text is required');
      }

      // Look for comment box
      const commentSelectors = [
        'div[contenteditable="true"][data-testid*="comment"]',
        'div[contenteditable="true"][aria-label*="comment"]',
        'textarea[placeholder*="comment"]',
        'div[role="textbox"]'
      ];

      let commentBox = null;
      for (const selector of commentSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          commentBox = await page.$(selector);
          if (commentBox) break;
        } catch (e) {
          continue;
        }
      }

      if (!commentBox) {
        throw new Error('Comment box not found on the page');
      }

      // Click and type comment
      await commentBox.click();
      await page.waitForTimeout(1000);
      await commentBox.type(commentText, { delay: 50 });

      // Submit comment
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000); // Wait for comment to post

      return {
        success: true,
        message: 'Comment posted successfully'
      };

    } catch (error) {
      throw new Error(`Failed to post comment: ${error.message}`);
    }
  }

  /**
   * Execute follow action
   */
  async executeFollow(page) {
    try {
      // Look for follow button
      const followSelectors = [
        '[aria-label*="Follow"]',
        'button:contains("Follow")',
        '[data-testid*="follow"]'
      ];

      let followButton = null;
      for (const selector of followSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          followButton = await page.$(selector);
          if (followButton) break;
        } catch (e) {
          continue;
        }
      }

      if (!followButton) {
        throw new Error('Follow button not found on the page');
      }

      await followButton.click();
      await page.waitForTimeout(2000);

      return {
        success: true,
        message: 'Followed successfully'
      };

    } catch (error) {
      throw new Error(`Failed to follow: ${error.message}`);
    }
  }

  /**
   * Extract Facebook User ID from page
   */
  async extractFacebookUserId(page) {
    try {
      // Try multiple methods to extract user ID
      const userId = await page.evaluate(() => {
        // Method 1: Check for user ID in page content
        const metaTags = document.querySelectorAll('meta');
        for (const meta of metaTags) {
          if (meta.getAttribute('property') === 'al:android:url') {
            const content = meta.getAttribute('content');
            const match = content.match(/fb:\/\/profile\/(\d+)/);
            if (match) return match[1];
          }
        }

        // Method 2: Check for user ID in scripts or data attributes
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const text = script.textContent;
          const match = text.match(/"userID":"(\d+)"/);
          if (match) return match[1];
        }

        // Method 3: Check for user ID in page URL or elements
        const profileLinks = document.querySelectorAll('a[href*="/profile.php?id="]');
        if (profileLinks.length > 0) {
          const href = profileLinks[0].href;
          const match = href.match(/id=(\d+)/);
          if (match) return match[1];
        }

        return null;
      });

      return userId || 'unknown';
    } catch (error) {
      console.error('Error extracting Facebook user ID:', error);
      return 'unknown';
    }
  }

  /**
   * Serialize cookies to string
   */
  serializeCookies(cookies) {
    return JSON.stringify(cookies);
  }

  /**
   * Parse cookies from string
   */
  parseCookies(cookieString) {
    try {
      return JSON.parse(cookieString);
    } catch (error) {
      console.error('Error parsing cookies:', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      await FBSession.cleanExpiredSessions();
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
    }
  }
}

module.exports = new FacebookService();