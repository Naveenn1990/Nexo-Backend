const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Partner = require('../models/PartnerModel');
const Product = require('../models/product');
const SparePartOrder = require('../models/SparePartOrder');

async function testOrderPlacement() {
  try {
    console.log('🔍 Testing Order Placement functionality...');
    
    // Find a partner with cart items
    const partner = await Partner.findOne({ 'cart.0': { $exists: true } })
      .populate('cart.product');
    
    if (!partner) {
      console.log('❌ No partner found with cart items');
      console.log('💡 Run testAddToCart.js first to add items to cart');
      return;
    }
    
    console.log(`✅ Found partner: ${partner.profile?.name || partner.phone}`);
    console.log(`📦 Cart items: ${partner.cart.length}`);
    
    // Display cart contents
    console.log('\n🛒 Cart Contents:');
    partner.cart.forEach((item, index) => {
      console.log(`${index + 1}. ${item.product.name} - Qty: ${item.quantity} - ₹${item.product.price * item.quantity}`);
    });
    
    // Calculate totals
    const subtotal = partner.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const tax = Math.round(subtotal * 0.18);
    const shippingCharges = subtotal > 1000 ? 0 : 50;
    const totalAmount = subtotal + tax + shippingCharges;
    
    console.log(`\n💰 Order Summary:`);
    console.log(`   Subtotal: ₹${subtotal}`);
    console.log(`   Tax (18%): ₹${tax}`);
    console.log(`   Shipping: ₹${shippingCharges}`);
    console.log(`   Total: ₹${totalAmount}`);
    
    // Prepare order items
    const orderItems = partner.cart.map(cartItem => ({
      product: cartItem.product._id,
      quantity: cartItem.quantity,
      price: cartItem.product.price,
      total: cartItem.product.price * cartItem.quantity
    }));
    
    // Create test order
    const order = new SparePartOrder({
      partner: partner._id,
      items: orderItems,
      subtotal,
      tax,
      shippingCharges,
      totalAmount,
      delivery: {
        address: {
          name: 'Test Partner',
          phone: '9876543210',
          email: 'test@partner.com',
          addressLine1: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456'
        }
      },
      notes: {
        customer: 'Test order from script'
      },
      statusHistory: [{
        status: 'pending',
        timestamp: new Date(),
        updatedBy: 'system',
        remarks: 'Test order created'
      }]
    });
    
    await order.save();
    console.log(`\n✅ Order created successfully!`);
    console.log(`   Order ID: ${order.orderId}`);
    console.log(`   MongoDB ID: ${order._id}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Payment Status: ${order.payment.status}`);
    
    // Test payment initiation data
    const txnid = `SPO${Date.now()}${Math.floor(Math.random() * 1000)}`;
    console.log(`\n💳 Payment Details:`);
    console.log(`   Transaction ID: ${txnid}`);
    console.log(`   Amount: ₹${order.totalAmount}`);
    console.log(`   Product Info: Spare Parts Order - ${order.orderId}`);
    
    console.log('\n✅ Order placement test completed successfully!');
    console.log('💡 Next: Test the payment flow with PayU integration');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

testOrderPlacement();