const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.ADMIN_API_BASE_URL || process.env.API_BASE_URL || 'https://nexo.works';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@nexo.works';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Alternative: Use direct database access if API fails
const useDirectDB = process.argv.includes('--direct-db') || process.argv.includes('-d');

const defaultPlans = [
  {
    name: 'Basic',
    price: 99,
    priceDisplay: '₹99',
    features: [
      'Priority support',
      '2 free inspections'
    ],
    description: 'Perfect for basic home maintenance needs',
    isActive: true,
    displayOrder: 0,
    highlight: false,
    highlightText: '',
    whatsappNumber: '919590926068'
  },
  {
    name: 'Pro',
    price: 199,
    priceDisplay: '₹199',
    features: [
      'Free visits',
      'Discounted services',
      'Priority booking'
    ],
    description: 'Best value for regular home maintenance',
    isActive: true,
    displayOrder: 1,
    highlight: true,
    highlightText: 'Most Popular',
    whatsappNumber: '919590926068'
  },
  {
    name: 'Ultra',
    price: 349,
    priceDisplay: '₹349',
    features: [
      '2 handyman hours/month',
      'Emergency booking support',
      '24x7 premium assistance'
    ],
    description: 'Premium plan with maximum benefits',
    isActive: true,
    displayOrder: 2,
    highlight: false,
    highlightText: '',
    whatsappNumber: '919590926068'
  }
];

async function addSubscriptionPlansDirectDB() {
  try {
    console.log('📦 Using direct database access...');
    const mongoose = require('mongoose');
    const SubscriptionPlan = require('../models/SubscriptionPlan');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const existingPlans = await SubscriptionPlan.find({});
    if (existingPlans.length > 0) {
      console.log(`⚠️  Found ${existingPlans.length} existing plan(s). Skipping.`);
      existingPlans.forEach(plan => {
        console.log(`   - ${plan.name}: ₹${plan.price}`);
      });
      await mongoose.disconnect();
      process.exit(0);
    }

    const createdPlans = await SubscriptionPlan.insertMany(defaultPlans);
    console.log(`✅ Created ${createdPlans.length} subscription plans:`);
    createdPlans.forEach(plan => {
      console.log(`   - ${plan.name}: ₹${plan.price}`);
    });

    await mongoose.disconnect();
    console.log('🎉 Subscription plans added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function addSubscriptionPlansViaAPI() {
  try {
    if (useDirectDB) {
      return await addSubscriptionPlansDirectDB();
    }

    console.log('🔐 Logging in as admin...');
    
    // Step 1: Login to get admin token
    let loginResponse;
    try {
      loginResponse = await axios.post(`${API_BASE_URL}/api/admin/login`, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      });
    } catch (error) {
      console.log('⚠️  API login failed. Trying direct database access...');
      return await addSubscriptionPlansDirectDB();
    }

    if (!loginResponse.data.success || !loginResponse.data.token) {
      console.log('⚠️  API login failed. Trying direct database access...');
      return await addSubscriptionPlansDirectDB();
    }

    const token = loginResponse.data.token;
    console.log('✅ Admin login successful');

    // Step 2: Check existing plans
    console.log('\n📊 Checking existing subscription plans...');
    const existingPlansResponse = await axios.get(`${API_BASE_URL}/api/admin/subscription-plans`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const existingPlans = existingPlansResponse.data?.data || [];
    console.log(`   Found ${existingPlans.length} existing plan(s)`);

    if (existingPlans.length > 0) {
      console.log('⚠️  Plans already exist. Skipping creation.');
      console.log('   Existing plans:');
      existingPlans.forEach(plan => {
        console.log(`     - ${plan.name}: ₹${plan.price}`);
      });
      process.exit(0);
    }

    // Step 3: Create plans via API
    console.log('\n📝 Creating subscription plans via API...');
    const createdPlans = [];

    for (const plan of defaultPlans) {
      try {
        const createResponse = await axios.post(
          `${API_BASE_URL}/api/admin/subscription-plans`,
          plan,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (createResponse.data.success) {
          createdPlans.push(createResponse.data.data);
          console.log(`   ✅ Created: ${plan.name} - ₹${plan.price}`);
        } else {
          console.log(`   ❌ Failed to create ${plan.name}: ${createResponse.data.message}`);
        }
      } catch (error) {
        console.log(`   ❌ Error creating ${plan.name}: ${error.response?.data?.message || error.message}`);
      }
    }

    console.log(`\n🎉 Successfully created ${createdPlans.length} subscription plan(s) via API!`);
    
    // Step 4: Verify plans were created
    console.log('\n🔍 Verifying created plans...');
    const verifyResponse = await axios.get(`${API_BASE_URL}/api/admin/subscription-plans`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const allPlans = verifyResponse.data?.data || [];
    console.log(`   Total plans in database: ${allPlans.length}`);
    allPlans.forEach(plan => {
      console.log(`     - ${plan.name}: ₹${plan.price} (${plan.features?.length || 0} features)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding subscription plans via API:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    console.log('\n⚠️  Trying direct database access as fallback...');
    try {
      await addSubscriptionPlansDirectDB();
    } catch (dbError) {
      console.error('❌ Direct DB access also failed:', dbError.message);
      process.exit(1);
    }
  }
}

// Run the function
addSubscriptionPlansViaAPI();

