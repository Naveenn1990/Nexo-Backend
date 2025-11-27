/**
 * Script to reset vendor password
 * Usage: node scripts/resetVendorPassword.js <email> <newPassword>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Vendor = require('../models/VendorModel');

const resetPassword = async () => {
  try {
    const email = process.argv[2] || 'amit@nexo.in';
    const newPassword = process.argv[3] || 'Amit@123';

    if (!email || !newPassword) {
      console.log('Usage: node scripts/resetVendorPassword.js <email> <newPassword>');
      console.log('Example: node scripts/resetVendorPassword.js amit@nexo.in Amit@123');
      process.exit(1);
    }

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find vendor
    const vendor = await Vendor.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!vendor) {
      console.log('❌ Vendor not found with email:', email);
      console.log('\nCreating new vendor...');
      
      const newVendor = new Vendor({
        name: 'Amit',
        email: email.toLowerCase().trim(),
        phone: '9999999999',
        password: newPassword,
        status: 'active'
      });
      
      await newVendor.save();
      console.log('✅ Vendor created successfully!');
      console.log('   Email:', newVendor.email);
      console.log('   Password:', newPassword);
      process.exit(0);
    }

    console.log('📝 Vendor found:', {
      id: vendor._id,
      email: vendor.email,
      name: vendor.name,
      status: vendor.status,
      hasPassword: !!vendor.password
    });

    // Reset password
    console.log('\n🔄 Resetting password...');
    vendor.password = newPassword; // Will be hashed by pre-save hook
    await vendor.save();

    console.log('✅ Password reset successfully!');
    console.log('\n📋 Updated Credentials:');
    console.log('   Email:', vendor.email);
    console.log('   New Password:', newPassword);
    console.log('   Status:', vendor.status);

    // Verify password works
    console.log('\n🔍 Verifying password...');
    const testVendor = await Vendor.findOne({ email: email.toLowerCase().trim() }).select('+password');
    const isMatch = await testVendor.comparePassword(newPassword);
    
    if (isMatch) {
      console.log('✅ Password verification successful!');
    } else {
      console.log('❌ Password verification failed!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
};

resetPassword();

