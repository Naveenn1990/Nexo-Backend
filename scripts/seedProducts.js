const mongoose = require('mongoose');
const Product = require('../models/product');
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

// Sample products data
const seedProducts = async () => {
  try {
    await connectDB();
    
    // Get some service categories to use as product categories
    const categories = await ServiceCategory.find().limit(5);
    
    if (categories.length === 0) {
      console.log('No service categories found. Please create some service categories first.');
      process.exit(1);
    }
    
    console.log(`Found ${categories.length} categories`);
    
    // Clear existing products
    await Product.deleteMany({});
    console.log('Cleared existing products');
    
    // Sample products for each category
    const sampleProducts = [];
    
    categories.forEach((category, index) => {
      const categoryProducts = [
        {
          name: `${category.name} Tool ${index + 1}`,
          category: category._id,
          brand: 'Professional Tools',
          description: `High-quality tool for ${category.name} services`,
          price: 500 + (index * 100),
          stock: 50 + (index * 10),
          specifications: `Professional grade tool with warranty`,
          howToUse: `Use as per manufacturer instructions for ${category.name}`,
          image: '/images/default-product.jpg',
          hsnCode: `8467${10 + index}`,
          gstPercentage: 18,
          discountPercentage: 5,
          model: `PT-${category.name.substring(0, 3).toUpperCase()}-${index + 1}`
        },
        {
          name: `${category.name} Spare Part ${index + 1}`,
          category: category._id,
          brand: 'OEM Parts',
          description: `Genuine spare part for ${category.name} equipment`,
          price: 200 + (index * 50),
          stock: 100 + (index * 20),
          specifications: `OEM quality spare part`,
          howToUse: `Replace as per service manual for ${category.name}`,
          image: '/images/default-spare.jpg',
          hsnCode: `8481${20 + index}`,
          gstPercentage: 18,
          discountPercentage: 0,
          model: `SP-${category.name.substring(0, 3).toUpperCase()}-${index + 1}`
        },
        {
          name: `${category.name} Consumable ${index + 1}`,
          category: category._id,
          brand: 'Quality Supplies',
          description: `Essential consumable for ${category.name} services`,
          price: 100 + (index * 25),
          stock: 200 + (index * 30),
          specifications: `High-quality consumable material`,
          howToUse: `Use during ${category.name} service operations`,
          image: '/images/default-consumable.jpg',
          hsnCode: `3926${30 + index}`,
          gstPercentage: 12,
          discountPercentage: 10,
          model: `CS-${category.name.substring(0, 3).toUpperCase()}-${index + 1}`
        }
      ];
      
      sampleProducts.push(...categoryProducts);
    });
    
    // Insert sample products
    const createdProducts = await Product.insertMany(sampleProducts);
    console.log(`Created ${createdProducts.length} products`);
    
    // Display created products by category
    for (const category of categories) {
      const categoryProducts = createdProducts.filter(p => p.category.toString() === category._id.toString());
      console.log(`\n${category.name} (${categoryProducts.length} products):`);
      categoryProducts.forEach(product => {
        console.log(`  - ${product.name} (₹${product.price}, Stock: ${product.stock})`);
      });
    }
    
    console.log('\nProducts seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding products:', error);
    process.exit(1);
  }
};

// Run the seed function
seedProducts();