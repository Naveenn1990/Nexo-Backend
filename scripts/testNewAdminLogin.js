const axios = require('axios');

const testNewAdminLogin = async () => {
  console.log('🧪 Testing New Admin Login...');
  
  try {
    console.log('🔐 Testing: test@nexo.com / test123');
    
    const response = await axios.post('https://nexo.works/api/admin/login', {
      email: 'test@nexo.com',
      password: 'test123'
    });
    
    if (response.data.success) {
      console.log('✅ Login successful!');
      console.log('🎫 Token:', response.data.token.substring(0, 20) + '...');
      
      // Test purchase orders API
      const token = response.data.token;
      console.log('\n📋 Testing Purchase Orders API...');
      
      const poResponse = await axios.get('https://nexo.works/api/admin/inventory/purchase-orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Purchase Orders API Response:');
      console.log('   Status:', poResponse.status);
      console.log('   Success:', poResponse.data.success);
      console.log('   Count:', poResponse.data.count);
      console.log('   Data length:', poResponse.data.data?.length || 0);
      
      if (poResponse.data.data && poResponse.data.data.length > 0) {
        console.log('\n📦 Purchase Orders Found:');
        poResponse.data.data.forEach((po, index) => {
          console.log(`   ${index + 1}. ${po.poId} - ${po.supplier} - ₹${po.totalValue} - ${po.status}`);
          console.log(`      Items: ${po.itemsDisplay || 'N/A'}`);
          console.log(`      ETA: ${po.eta || 'N/A'}`);
        });
        
        console.log('\n🎯 SOLUTION FOUND!');
        console.log('✅ Backend server is running correctly');
        console.log('✅ Database has purchase orders');
        console.log('✅ API authentication is working');
        console.log('✅ API is returning data correctly');
        console.log('\n🔧 The issue is likely in the frontend:');
        console.log('   1. Check if admin is logged in properly');
        console.log('   2. Verify authentication token is being sent');
        console.log('   3. Check browser network tab for API calls');
        console.log('   4. Look for JavaScript errors in console');
        
      } else {
        console.log('\n⚠️ No purchase orders returned from API');
        console.log('   This could be a data filtering issue');
      }
      
    } else {
      console.log('❌ Login failed:', response.data.message);
    }
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ API Error: ${error.response.status} - ${error.response.data.message}`);
    } else {
      console.log(`❌ Network Error: ${error.message}`);
    }
  }
};

testNewAdminLogin();