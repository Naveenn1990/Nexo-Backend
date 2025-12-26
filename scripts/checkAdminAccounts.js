const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Admin = require('../models/Admin');

const checkAdminAccounts = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Check existing admin accounts
    const admins = await Admin.find({}).select('email name role isActive');
    console.log(`📊 Found ${admins.length} admin accounts:`);

    if (admins.length > 0) {
      admins.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.email} - ${admin.name} - ${admin.role} - ${admin.isActive ? 'Active' : 'Inactive'}`);
      });
    } else {
      console.log('❌ No admin accounts found');
      
      // Create a default admin account
      console.log('🔄 Creating default admin account...');
      
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const defaultAdmin = await Admin.create({
        name: 'System Admin',
        email: 'admin@nexo.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });
      
      console.log('✅ Default admin created:', defaultAdmin.email);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

checkAdminAccounts();