const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Partner = require('../models/PartnerModel');
const Product = require('../models/product');

async function testAddToCart() {
  try {
    console.log('🔍 Testing Add to Cart functionality...');
    
    // Find a partner
    const partner = await Partner.findOne({}).limit(1);
    if (!partner) {
      console.log('❌ No partner found in database');
      return;
    }
    console.log(`✅ Found partner: ${partner.profile?.name || partner.phone}`);
    
    // Find a product
    const product = await Product.findOne({}).limit(1);
    if (!product) {
      console.log('❌ No product found in database');
      return;
    }
    console.log(`✅ Found product: ${product.name} - ₹${product.price}`);
    
    // Test adding product to cart
    console.log('\n📦 Adding product to cart...');
    
    // Initialize cart if it doesn't exist
    if (!partner.cart) {
      partner.cart = [];
    }
    
    // Check if product already exists in cart
    const existingItemIndex = partner.cart.findIndex(
      (item) => item.product.toString() === product._id.toString()
    );
    
    if (existingItemIndex !== -1) {
      // Update quantity
      partner.cart[existingItemIndex].quantity = 2;
      console.log('✅ Updated existing item quantity to 2');
    } else {
      // Add new product to cart
      partner.cart.push({
        product: product._id,
        quantity: 1,
        addedAt: new Date(),
      });
      console.log('✅ Added new product to cart');
    }
    
    // Save the partner
    await partner.save();
    console.log('✅ Partner cart saved successfully');
    
    // Populate and display cart
    await partner.populate('cart.product');
    console.log('\n🛒 Current Cart:');
    partner.cart.forEach((item, index) => {
      console.log(`${index + 1}. ${item.product.name} - Qty: ${item.quantity} - ₹${item.product.price * item.quantity}`);
    });
    
    const total = partner.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    console.log(`\n💰 Total: ₹${total}`);
    
    console.log('\n✅ Add to Cart test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

testAddToCart();