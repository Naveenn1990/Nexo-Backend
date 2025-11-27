/**
 * Script to create a vendor account
 * Usage: node scripts/createVendor.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Vendor = require('../models/VendorModel');

const createVendor = async () => {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Vendor data
    const vendorData = {
      name: 'Amit',
      email: 'amit@nexo.in',
      phone: '9999999999', // Update with actual phone
      password: 'Amit@123',
      companyName: 'Nexo Vendor',
      status: 'active'
    };

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({ 
      $or: [
        { email: vendorData.email.toLowerCase() },
        { phone: vendorData.phone }
      ]
    });

    if (existingVendor) {
      console.log('⚠️  Vendor already exists:');
      console.log('   Email:', existingVendor.email);
      console.log('   Phone:', existingVendor.phone);
      console.log('   Status:', existingVendor.status);
      
      // Update password if needed
      if (existingVendor.password) {
        console.log('\n📝 Updating password...');
        existingVendor.password = vendorData.password;
        await existingVendor.save();
        console.log('✅ Password updated successfully');
      } else {
        console.log('\n📝 Setting password...');
        existingVendor.password = vendorData.password;
        await existingVendor.save();
        console.log('✅ Password set successfully');
      }
      
      console.log('\n✅ Vendor account ready for login');
      console.log('   Email:', existingVendor.email);
      console.log('   Password:', vendorData.password);
    } else {
      // Create new vendor
      console.log('📝 Creating new vendor...');
      const vendor = new Vendor(vendorData);
      await vendor.save();
      
      console.log('✅ Vendor created successfully!');
      console.log('\n📋 Vendor Details:');
      console.log('   ID:', vendor._id);
      console.log('   Name:', vendor.name);
      console.log('   Email:', vendor.email);
      console.log('   Phone:', vendor.phone);
      console.log('   Status:', vendor.status);
      console.log('\n🔑 Login Credentials:');
      console.log('   Email:', vendor.email);
      console.log('   Password:', vendorData.password);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
};

createVendor();

