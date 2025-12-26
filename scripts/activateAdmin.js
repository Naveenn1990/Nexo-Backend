const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Admin = require('../models/Admin');

const activateAdmin = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Activate the first admin account
    const admin = await Admin.findOneAndUpdate(
      { email: 'admin@nexo.in' },
      { isActive: true },
      { new: true }
    );

    if (admin) {
      console.log('✅ Admin account activated:', admin.email);
      console.log('📧 Email:', admin.email);
      console.log('👤 Name:', admin.name);
      console.log('🔑 Role:', admin.role);
      console.log('✅ Active:', admin.isActive);
    } else {
      console.log('❌ Admin account not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

activateAdmin();