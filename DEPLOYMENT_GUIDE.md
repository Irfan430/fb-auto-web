# 🚀 Deployment Guide for Render.com

Complete guide to deploy Facebook Auto Tool on Render.com for production use.

## 📋 Prerequisites

1. **Render.com Account**: Sign up at [render.com](https://render.com)
2. **MongoDB Atlas**: Create cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
3. **GitHub Repository**: Push your code to GitHub
4. **Domain (Optional)**: Custom domain for production

## 🗄️ Database Setup (MongoDB Atlas)

### Step 1: Create MongoDB Cluster

1. **Visit MongoDB Atlas**: [cloud.mongodb.com](https://cloud.mongodb.com)
2. **Create Account** or sign in
3. **Create New Cluster**:
   - Choose **FREE** tier (M0 Sandbox)
   - Select **AWS** as cloud provider
   - Choose region closest to your users
   - Cluster name: `facebook-auto-tool`

### Step 2: Configure Database Access

1. **Database Access**:
   - Go to "Database Access" in left sidebar
   - Click "Add New Database User"
   - Authentication Method: **Password**
   - Username: `fbautotool`
   - Password: Generate secure password (save it!)
   - Database User Privileges: **Read and write to any database**

2. **Network Access**:
   - Go to "Network Access" in left sidebar
   - Click "Add IP Address"
   - Select **Allow access from anywhere** (0.0.0.0/0)
   - Comment: "Render.com deployment"

### Step 3: Get Connection String

1. **Connect to Cluster**:
   - Go to "Clusters" and click "Connect"
   - Choose "Connect your application"
   - Driver: **Node.js**, Version: **4.1 or later**
   - Copy connection string

2. **Format Connection String**:
   ```
   mongodb+srv://fbautotool:<password>@facebook-auto-tool.xxxxx.mongodb.net/facebook-auto-tool?retryWrites=true&w=majority
   ```
   Replace `<password>` with your database user password.

## 🚀 Render.com Deployment

### Step 1: Connect Repository

1. **Login to Render**: [dashboard.render.com](https://dashboard.render.com)
2. **Create New Web Service**:
   - Click "New" → "Web Service"
   - Connect your GitHub account
   - Select your `facebook-auto-tool` repository

### Step 2: Configure Service

#### Basic Settings
- **Name**: `facebook-auto-tool`
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty
- **Runtime**: `Node`

#### Build & Deploy Settings
- **Build Command**: `npm install`
- **Start Command**: `npm start`

#### Advanced Settings
- **Auto-Deploy**: `Yes` (deploys on git push)
- **Instance Type**: `Free` (for testing) or `Starter` (for production)

### Step 3: Environment Variables

Add these environment variables in Render dashboard:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://fbautotool:YOUR_PASSWORD@facebook-auto-tool.xxxxx.mongodb.net/facebook-auto-tool?retryWrites=true&w=majority
SESSION_SECRET=your-super-secret-session-key-min-32-chars
COOKIE_SECRET=your-cookie-secret-key-min-32-chars
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=30000
ENABLE_REGISTRATION=true
ENABLE_FB_LOGIN=true
ENABLE_COOKIE_IMPORT=true
MAX_SESSIONS_PER_USER=10
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Generate Secure Secrets
Use this command to generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Deploy

1. **Create Service**: Click "Create Web Service"
2. **Monitor Build**: Watch build logs in real-time
3. **Wait for Deployment**: Usually takes 2-5 minutes
4. **Get URL**: Copy your app URL (e.g., `https://facebook-auto-tool.onrender.com`)

## 🔧 Post-Deployment Configuration

### Step 1: Test Basic Functionality

1. **Health Check**:
   ```bash
   curl https://your-app.onrender.com/health
   ```

2. **Landing Page**: Visit your app URL

3. **Registration**: Create a test account

### Step 2: Configure Custom Domain (Optional)

1. **In Render Dashboard**:
   - Go to your service
   - Click "Settings" → "Custom Domains"
   - Add your domain (e.g., `fbautotool.com`)

2. **DNS Configuration**:
   - Add CNAME record: `www` → `your-app.onrender.com`
   - Add A record: `@` → Render's IP (provided in dashboard)

### Step 3: Enable HTTPS

Render automatically provides SSL certificates for custom domains. No additional configuration needed.

## 📊 Monitoring & Maintenance

### Application Monitoring

1. **Render Dashboard**:
   - Monitor CPU, Memory, and Request metrics
   - View application logs
   - Track deployment history

2. **Health Endpoints**:
   ```bash
   # Application health
   curl https://your-app.onrender.com/health
   
   # System status
   curl https://your-app.onrender.com/dashboard/system-status
   ```

### Database Monitoring

1. **MongoDB Atlas Dashboard**:
   - Monitor database performance
   - View connection metrics
   - Set up alerts for high usage

### Log Management

1. **View Logs in Render**:
   - Go to service dashboard
   - Click "Logs" tab
   - Filter by log level

2. **Application Logs**:
   ```bash
   # Stream live logs
   render logs --tail facebook-auto-tool
   ```

## 🔒 Security Best Practices

### Environment Security

1. **Secrets Management**:
   - Use Render's environment variables (encrypted at rest)
   - Never commit secrets to git
   - Rotate secrets regularly

2. **Database Security**:
   - Use strong, unique passwords
   - Enable MongoDB authentication
   - Regular security updates

### Application Security

1. **Rate Limiting**: Already configured in code
2. **Input Validation**: Built-in validation
3. **Session Security**: Secure cookie configuration
4. **HTTPS Only**: Enforced in production

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check package.json syntax
npm install --dry-run

# Verify Node.js version
node --version  # Should be 16+
```

#### MongoDB Connection Issues
1. **Check Connection String**: Ensure password and cluster name are correct
2. **Network Access**: Verify IP whitelist includes 0.0.0.0/0
3. **User Permissions**: Ensure database user has read/write access

#### Puppeteer Issues
1. **Add Chrome Dependencies**:
   - Create `render.yaml`:
   ```yaml
   services:
     - type: web
       name: facebook-auto-tool
       env: node
       buildCommand: npm install
       startCommand: npm start
       envVars:
         - key: PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
           value: "true"
         - key: PUPPETEER_EXECUTABLE_PATH
           value: "/usr/bin/google-chrome-stable"
   ```

2. **Alternative: Use External Chrome**:
   ```env
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
   ```

#### Performance Issues
1. **Upgrade Instance**: Move from Free to Starter tier
2. **Database Optimization**: Add indexes for frequently queried fields
3. **Connection Pooling**: Already configured in code

### Debug Commands

```bash
# Check environment variables
printenv | grep -E "(NODE_ENV|MONGODB_URI|SESSION_SECRET)"

# Test MongoDB connection
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));
"

# Test application startup
npm start
```

## 📈 Scaling & Optimization

### Performance Optimization

1. **Database Indexing**:
   ```javascript
   // Add to your MongoDB
   db.fbsessions.createIndex({ "fbUserId": 1, "isActive": 1 })
   db.actionhistories.createIndex({ "createdAt": -1 })
   ```

2. **Connection Pooling**: Already configured
3. **Caching**: Consider Redis for session caching

### Horizontal Scaling

1. **Multiple Instances**: Upgrade to paid plan for auto-scaling
2. **Load Balancing**: Render handles this automatically
3. **Database Clustering**: MongoDB Atlas supports replica sets

## 🔄 Maintenance

### Regular Tasks

1. **Weekly**:
   - Check application logs for errors
   - Monitor database performance
   - Review security logs

2. **Monthly**:
   - Update dependencies: `npm update`
   - Rotate session secrets
   - Clean up old action history

3. **Quarterly**:
   - Security audit
   - Performance review
   - Backup verification

### Automated Cleanup

The application includes automatic cleanup features:
- Expired sessions are removed automatically
- Old action history is cleaned up
- Failed sessions are marked inactive

## 📞 Support

### Getting Help

1. **Render Support**: [render.com/docs](https://render.com/docs)
2. **MongoDB Support**: [docs.mongodb.com](https://docs.mongodb.com)
3. **Application Issues**: Check GitHub repository issues

### Emergency Procedures

1. **Application Down**:
   - Check Render service status
   - Review recent deployments
   - Check MongoDB connectivity

2. **Database Issues**:
   - Verify MongoDB Atlas status
   - Check connection limits
   - Review network access rules

3. **High Load**:
   - Monitor Render metrics
   - Scale up instance if needed
   - Check for unusual traffic patterns

---

## ✅ Deployment Checklist

- [ ] MongoDB Atlas cluster created and configured
- [ ] Database user created with proper permissions
- [ ] Network access configured (0.0.0.0/0)
- [ ] Connection string obtained and tested
- [ ] GitHub repository connected to Render
- [ ] Environment variables configured in Render
- [ ] Build and start commands configured
- [ ] Initial deployment successful
- [ ] Health check endpoint responding
- [ ] User registration working
- [ ] Facebook session management functional
- [ ] Action execution working
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] Monitoring setup complete

🎉 **Congratulations!** Your Facebook Auto Tool is now live and ready for production use!

Visit your deployed application and start automating Facebook interactions securely and professionally.