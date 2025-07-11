/**
 * Facebook Service - Handles all Facebook automation and API interactions
 * Uses Puppeteer for browser automation and cookie management
 */

const puppeteer = require('puppeteer');
const User = require('../models/User');

class FacebookService {
    constructor() {
        this.browsers = new Map(); // Store browser instances
        this.browserOptions = {
            headless: process.env.NODE_ENV === 'production' ? 'new' : false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ],
            defaultViewport: {
                width: 1366,
                height: 768
            }
        };
    }

    /**
     * Initialize browser instance
     */
    async initBrowser() {
        try {
            const browser = await puppeteer.launch(this.browserOptions);
            console.log('🌐 Browser initialized successfully');
            return browser;
        } catch (error) {
            console.error('❌ Failed to initialize browser:', error);
            throw new Error('Browser initialization failed');
        }
    }

    /**
     * Create new page with Facebook cookies
     */
    async createPageWithCookies(browser, cookies, userAgent) {
        try {
            const page = await browser.newPage();
            
            // Set user agent
            if (userAgent) {
                await page.setUserAgent(userAgent);
            }
            
            // Set viewport
            await page.setViewport({ width: 1366, height: 768 });
            
            // Parse and set cookies
            if (cookies) {
                const cookieArray = this.parseCookies(cookies);
                if (cookieArray.length > 0) {
                    await page.setCookie(...cookieArray);
                }
            }
            
            return page;
        } catch (error) {
            console.error('❌ Failed to create page with cookies:', error);
            throw error;
        }
    }

    /**
     * Parse cookie string into Puppeteer format
     */
    parseCookies(cookieString) {
        try {
            if (!cookieString) return [];
            
            return cookieString.split(';').map(cookie => {
                const [nameValue, ...attributes] = cookie.trim().split(';');
                const [name, value] = nameValue.split('=');
                
                const cookieObj = {
                    name: name?.trim(),
                    value: value?.trim() || '',
                    domain: '.facebook.com',
                    path: '/',
                    httpOnly: false,
                    secure: true,
                    sameSite: 'Lax'
                };
                
                // Parse additional attributes
                attributes.forEach(attr => {
                    const [key, val] = attr.trim().split('=');
                    if (key) {
                        switch (key.toLowerCase()) {
                            case 'domain':
                                cookieObj.domain = val || '.facebook.com';
                                break;
                            case 'path':
                                cookieObj.path = val || '/';
                                break;
                            case 'httponly':
                                cookieObj.httpOnly = true;
                                break;
                            case 'secure':
                                cookieObj.secure = true;
                                break;
                        }
                    }
                });
                
                return cookieObj;
            }).filter(cookie => cookie.name && cookie.value);
        } catch (error) {
            console.error('❌ Failed to parse cookies:', error);
            return [];
        }
    }

    /**
     * Login to Facebook using credentials
     */
    async loginWithCredentials(email, password) {
        const browser = await this.initBrowser();
        let page;
        
        try {
            page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Navigate to Facebook login
            await page.goto('https://www.facebook.com/login', { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Fill login form
            await page.waitForSelector('#email', { timeout: 10000 });
            await page.type('#email', email, { delay: 100 });
            
            await page.waitForSelector('#pass', { timeout: 10000 });
            await page.type('#pass', password, { delay: 100 });
            
            // Submit form
            await page.click('[name="login"]');
            
            // Wait for navigation
            await page.waitForNavigation({ 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Check if login was successful
            const currentUrl = page.url();
            if (currentUrl.includes('checkpoint') || currentUrl.includes('login')) {
                throw new Error('Login failed - check credentials or account restrictions');
            }
            
            // Extract user info
            const userInfo = await this.extractUserInfo(page);
            
            // Get cookies
            const cookies = await page.cookies();
            const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
            
            await browser.close();
            
            return {
                success: true,
                fbId: userInfo.id,
                fbName: userInfo.name,
                cookies: cookieString,
                userAgent: await page.evaluate(() => navigator.userAgent)
            };
            
        } catch (error) {
            if (page) await page.close();
            await browser.close();
            throw error;
        }
    }

    /**
     * Extract user information from Facebook page
     */
    async extractUserInfo(page) {
        try {
            // Try to get user ID from various sources
            let userId = null;
            let userName = 'Unknown User';
            
            // Method 1: From profile link
            try {
                const profileLink = await page.$eval('a[href*="/profile.php?id="]', el => el.href);
                const match = profileLink.match(/id=(\d+)/);
                if (match) userId = match[1];
            } catch (e) {}
            
            // Method 2: From data attributes
            if (!userId) {
                try {
                    userId = await page.evaluate(() => {
                        const userDiv = document.querySelector('[data-userid]');
                        return userDiv ? userDiv.dataset.userid : null;
                    });
                } catch (e) {}
            }
            
            // Method 3: From page source
            if (!userId) {
                try {
                    const content = await page.content();
                    const match = content.match(/"USER_ID":"(\d+)"/);
                    if (match) userId = match[1];
                } catch (e) {}
            }
            
            // Get user name
            try {
                userName = await page.$eval('[data-testid="left_nav_item_profile"] span', el => el.textContent) ||
                          await page.$eval('a[aria-label*="profile"]', el => el.getAttribute('aria-label')) ||
                          'Unknown User';
            } catch (e) {}
            
            return {
                id: userId || `temp_${Date.now()}`,
                name: userName.replace(/\s+profile$/, '').trim()
            };
            
        } catch (error) {
            console.error('❌ Failed to extract user info:', error);
            return {
                id: `temp_${Date.now()}`,
                name: 'Unknown User'
            };
        }
    }

    /**
     * Validate Facebook session by checking cookies
     */
    async validateSession(cookies, userAgent) {
        const browser = await this.initBrowser();
        let page;
        
        try {
            page = await this.createPageWithCookies(browser, cookies, userAgent);
            
            // Try to access Facebook homepage
            await page.goto('https://www.facebook.com', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            // Check if redirected to login page
            const currentUrl = page.url();
            const isValid = !currentUrl.includes('login') && !currentUrl.includes('checkpoint');
            
            let userInfo = null;
            if (isValid) {
                userInfo = await this.extractUserInfo(page);
            }
            
            await browser.close();
            
            return {
                isValid,
                userInfo
            };
            
        } catch (error) {
            if (page) await page.close();
            await browser.close();
            console.error('❌ Session validation failed:', error);
            return { isValid: false, userInfo: null };
        }
    }

    /**
     * Perform Facebook action (like, react, follow, comment)
     */
    async performAction(actionType, targetUrl, cookies, userAgent, comment = null) {
        const browser = await this.initBrowser();
        let page;
        const startTime = Date.now();
        
        try {
            page = await this.createPageWithCookies(browser, cookies, userAgent);
            
            // Navigate to target URL
            await page.goto(targetUrl, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            // Check if page loaded successfully
            const currentUrl = page.url();
            if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
                throw new Error('Session expired or invalid');
            }
            
            let result;
            switch (actionType.toLowerCase()) {
                case 'like':
                    result = await this.performLike(page);
                    break;
                case 'love':
                case 'haha':
                case 'sad':
                case 'angry':
                case 'wow':
                    result = await this.performReaction(page, actionType);
                    break;
                case 'follow':
                    result = await this.performFollow(page);
                    break;
                case 'comment':
                    result = await this.performComment(page, comment);
                    break;
                default:
                    throw new Error(`Unsupported action type: ${actionType}`);
            }
            
            await browser.close();
            
            return {
                success: true,
                executionTime: Date.now() - startTime,
                result
            };
            
        } catch (error) {
            if (page) await page.close();
            await browser.close();
            
            return {
                success: false,
                executionTime: Date.now() - startTime,
                error: error.message
            };
        }
    }

    /**
     * Perform like action
     */
    async performLike(page) {
        try {
            // Multiple selectors for like button
            const likeSelectors = [
                '[data-testid="like_button"]',
                '[aria-label*="Like"]',
                'span:contains("Like")',
                '[role="button"]:contains("Like")'
            ];
            
            for (const selector of likeSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 5000 });
                    await page.click(selector);
                    await page.waitForTimeout(2000);
                    return 'Like action completed';
                } catch (e) {
                    continue;
                }
            }
            
            throw new Error('Like button not found');
        } catch (error) {
            throw new Error(`Failed to perform like: ${error.message}`);
        }
    }

    /**
     * Perform reaction (love, haha, sad, etc.)
     */
    async performReaction(page, reactionType) {
        try {
            // First, hover over like button to show reactions
            const likeButton = await page.$('[data-testid="like_button"]') || 
                              await page.$('[aria-label*="Like"]');
            
            if (!likeButton) {
                throw new Error('Like button not found');
            }
            
            await likeButton.hover();
            await page.waitForTimeout(1000);
            
            // Click on specific reaction
            const reactionSelector = `[aria-label*="${reactionType}"]`;
            await page.waitForSelector(reactionSelector, { timeout: 5000 });
            await page.click(reactionSelector);
            await page.waitForTimeout(2000);
            
            return `${reactionType} reaction completed`;
        } catch (error) {
            throw new Error(`Failed to perform ${reactionType} reaction: ${error.message}`);
        }
    }

    /**
     * Perform follow action
     */
    async performFollow(page) {
        try {
            const followSelectors = [
                '[data-testid="follow_button"]',
                '[aria-label*="Follow"]',
                'span:contains("Follow")',
                '[role="button"]:contains("Follow")'
            ];
            
            for (const selector of followSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 5000 });
                    await page.click(selector);
                    await page.waitForTimeout(2000);
                    return 'Follow action completed';
                } catch (e) {
                    continue;
                }
            }
            
            throw new Error('Follow button not found');
        } catch (error) {
            throw new Error(`Failed to perform follow: ${error.message}`);
        }
    }

    /**
     * Perform comment action
     */
    async performComment(page, commentText) {
        try {
            if (!commentText || commentText.trim().length === 0) {
                throw new Error('Comment text is required');
            }
            
            // Find comment input
            const commentSelectors = [
                '[data-testid="comment_input"]',
                '[placeholder*="comment"]',
                '[aria-label*="comment"]',
                'textarea[placeholder*="comment"]'
            ];
            
            let commentInput = null;
            for (const selector of commentSelectors) {
                try {
                    commentInput = await page.$(selector);
                    if (commentInput) break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!commentInput) {
                throw new Error('Comment input not found');
            }
            
            // Type comment
            await commentInput.click();
            await page.waitForTimeout(1000);
            await commentInput.type(commentText, { delay: 100 });
            await page.waitForTimeout(1000);
            
            // Submit comment
            await page.keyboard.press('Enter');
            await page.waitForTimeout(3000);
            
            return `Comment posted: ${commentText.substring(0, 50)}...`;
        } catch (error) {
            throw new Error(`Failed to post comment: ${error.message}`);
        }
    }

    /**
     * Extract target ID from URL
     */
    extractTargetId(url) {
        try {
            // Facebook post URL patterns
            const patterns = [
                /\/posts\/(\d+)/,
                /\/photos\/.*\/(\d+)/,
                /story_fbid=(\d+)/,
                /\/(\d+)\/posts\/(\d+)/,
                /profile\.php\?id=(\d+)/
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) {
                    return match[1] || match[2];
                }
            }
            
            // Fallback: generate ID from URL
            return Buffer.from(url).toString('base64').substring(0, 16);
        } catch (error) {
            return `url_${Date.now()}`;
        }
    }

    /**
     * Clean up browser instances
     */
    async cleanup() {
        try {
            for (const [key, browser] of this.browsers) {
                await browser.close();
                this.browsers.delete(key);
            }
            console.log('🧹 Browser cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
    }
}

module.exports = new FacebookService();