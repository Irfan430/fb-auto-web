# 🚀 Facebook Auto Tool

**Professional Facebook automation platform** with secure session management, enterprise-grade security, and comprehensive analytics. Built with Node.js, Express, MongoDB, and Puppeteer.

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4.4%2B-green.svg)](https://mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Production Ready](https://img.shields.io/badge/Production-Ready-brightgreen.svg)]()

## ✨ Features

### 🔐 **Secure Authentication**
- User registration and login system
- Facebook session management via Puppeteer simulation
- Cookie-based session import
- Secure session storage with encryption
- Automatic session validation and cleanup

### 🤖 **Smart Automation**
- **Reactions**: Like, Love, Haha, Wow, Sad, Angry
- **Social Actions**: Follow users, Comment on posts
- **Multi-Account Support**: Manage multiple Facebook accounts
- **Batch Operations**: Execute actions across multiple sessions
- **Smart Targeting**: URL validation and UID extraction

### 📊 **Analytics & Monitoring**
- Real-time action statistics
- Success rate tracking
- Session health monitoring
- Action history with pagination
- Performance metrics and charts

### 🛡️ **Enterprise Security**
- HTTPS/SSL encryption
- Secure cookie handling
- Rate limiting and DDoS protection
- Input validation and sanitization
- Session timeout and cleanup

### 🎯 **Production Ready**
- Modular architecture (MVC pattern)
- Comprehensive error handling
- Logging and monitoring
- Environment-based configuration
- Ready for cloud deployment

## 🏗️ Architecture

```
facebook-auto-tool/
├── index.js                 # Main application entry point
├── package.json             # Dependencies and scripts
├── .env                     # Environment configuration
├── .gitignore              # Git ignore rules
├── README.md               # Documentation
│
├── config/
│   └── db.js               # MongoDB connection
│
├── models/
│   └── User.js             # User, Session, and Action models
│
├── controllers/
│   ├── authController.js   # Authentication logic
│   ├── actionController.js # Action execution logic
│   └── dashboardController.js # Dashboard data management
│
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── action.js           # Action execution routes
│   └── dashboard.js        # Dashboard routes
│
├── services/
│   └── fbService.js        # Facebook automation service
│
├── public/
│   ├── index.html          # Landing page
│   ├── login.html          # Login/registration page
│   ├── styles.css          # Custom CSS styles
│   └── script.js           # Frontend JavaScript
│
└── views/
    └── dashboard.ejs       # Dashboard template
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 16+** ([Download](https://nodejs.org/))
- **MongoDB 4.4+** ([Download](https://www.mongodb.com/try/download/community))
- **Git** ([Download](https://git-scm.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/facebook-auto-tool.git
   cd facebook-auto-tool
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   ```bash
   # Using MongoDB service
   sudo systemctl start mongod
   
   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - Open [http://localhost:3000](http://localhost:3000)
   - Register a new account
   - Add Facebook sessions
   - Start automating!

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
NODE_ENV=production
PORT=3000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/facebook-auto-tool

# Security
SESSION_SECRET=your-super-secret-session-key
COOKIE_SECRET=your-cookie-secret-key

# Features
ENABLE_REGISTRATION=true
ENABLE_FB_LOGIN=true
ENABLE_COOKIE_IMPORT=true
```

### MongoDB Setup

1. **Local MongoDB:**
   ```bash
   # Install MongoDB
   sudo apt-get install mongodb-community
   
   # Start service
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

2. **MongoDB Atlas (Cloud):**
   - Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create cluster and get connection string
   - Update `MONGODB_URI` in `.env`

## 🌐 Deployment

### Deploy to Render.com

1. **Prepare for deployment:**
   ```bash
   # Ensure all dependencies are in package.json
   npm install --production
   
   # Set NODE_ENV to production
   export NODE_ENV=production
   ```

2. **Create Render account:**
   - Visit [Render.com](https://render.com/)
   - Connect your GitHub repository

3. **Configure Render service:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variables:**
     ```
     NODE_ENV=production
     MONGODB_URI=your-mongodb-atlas-connection-string
     SESSION_SECRET=your-production-session-secret
     ```

4. **Deploy:**
   - Push to your main branch
   - Render will automatically deploy

### Deploy to Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your-mongodb-uri
heroku config:set SESSION_SECRET=your-secret

# Deploy
git push heroku main
```

### Deploy with Docker

```dockerfile
# Dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t facebook-auto-tool .
docker run -p 3000:3000 --env-file .env facebook-auto-tool
```

## 📡 API Documentation

### Authentication Endpoints

#### Register User
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "confirmPassword": "password123"
  }'
```

#### Login User
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

#### Add Facebook Session via Login
```bash
curl -X POST http://localhost:3000/auth/facebook-login \
  -H "Content-Type: application/json" \
  -H "Cookie: fbAutoSession=your-session-cookie" \
  -d '{
    "email": "your-facebook-email@example.com",
    "password": "your-facebook-password"
  }'
```

#### Add Facebook Session via Cookies
```bash
curl -X POST http://localhost:3000/auth/facebook-cookies \
  -H "Content-Type: application/json" \
  -H "Cookie: fbAutoSession=your-session-cookie" \
  -d '{
    "fbUserId": "100012345678901",
    "cookies": "[{\"name\":\"c_user\",\"value\":\"100012345678901\",\"domain\":\".facebook.com\"},{\"name\":\"xs\",\"value\":\"your-xs-value\",\"domain\":\".facebook.com\"}]"
  }'
```

#### Get Facebook Sessions
```bash
curl -X GET http://localhost:3000/auth/facebook-sessions \
  -H "Cookie: fbAutoSession=your-session-cookie"
```

### Action Endpoints

#### Execute Facebook Action
```bash
curl -X POST http://localhost:3000/action/execute \
  -H "Content-Type: application/json" \
  -H "Cookie: fbAutoSession=your-session-cookie" \
  -d '{
    "actionType": "like",
    "targetUrl": "https://facebook.com/username/posts/123456789",
    "targetUid": "100012345678901",
    "sessionId": ""
  }'
```

#### Execute Comment Action
```bash
curl -X POST http://localhost:3000/action/execute \
  -H "Content-Type: application/json" \
  -H "Cookie: fbAutoSession=your-session-cookie" \
  -d '{
    "actionType": "comment",
    "targetUrl": "https://facebook.com/username/posts/123456789",
    "commentText": "Great post! 👍",
    "sessionId": ""
  }'
```

#### Get Action History
```bash
curl -X GET "http://localhost:3000/action/history?page=1&limit=20" \
  -H "Cookie: fbAutoSession=your-session-cookie"
```

#### Get Action Statistics
```bash
curl -X GET "http://localhost:3000/action/stats?timeframe=7d" \
  -H "Cookie: fbAutoSession=your-session-cookie"
```

#### Validate Target URL
```bash
curl -X POST http://localhost:3000/action/validate-url \
  -H "Content-Type: application/json" \
  -H "Cookie: fbAutoSession=your-session-cookie" \
  -d '{
    "url": "https://facebook.com/username/posts/123456789"
  }'
```

### Dashboard Endpoints

#### Get Dashboard Data
```bash
curl -X GET http://localhost:3000/dashboard/data \
  -H "Cookie: fbAutoSession=your-session-cookie"
```

#### Get System Status
```bash
curl -X GET http://localhost:3000/dashboard/system-status \
  -H "Cookie: fbAutoSession=your-session-cookie"
```

#### Cleanup Sessions and History
```bash
curl -X POST http://localhost:3000/dashboard/cleanup \
  -H "Cookie: fbAutoSession=your-session-cookie"
```

## 🎯 Usage Examples

### Basic Workflow

1. **Register and Login:**
   ```javascript
   // Register new user
   const response = await fetch('/auth/register', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       username: 'myusername',
       email: 'my@email.com',
       password: 'mypassword',
       confirmPassword: 'mypassword'
     })
   });
   ```

2. **Add Facebook Sessions:**
   ```javascript
   // Option 1: Via Puppeteer login simulation
   const fbLogin = await fetch('/auth/facebook-login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       email: 'facebook@email.com',
       password: 'facebook-password'
     })
   });

   // Option 2: Via cookies import
   const fbCookies = await fetch('/auth/facebook-cookies', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       fbUserId: '100012345678901',
       cookies: '[{"name":"c_user","value":"..."}]'
     })
   });
   ```

3. **Execute Actions:**
   ```javascript
   // Like a post
   const likeAction = await fetch('/action/execute', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       actionType: 'like',
       targetUrl: 'https://facebook.com/page/posts/123456789'
     })
   });

   // Comment on a post
   const commentAction = await fetch('/action/execute', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       actionType: 'comment',
       targetUrl: 'https://facebook.com/page/posts/123456789',
       commentText: 'Amazing content! 🔥'
     })
   });
   ```

### Advanced Features

#### Batch Operations
```javascript
// Execute action on multiple sessions
const batchAction = await fetch('/action/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    actionType: 'follow',
    targetUrl: 'https://facebook.com/username',
    sessionId: '' // Empty = use all active sessions
  })
});
```

#### Session Management
```javascript
// Get all active sessions
const sessions = await fetch('/auth/facebook-sessions');
const sessionData = await sessions.json();

// Remove specific session
await fetch(`/auth/facebook-sessions/${sessionId}`, {
  method: 'DELETE'
});
```

## 🔒 Security Features

### Session Security
- **Secure Cookies**: HttpOnly, SameSite protection
- **Session Encryption**: Encrypted session storage
- **Auto Cleanup**: Expired session removal
- **CSRF Protection**: Built-in CSRF tokens

### Input Validation
- **URL Validation**: Facebook URL verification
- **XSS Prevention**: Input sanitization
- **SQL Injection**: MongoDB ODM protection
- **Rate Limiting**: Request throttling

### Privacy Protection
- **Cookie Masking**: Sensitive data protection
- **No Password Storage**: Facebook passwords never stored
- **Minimal Data**: Only necessary information collected

## 📊 Monitoring

### Application Metrics
- **Active Sessions**: Real-time session count
- **Success Rate**: Action success percentage
- **Response Time**: API performance metrics
- **Error Rate**: Failure tracking

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# System status
curl http://localhost:3000/dashboard/system-status
```

### Logging
- **Request Logging**: All API requests logged
- **Error Tracking**: Detailed error information
- **Performance Logs**: Response time tracking
- **Security Events**: Authentication attempts

## 🛠️ Development

### Project Structure
```
src/
├── controllers/     # Business logic
├── models/         # Data models
├── routes/         # API routes
├── services/       # External services
├── middleware/     # Custom middleware
└── utils/          # Utility functions
```

### Code Style
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Husky**: Git hooks
- **Jest**: Unit testing

### Testing
```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- --grep "auth"
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch:** `git checkout -b feature/amazing-feature`
3. **Commit changes:** `git commit -m 'Add amazing feature'`
4. **Push to branch:** `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Setup
```bash
# Clone your fork
git clone https://github.com/your-username/facebook-auto-tool.git

# Install dependencies
npm install

# Setup pre-commit hooks
npm run prepare

# Start development server
npm run dev
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool is for educational and legitimate automation purposes only. Users are responsible for:

- **Compliance**: Following Facebook's Terms of Service
- **Rate Limiting**: Respecting API limits and guidelines
- **Privacy**: Protecting user data and privacy
- **Legal Use**: Using the tool within legal boundaries

## 🆘 Support

### Getting Help
- **Documentation**: Check this README and code comments
- **Issues**: Open GitHub issues for bugs
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact support@yourcompany.com

### Common Issues

**Q: MongoDB connection failed**
A: Ensure MongoDB is running and connection string is correct

**Q: Puppeteer errors on deployment**
A: Install Chrome dependencies or use headless mode

**Q: Session expires quickly**
A: Check Facebook account security settings and 2FA

**Q: Actions failing**
A: Verify Facebook URLs and session validity

## 🚀 Roadmap

### Version 2.0
- [ ] **Advanced Scheduling**: Cron-based action scheduling
- [ ] **Proxy Support**: Rotating proxy integration
- [ ] **Multi-Platform**: Instagram and Twitter support
- [ ] **AI Comments**: GPT-powered comment generation
- [ ] **Team Management**: Multi-user workspace support

### Version 2.1
- [ ] **Mobile App**: React Native mobile application
- [ ] **Webhooks**: Real-time notifications
- [ ] **Analytics API**: Advanced reporting endpoints
- [ ] **Plugin System**: Custom action plugins

---

<div align="center">

**Made with ❤️ for professional marketers**

[Website](https://yourcompany.com) • [Documentation](https://docs.yourcompany.com) • [Support](mailto:support@yourcompany.com)

</div>