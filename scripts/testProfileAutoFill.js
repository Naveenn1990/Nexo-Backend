const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Partner = require('../models/PartnerModel');

async function testProfileAutoFill() {
  try {
    console.log('🔍 Testing Profile Auto-Fill functionality...');
    
    // Find a partner with profile data
    const partner = await Partner.findOne({
      'profile.name': { $exists: true, $ne: '' },
      'profile.address': { $exists: true, $ne: '' }
    });
    
    if (!partner) {
      console.log('❌ No partner found with complete profile data');
      console.log('💡 Create a partner with profile information first');
      return;
    }
    
    console.log(`✅ Found partner: ${partner.profile?.name || partner.phone}`);
    
    // Display profile data that would be auto-filled
    console.log('\n📋 Profile Data for Auto-Fill:');
    console.log(`   Name: ${partner.profile?.name || 'N/A'}`);
    console.log(`   Phone: ${partner.phone || 'N/A'}`);
    console.log(`   Email: ${partner.profile?.email || 'N/A'}`);
    console.log(`   Address: ${partner.profile?.address || 'N/A'}`);
    console.log(`   City: ${partner.profile?.city || 'N/A'}`);
    console.log(`   Pincode: ${partner.profile?.pincode || 'N/A'}`);
    console.log(`   Landmark: ${partner.profile?.landmark || 'N/A'}`);
    
    // Simulate the auto-fill object that would be created
    const autoFillData = {
      name: partner.profile?.name || '',
      phone: partner.phone || '',
      email: partner.profile?.email || '',
      addressLine1: partner.profile?.address || '',
      addressLine2: '',
      city: partner.profile?.city || '',
      state: '',
      pincode: partner.profile?.pincode || '',
      landmark: partner.profile?.landmark || ''
    };
    
    console.log('\n🔄 Auto-Fill Object:');
    console.log(JSON.stringify(autoFillData, null, 2));
    
    // Check completeness
    const requiredFields = ['name', 'phone', 'addressLine1', 'pincode'];
    const missingFields = requiredFields.filter(field => !autoFillData[field]);
    
    if (missingFields.length === 0) {
      console.log('\n✅ All required fields are available for auto-fill');
    } else {
      console.log('\n⚠️  Missing required fields:', missingFields.join(', '));
      console.log('💡 Partner will need to fill these manually');
    }
    
    console.log('\n✅ Profile auto-fill test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

testProfileAutoFill();