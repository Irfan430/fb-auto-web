# 🚀 Facebook Auto Tool

Professional-grade Facebook automation platform built with Node.js, Express, and MongoDB. Automate Facebook actions like likes, reactions, follows, and comments with enterprise-level security and monitoring.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-production--ready-green.svg)

## ✨ Features

### 🔐 **Enterprise Security**
- Bank-level encryption for cookie storage
- Secure session management with MongoDB
- Automatic cleanup of expired sessions
- HttpOnly cookies to prevent XSS
- Rate limiting and request validation

### 👥 **Multi-Account Management**
- Manage unlimited Facebook accounts
- Support for credentials and cookie import
- Session rotation and health monitoring
- Automatic invalid session cleanup
- Real-time session status tracking

### ⚡ **Smart Automation**
- Like, Love, Haha, Sad, Angry, Wow reactions
- Follow/Unfollow users and pages
- Intelligent comment posting
- Human-like delays and behavior patterns
- Bulk action support with session selection

### 📊 **Advanced Analytics**
- Real-time performance tracking
- Success rate monitoring
- Action history with filtering
- Session performance metrics
- Exportable data and reports

### 🎨 **Modern Interface**
- Professional landing page
- Responsive dashboard design
- React-style form components
- Real-time status updates
- Mobile-friendly interface

## 🛠️ Installation

### Prerequisites

- **Node.js** 18.0 or higher
- **MongoDB** 4.4 or higher
- **Chrome/Chromium** (for Puppeteer)

### Quick Start

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
   # Using systemctl (Linux)
   sudo systemctl start mongod
   
   # Using Homebrew (macOS)
   brew services start mongodb-community
   
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
NODE_ENV=production
PORT=3000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/facebook-auto-tool

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Security Configuration
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Puppeteer Configuration
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage
```

### MongoDB Setup

1. **Install MongoDB**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install mongodb
   
   # CentOS/RHEL
   sudo yum install mongodb
   
   # macOS with Homebrew
   brew install mongodb-community
   ```

2. **Create database and user**
   ```javascript
   // Connect to MongoDB shell
   mongosh
   
   // Create database
   use facebook-auto-tool
   
   // Create user (optional but recommended)
   db.createUser({
     user: "fbautotool",
     pwd: "securepassword",
     roles: [{ role: "readWrite", db: "facebook-auto-tool" }]
   })
   ```

## 📖 Usage Guide

### 1. User Registration/Login

Navigate to `/login` and either:
- **Login** with existing credentials
- **Register** a new account

### 2. Add Facebook Sessions

You can add Facebook accounts using two methods:

#### Method A: Credentials (Automated)
- Enter Facebook email and password
- System automatically logs in via Puppeteer
- Cookies are extracted and stored securely

#### Method B: Cookie Import (Manual)
- Export cookies from your browser's developer tools
- Paste the cookie string into the form
- System validates and stores the session

### 3. Perform Actions

Use the Quick Actions panel or API to:
- **Target**: Enter Facebook post/profile URL
- **Action**: Select from available actions (like, react, follow, comment)
- **Sessions**: Choose which accounts to use
- **Execute**: Run the action across selected sessions

### 4. Monitor Performance

- View real-time statistics on the dashboard
- Check action history and success rates
- Monitor session health and expiration
- Export data for external analysis

## 🔌 API Documentation

### Authentication Endpoints

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "userId": "your-user-id",
  "email": "user@example.com",
  "password": "your-password"
}
```

#### Add Facebook Credentials
```http
POST /api/auth/facebook/credentials
Content-Type: application/json

{
  "fbEmail": "facebook@example.com",
  "fbPassword": "facebook-password"
}
```

#### Add Facebook Cookies
```http
POST /api/auth/facebook/cookies
Content-Type: application/json

{
  "cookies": "session_cookie_string_here",
  "userAgent": "Mozilla/5.0..."
}
```

### Action Endpoints

#### Perform Action
```http
POST /api/action/perform
Content-Type: application/json

{
  "actionType": "like",
  "targetUrl": "https://facebook.com/post/123456",
  "comment": "Great post!",
  "selectedSessions": ["session1", "session2"]
}
```

#### Get Action History
```http
GET /api/action/history?page=1&limit=20&actionType=like&status=success
```

#### Validate URL
```http
POST /api/action/validate-url
Content-Type: application/json

{
  "targetUrl": "https://facebook.com/post/123456"
}
```

### Dashboard Endpoints

#### Get Dashboard Overview
```http
GET /api/dashboard/overview
```

#### Get System Status
```http
GET /api/dashboard/status
```

#### Get Analytics
```http
GET /api/dashboard/analytics?period=7d
```

### Example cURL Commands

```bash
# Login user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"testuser","password":"testpass"}'

# Perform like action
curl -X POST http://localhost:3000/api/action/perform \
  -H "Content-Type: application/json" \
  -b "connect.sid=your-session-cookie" \
  -d '{
    "actionType":"like",
    "targetUrl":"https://facebook.com/post/123456",
    "selectedSessions":[]
  }'

# Get action history
curl -X GET http://localhost:3000/api/action/history?limit=10 \
  -b "connect.sid=your-session-cookie"

# Get dashboard overview
curl -X GET http://localhost:3000/api/dashboard/overview \
  -b "connect.sid=your-session-cookie"
```

## 🚀 Deployment

### Deploy to Render.com

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Create new Web Service on Render**
   - Connect your GitHub repository
   - Set build command: `npm install`
   - Set start command: `npm start`

3. **Set environment variables**
   ```env
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/facebook-auto-tool
   SESSION_SECRET=your-production-secret-key
   PUPPETEER_HEADLESS=true
   PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage
   ```

4. **Deploy**
   - Render will automatically build and deploy your app
   - Access your app at `https://your-app-name.onrender.com`

### Deploy to Heroku

1. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

2. **Add MongoDB Atlas**
   ```bash
   heroku addons:create mongolab:sandbox
   ```

3. **Set environment variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set SESSION_SECRET=your-production-secret
   heroku config:set PUPPETEER_HEADLESS=true
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

### Deploy with Docker

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   
   # Install dependencies for Puppeteer
   RUN apk add --no-cache \
       chromium \
       nss \
       freetype \
       freetype-dev \
       harfbuzz \
       ca-certificates \
       ttf-freefont
   
   # Set Puppeteer to use system Chromium
   ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
   
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   
   COPY . .
   
   USER node
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and run**
   ```bash
   docker build -t facebook-auto-tool .
   docker run -p 3000:3000 -e MONGODB_URI="your-mongo-uri" facebook-auto-tool
   ```

## 🛡️ Security Considerations

### Data Protection
- All Facebook cookies are encrypted before storage
- Passwords are hashed using bcrypt with 12 rounds
- Sessions use httpOnly and secure flags
- CSRF protection via same-site cookies

### Privacy Features
- Facebook IDs are masked in the UI
- Cookies are never exposed to the frontend
- Automatic cleanup of expired sessions
- Optional data export for users

### Rate Limiting
- API endpoints are rate-limited
- Human-like delays between actions
- Account protection mechanisms
- Error handling and retry logic

## 📋 Project Structure

```
facebook-auto-tool/
├── package.json              # Dependencies and scripts
├── index.js                  # Main server entry point
├── .env                      # Environment configuration
├── .gitignore               # Git ignore rules
├── README.md                # This file
├── config/
│   └── db.js               # MongoDB connection
├── controllers/
│   ├── authController.js   # Authentication logic
│   ├── actionController.js # Action execution logic
│   └── dashboardController.js # Dashboard data
├── models/
│   └── User.js             # User and session models
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── action.js           # Action routes
│   └── dashboard.js        # Dashboard routes
├── services/
│   └── fbService.js        # Facebook automation service
├── public/
│   ├── index.html          # Landing page
│   ├── login.html          # Login page
│   ├── styles.css          # Custom styles
│   └── script.js           # Frontend JavaScript
└── views/
    └── dashboard.ejs       # Dashboard template
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool is for educational and automation purposes only. Users are responsible for complying with Facebook's Terms of Service and applicable laws. The developers are not responsible for any misuse of this software.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/facebook-auto-tool/issues)
- **Documentation**: [Wiki](https://github.com/your-username/facebook-auto-tool/wiki)
- **Email**: support@your-domain.com

## 🔄 Changelog

### v1.0.0 (2024-01-01)
- Initial release
- Multi-account management
- Advanced automation features
- Professional dashboard
- Production-ready deployment

---

**Built with ❤️ for the automation community**