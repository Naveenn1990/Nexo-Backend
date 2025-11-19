const mongoose = require("mongoose");

// Fix Mongoose deprecation warning
mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    // Check if MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Add DNS options and better error handling
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      family: 4 // Use IPv4, skip trying IPv6
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log("MongoDB Connected Successfully");
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
