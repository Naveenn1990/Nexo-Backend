/**
 * Team Member API Test Script
 * Run this with: node backend/test/teamMemberTest.js
 * Make sure you have a valid partner token
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://nexo.works';
const PARTNER_TOKEN = process.env.PARTNER_TOKEN || 'YOUR_PARTNER_TOKEN_HERE'; // Replace with actual token

// Test data
const testTeamMember = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '9876543210',
  whatsappNumber: '9876543210',
  qualification: 'B.Tech in Electrical Engineering',
  experience: '5 years',
  address: '123 Main Street',
  city: 'Mumbai',
  pincode: '400001',
  role: 'technician',
  categories: [], // Will be populated from available categories
  categoryNames: [],
  hubs: [] // Will be populated from available hubs
};

let createdMemberId = null;
let testBookingId = null;

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}/api/partner${endpoint}`,
      headers: {
        'Authorization': `Bearer ${PARTNER_TOKEN}`,
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// Test functions
async function testGetTeamMembers() {
  console.log('\n📋 Test 1: Get Team Members');
  console.log('--------------------------------');
  const result = await apiCall('GET', '/team-members');
  
  if (result.success) {
    console.log('✅ Success! Team members retrieved');
    console.log(`   Found ${result.data?.data?.length || 0} team members`);
    if (result.data?.data?.length > 0) {
      console.log('   Sample member:', result.data.data[0].name);
    }
  } else {
    console.log('❌ Failed:', result.error);
  }
  return result;
}

async function testGetAvailableHubs() {
  console.log('\n📋 Test 2: Get Available Hubs');
  console.log('--------------------------------');
  const result = await apiCall('GET', '/service-hubs/available');
  
  if (result.success) {
    console.log('✅ Success! Hubs retrieved');
    const hubs = result.data?.data || [];
    console.log(`   Found ${hubs.length} hubs`);
    if (hubs.length > 0) {
      testTeamMember.hubs = [hubs[0]._id];
      console.log('   Using hub:', hubs[0].name);
    }
  } else {
    console.log('❌ Failed:', result.error);
  }
  return result;
}

async function testGetCategories() {
  console.log('\n📋 Test 3: Get Categories');
  console.log('--------------------------------');
  const result = await apiCall('GET', '/dropdown/categories');
  
  if (result.success) {
    console.log('✅ Success! Categories retrieved');
    const categories = result.data?.categories || result.data?.data || [];
    console.log(`   Found ${categories.length} categories`);
    if (categories.length > 0) {
      testTeamMember.categories = [categories[0].id || categories[0]._id];
      testTeamMember.categoryNames = [categories[0].name];
      console.log('   Using category:', categories[0].name);
    }
  } else {
    console.log('❌ Failed:', result.error);
  }
  return result;
}

async function testAddTeamMember() {
  console.log('\n📋 Test 4: Add Team Member');
  console.log('--------------------------------');
  console.log('   Adding:', testTeamMember.name);
  
  // For FormData, we'll use a simplified version
  // In real scenario, you'd use FormData for file uploads
  const result = await apiCall('POST', '/team-members', testTeamMember);
  
  if (result.success && result.data?.success) {
    console.log('✅ Success! Team member added');
    createdMemberId = result.data.data._id || result.data.data.id;
    console.log('   Member ID:', createdMemberId);
    console.log('   Name:', result.data.data.name);
    console.log('   Phone:', result.data.data.phone);
  } else {
    console.log('❌ Failed:', result.error || result.data);
  }
  return result;
}

async function testGetTeamMemberActivities() {
  if (!createdMemberId) {
    console.log('\n⚠️  Skipping: No member ID available');
    return;
  }

  console.log('\n📋 Test 5: Get Team Member Activities');
  console.log('--------------------------------');
  const result = await apiCall('GET', `/team-members/${createdMemberId}/activities`);
  
  if (result.success) {
    console.log('✅ Success! Activities retrieved');
    const activities = result.data?.data || [];
    console.log(`   Found ${activities.length} activities/bookings`);
    if (activities.length > 0) {
      console.log('   Sample activity:', activities[0].subService?.name || 'N/A');
    }
  } else {
    console.log('❌ Failed:', result.error);
  }
  return result;
}

async function testAssignBooking() {
  if (!createdMemberId) {
    console.log('\n⚠️  Skipping: No member ID available');
    return;
  }

  console.log('\n📋 Test 6: Assign Booking to Team Member');
  console.log('--------------------------------');
  console.log('   Note: This requires an existing accepted booking');
  console.log('   You need to provide a booking ID manually');
  
  // Get bookings first
  const bookingsResult = await apiCall('GET', '/bookings');
  if (bookingsResult.success) {
    let bookings = [];
    if (bookingsResult.data?.bookings) {
      Object.values(bookingsResult.data.bookings).forEach(statusBookings => {
        if (Array.isArray(statusBookings)) {
          bookings = bookings.concat(statusBookings);
        }
      });
    } else if (Array.isArray(bookingsResult.data)) {
      bookings = bookingsResult.data;
    } else if (Array.isArray(bookingsResult.data?.data)) {
      bookings = bookingsResult.data.data;
    }

    // Find an accepted booking without team member
    const acceptedBooking = bookings.find(b => 
      (b.status === 'accepted' || b.status === 'in_progress') && !b.teamMember
    );

    if (acceptedBooking) {
      testBookingId = acceptedBooking._id || acceptedBooking.bookingId;
      console.log(`   Found booking: ${testBookingId}`);
      
      const assignResult = await apiCall('POST', '/team-members/assign-booking', {
        bookingId: testBookingId,
        teamMemberId: createdMemberId
      });

      if (assignResult.success && assignResult.data?.success) {
        console.log('✅ Success! Booking assigned to team member');
        console.log('   Booking ID:', testBookingId);
        console.log('   Team Member:', assignResult.data.data.teamMember?.name);
      } else {
        console.log('❌ Failed:', assignResult.error || assignResult.data);
      }
      return assignResult;
    } else {
      console.log('⚠️  No accepted booking found without team member');
      console.log('   You can manually test this with:');
      console.log(`   POST /api/partner/team-members/assign-booking`);
      console.log(`   Body: { "bookingId": "YOUR_BOOKING_ID", "teamMemberId": "${createdMemberId}" }`);
    }
  } else {
    console.log('⚠️  Could not fetch bookings');
  }
}

async function testUpdateTeamMember() {
  if (!createdMemberId) {
    console.log('\n⚠️  Skipping: No member ID available');
    return;
  }

  console.log('\n📋 Test 7: Update Team Member');
  console.log('--------------------------------');
  const updateData = {
    ...testTeamMember,
    experience: '6 years', // Updated
    city: 'Delhi' // Updated
  };
  
  const result = await apiCall('PUT', `/team-members/${createdMemberId}`, updateData);
  
  if (result.success && result.data?.success) {
    console.log('✅ Success! Team member updated');
    console.log('   Updated experience:', result.data.data.experience);
    console.log('   Updated city:', result.data.data.city);
  } else {
    console.log('❌ Failed:', result.error || result.data);
  }
  return result;
}

// Main test runner
async function runTests() {
  console.log('🧪 Team Member API Test Suite');
  console.log('================================');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Partner Token: ${PARTNER_TOKEN.substring(0, 20)}...`);

  if (PARTNER_TOKEN === 'YOUR_PARTNER_TOKEN_HERE') {
    console.log('\n⚠️  WARNING: Please set PARTNER_TOKEN environment variable');
    console.log('   Example: PARTNER_TOKEN=your_token_here node backend/test/teamMemberTest.js');
    return;
  }

  try {
    // Run tests in sequence
    await testGetTeamMembers();
    await testGetAvailableHubs();
    await testGetCategories();
    await testAddTeamMember();
    await testGetTeamMemberActivities();
    await testAssignBooking();
    await testUpdateTeamMember();

    console.log('\n✅ Test Suite Completed!');
    console.log('================================');
    
    if (createdMemberId) {
      console.log(`\n📝 Created Team Member ID: ${createdMemberId}`);
      console.log('   You can use this ID for further testing');
    }
  } catch (error) {
    console.error('\n❌ Test Suite Error:', error.message);
  }
}

// Run if executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests, testAddTeamMember, testGetTeamMembers };

