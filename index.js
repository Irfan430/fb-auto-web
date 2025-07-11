/**
 * Facebook Auto Tool - Main Server Entry Point
 * Professional-grade Express.js application with MongoDB integration
 * Ready for production deployment on Render.com
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const actionRoutes = require('./routes/action');
const dashboardRoutes = require('./routes/dashboard');

// Import database configuration
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"]
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Compression middleware
app.use(compression());

// Request logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration with MongoDB store
app.use(session({
    secret: process.env.SESSION_SECRET || 'facebook-auto-tool-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60 // 24 hours
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    }
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/action', actionRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Main routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.render('dashboard', { 
        user: req.session.user || {},
        title: 'Facebook Auto Tool - Dashboard'
    });
});

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl 
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error occurred:', err);
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: err.message
        });
    }
    
    if (err.name === 'CastError') {
        return res.status(400).json({
            error: 'Invalid ID format'
        });
    }
    
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong!' 
            : err.message
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT. Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Facebook Auto Tool server is running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
});

module.exports = app;