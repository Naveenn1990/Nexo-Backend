const axios = require('axios');

const testAdminAuth = async () => {
  console.log('🧪 Testing Admin Authentication and Purchase Orders API...');
  
  try {
    // Step 1: Login as admin to get token
    console.log('\n🔐 Step 1: Admin Login');
    
    const loginResponse = await axios.post('http://localhost:9088/api/admin/login', {
      email: 'admin@nexo.com', // Default admin email
      password: 'admin123' // Default admin password
    });
    
    if (loginResponse.data.success) {
      console.log('✅ Admin login successful');
      const token = loginResponse.data.token;
      console.log('🎫 Token received:', token.substring(0, 20) + '...');
      
      // Step 2: Test purchase orders API with token
      console.log('\n📋 Step 2: Fetch Purchase Orders');
      
      const poResponse = await axios.get('http://localhost:9088/api/admin/inventory/purchase-orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Purchase Orders API call successful');
      console.log('📊 Response status:', poResponse.status);
      console.log('📊 Response data:', JSON.stringify(poResponse.data, null, 2));
      
      if (poResponse.data.success && poResponse.data.data) {
        console.log(`📦 Found ${poResponse.data.data.length} purchase orders`);
        
        poResponse.data.data.forEach((po, index) => {
          console.log(`   ${index + 1}. ${po.poId} - ${po.supplier} - ₹${po.totalValue} - ${po.status}`);
        });
      } else {
        console.log('⚠️ No purchase orders found or unexpected response format');
      }
      
    } else {
      console.log('❌ Admin login failed:', loginResponse.data.message);
    }
    
  } catch (error) {
    if (error.response) {
      console.log('❌ API Error:', error.response.status);
      console.log('📊 Error data:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server not running on port 9088');
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
};

testAdminAuth();