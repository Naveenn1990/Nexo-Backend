const mongoose = require('mongoose');
const ServiceCategory = require('../models/ServiceCategory');
const Product = require('../models/product');
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

// Check categories and products
const checkCategoriesAndProducts = async () => {
  try {
    await connectDB();
    
    console.log('=== SERVICE CATEGORIES ===');
    const categories = await ServiceCategory.find().select('_id name');
    categories.forEach(cat => {
      console.log(`ID: ${cat._id} | Name: ${cat.name}`);
    });
    
    console.log('\n=== PRODUCTS BY CATEGORY ===');
    for (const category of categories) {
      const products = await Product.find({ category: category._id });
      console.log(`\n${category.name} (${category._id}):`);
      console.log(`  - ${products.length} products`);
      products.forEach(product => {
        console.log(`    • ${product.name} (Stock: ${product.stock})`);
      });
    }
    
    console.log('\n=== CHECKING SPECIFIC CATEGORY ===');
    const specificCategoryId = '69186156e808d402ae65ba94';
    console.log(`Looking for category: ${specificCategoryId}`);
    
    if (mongoose.Types.ObjectId.isValid(specificCategoryId)) {
      const specificCategory = await ServiceCategory.findById(specificCategoryId);
      if (specificCategory) {
        console.log(`Found category: ${specificCategory.name}`);
        const productsInCategory = await Product.find({ category: specificCategoryId });
        console.log(`Products in this category: ${productsInCategory.length}`);
      } else {
        console.log('Category not found in database');
      }
    } else {
      console.log('Invalid ObjectId format');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// Run the check
checkCategoriesAndProducts();