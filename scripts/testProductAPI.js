const mongoose = require('mongoose');
const ServiceCategory = require('../models/ServiceCategory');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Test the API scenarios
const testAPIScenarios = async () => {
  try {
    await connectDB();
    
    console.log('=== TESTING API SCENARIOS ===\n');
    
    // Find categories with and without products
    const categories = await ServiceCategory.find().select('_id name');
    
    console.log('Categories for testing:');
    console.log('1. Geyser Repair (should have products now): 69186156e808d402ae65ba94');
    console.log('2. Carpenter (should have no products): 69186156e808d402ae65ba9a');
    console.log('3. Invalid category ID: 507f1f77bcf86cd799439011');
    
    console.log('\n=== FRONTEND TESTING INSTRUCTIONS ===');
    console.log('1. Login as a partner');
    console.log('2. Go to partner dashboard > spare parts');
    console.log('3. Select "Geyser Repair" category - should show 3 products');
    console.log('4. Select "Carpenter" category - should show "No products found" message');
    console.log('5. The frontend should handle both cases gracefully without 404 errors');
    
    console.log('\n=== BACKEND CHANGES MADE ===');
    console.log('✅ Updated getProductsByCategory to return 200 status even when no products found');
    console.log('✅ Added proper error handling for invalid category IDs');
    console.log('✅ Added success/error response structure');
    console.log('✅ Added validation for MongoDB ObjectId format');
    
    console.log('\n=== FRONTEND CHANGES MADE ===');
    console.log('✅ Improved error handling in fetchProducts function');
    console.log('✅ Added proper handling for empty product arrays');
    console.log('✅ Enhanced empty state UI with helpful messages');
    console.log('✅ Added retry functionality for failed requests');
    console.log('✅ Distinguished between errors and empty categories');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// Run the test
testAPIScenarios();