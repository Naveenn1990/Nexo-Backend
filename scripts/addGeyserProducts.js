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

// Add products to Geyser Repair category
const addGeyserProducts = async () => {
  try {
    await connectDB();
    
    // Find Geyser Repair category
    const geyserCategory = await ServiceCategory.findOne({ name: 'Geyser Repair' });
    
    if (!geyserCategory) {
      console.log('Geyser Repair category not found');
      process.exit(1);
    }
    
    console.log(`Found Geyser Repair category: ${geyserCategory._id}`);
    
    // Sample geyser products
    const geyserProducts = [
      {
        name: 'Geyser Heating Element',
        category: geyserCategory._id,
        brand: 'Bajaj',
        description: 'High-quality heating element for electric geysers',
        price: 800,
        stock: 25,
        specifications: '2000W heating element, copper material',
        howToUse: 'Replace faulty heating element as per manufacturer instructions',
        image: '/images/geyser-element.jpg',
        hsnCode: '85161000',
        gstPercentage: 18,
        discountPercentage: 5,
        model: 'HE-2000W-CU'
      },
      {
        name: 'Geyser Thermostat',
        category: geyserCategory._id,
        brand: 'Racold',
        description: 'Temperature control thermostat for water heaters',
        price: 450,
        stock: 30,
        specifications: 'Adjustable temperature range 30-75°C',
        howToUse: 'Install as per geyser service manual',
        image: '/images/geyser-thermostat.jpg',
        hsnCode: '90321000',
        gstPercentage: 18,
        discountPercentage: 0,
        model: 'TH-75C-ADJ'
      },
      {
        name: 'Geyser Safety Valve',
        category: geyserCategory._id,
        brand: 'AO Smith',
        description: 'Pressure relief safety valve for water heaters',
        price: 350,
        stock: 40,
        specifications: '6 bar pressure rating, brass construction',
        howToUse: 'Install on hot water outlet for safety',
        image: '/images/geyser-valve.jpg',
        hsnCode: '84818000',
        gstPercentage: 18,
        discountPercentage: 10,
        model: 'SV-6BAR-BR'
      }
    ];
    
    // Insert products
    const createdProducts = await Product.insertMany(geyserProducts);
    console.log(`Added ${createdProducts.length} products to Geyser Repair category:`);
    
    createdProducts.forEach(product => {
      console.log(`  - ${product.name} (₹${product.price}, Stock: ${product.stock})`);
    });
    
    console.log('\nGeyser products added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding geyser products:', error);
    process.exit(1);
  }
};

// Run the function
addGeyserProducts();