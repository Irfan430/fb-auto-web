/**
 * MongoDB Database Configuration
 * Secure connection setup with error handling and monitoring
 */

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // MongoDB connection options
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            family: 4, // Use IPv4, skip trying IPv6
            bufferCommands: false,
            bufferMaxEntries: 0
        };

        // MongoDB connection string
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/facebook-auto-tool';
        
        // Connect to MongoDB
        const conn = await mongoose.connect(mongoURI, options);
        
        console.log(`📦 MongoDB Connected: ${conn.connection.host}`);
        console.log(`🗄️  Database: ${conn.connection.name}`);
        
        // Connection event listeners
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB disconnected');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnected');
        });
        
        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('📦 MongoDB connection closed through app termination');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        
        // Log specific error types
        if (error.name === 'MongoServerError') {
            console.error('MongoDB Server Error:', error.message);
        } else if (error.name === 'MongoNetworkError') {
            console.error('MongoDB Network Error:', error.message);
        } else if (error.name === 'MongoParseError') {
            console.error('MongoDB Parse Error:', error.message);
        }
        
        // Exit process with failure
        process.exit(1);
    }
};

// Helper function to check database health
const checkDBHealth = async () => {
    try {
        const adminDB = mongoose.connection.db.admin();
        const result = await adminDB.ping();
        return {
            status: 'healthy',
            ping: result,
            readyState: mongoose.connection.readyState,
            collections: await mongoose.connection.db.listCollections().toArray()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            readyState: mongoose.connection.readyState
        };
    }
};

module.exports = {
    connectDB,
    checkDBHealth
};