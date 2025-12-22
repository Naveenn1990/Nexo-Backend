const mongoose = require("mongoose");

// Fix Mongoose deprecation warning
mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    // Check if MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Enhanced connection options for better reliability
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Increased to 10s for Atlas
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      connectTimeoutMS: 10000, // Give up initial connection after 10s
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 5, // Maintain a minimum of 5 socket connections
      maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true, // Enable retryable writes
      retryReads: true // Enable retryable reads
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log("MongoDB Connected Successfully");
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });
    
  } catch (err) {
    console.error("Database Connection Error:", {
      message: err.message,
      code: err.code,
      uri: process.env.MONGODB_URI ? process.env.MONGODB_URI.split('@')[1] : 'not set' // Safe logging of URI
    });
    process.exit(1);
  }
};

module.exports = connectDB;
