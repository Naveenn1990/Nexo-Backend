const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const Admin = require('../models/Admin');

const createTestAdmin = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Delete existing test admin if exists
    await Admin.deleteOne({ email: 'test@nexo.com' });

    // Create new test admin with known password
    const password = 'test123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const testAdmin = await Admin.create({
      name: 'Test Admin',
      email: 'test@nexo.com',
      password: hashedPassword,
      role: 'admin',
      isActive: true
    });
    
    console.log('✅ Test admin created successfully!');
    console.log('📧 Email:', testAdmin.email);
    console.log('🔑 Password:', password);
    console.log('👤 Name:', testAdmin.name);
    console.log('🔑 Role:', testAdmin.role);
    console.log('✅ Active:', testAdmin.isActive);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

createTestAdmin();