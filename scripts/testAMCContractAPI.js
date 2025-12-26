const axios = require('axios');

async function testAMCContractAPI() {
  try {
    console.log('🧪 Testing AMC Contract API...');

    // First, let's test if the server is running
    const baseURL = 'http://localhost:9088';
    
    try {
      const healthCheck = await axios.get(`${baseURL}/api/health`);
      console.log('✅ Server is running');
    } catch (err) {
      console.log('⚠️ Server health check failed, but continuing...');
    }

    // Test data for creating an AMC contract
    const contractData = {
      customerName: 'Test Customer API',
      customerPhone: '9876543210',
      customerEmail: 'testapi@example.com',
      customerAddress: '123 API Test Street, Test City',
      partnerId: '676c8b8b4b0e9996158340ca', // You'll need to replace with actual partner ID
      planId: '676c8b8b4b0e9996158340cb', // You'll need to replace with actual plan ID
      startDate: '2025-01-01',
      duration: 12,
      durationUnit: 'months',
      totalAmount: 5000,
      paymentTerms: 'monthly',
      specialTerms: 'Test contract created via API',
      status: 'draft'
    };

    // You'll need to get an admin token first
    // For now, let's just test the endpoint structure
    console.log('📋 Contract data prepared:', {
      customerName: contractData.customerName,
      totalAmount: contractData.totalAmount,
      duration: `${contractData.duration} ${contractData.durationUnit}`
    });

    console.log('✅ AMC Contract API test data is ready');
    console.log('📝 To test the full API:');
    console.log('   1. Login as admin to get token');
    console.log('   2. Use the token to call POST /api/admin/amc-contracts');
    console.log('   3. Check the AMC Management page in the admin panel');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

testAMCContractAPI();