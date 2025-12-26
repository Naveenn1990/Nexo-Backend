const mongoose = require('mongoose');
const AMCContract = require('../models/AMCContract');
const AMCPlan = require('../models/AMCPlan');
const Partner = require('../models/PartnerModel');
require('dotenv').config();

async function testAMCContract() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if we have any AMC plans
    const plans = await AMCPlan.find().limit(1);
    console.log('📋 Available AMC Plans:', plans.length);

    // Check if we have any partners
    const partners = await Partner.find().limit(1);
    console.log('👥 Available Partners:', partners.length);

    if (plans.length === 0) {
      console.log('❌ No AMC plans found. Please create AMC plans first.');
      return;
    }

    if (partners.length === 0) {
      console.log('❌ No partners found. Please register partners first.');
      return;
    }

    // Test contract creation
    const testContract = new AMCContract({
      customer: {
        name: 'Test Customer',
        phone: '9876543210',
        email: 'test@example.com',
        address: '123 Test Street, Test City'
      },
      partnerId: partners[0]._id,
      planId: plans[0]._id,
      planDetails: {
        name: plans[0].name,
        price: plans[0].price,
        features: plans[0].features || [],
        includedServices: plans[0].includedServices || [],
        serviceFrequency: plans[0].serviceFrequency || {}
      },
      startDate: new Date(),
      duration: 12,
      durationUnit: 'months',
      totalAmount: plans[0].price || 5000,
      paymentTerms: 'monthly',
      status: 'draft',
      createdBy: new mongoose.Types.ObjectId() // Mock admin ID
    });

    await testContract.save();
    console.log('✅ Test AMC Contract created successfully!');
    console.log('📄 Contract Number:', testContract.contractNumber);
    console.log('📅 Start Date:', testContract.startDate);
    console.log('📅 End Date:', testContract.endDate);
    console.log('💰 Total Amount:', testContract.totalAmount);

    // Test contract retrieval
    const retrievedContract = await AMCContract.findById(testContract._id)
      .populate('partnerId', 'profile phone')
      .populate('planId', 'name price planType');

    console.log('✅ Contract retrieved successfully!');
    console.log('👤 Partner:', retrievedContract.partnerId?.profile?.name || 'No name');
    console.log('📋 Plan:', retrievedContract.planId?.name || 'No plan name');

    // Clean up test data
    await AMCContract.findByIdAndDelete(testContract._id);
    console.log('🧹 Test contract cleaned up');

    console.log('\n🎉 AMC Contract functionality test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run the test
testAMCContract();