const axios = require('axios');

const testAdminLogin = async () => {
  console.log('🧪 Testing Admin Login with different credentials...');
  
  const credentials = [
    { email: 'admin@nexo.in', password: 'admin123' },
    { email: 'admin@nexo.in', password: 'password' },
    { email: 'admin@nexo.in', password: 'nexo123' },
    { email: 'admin@nexo.in', password: 'admin' },
    { email: 'test@admin.com', password: 'admin123' },
    { email: 'admin@test.com', password: 'admin123' }
  ];
  
  for (const cred of credentials) {
    try {
      console.log(`\n🔐 Testing: ${cred.email} / ${cred.password}`);
      
      const response = await axios.post('http://localhost:9088/api/admin/login', cred);
      
      if (response.data.success) {
        console.log('✅ Login successful!');
        console.log('🎫 Token:', response.data.token.substring(0, 20) + '...');
        
        // Test purchase orders API
        const token = response.data.token;
        const poResponse = await axios.get('http://localhost:9088/api/admin/inventory/purchase-orders', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📋 Purchase Orders API Response:');
        console.log('   Status:', poResponse.status);
        console.log('   Success:', poResponse.data.success);
        console.log('   Count:', poResponse.data.count);
        console.log('   Data length:', poResponse.data.data?.length || 0);
        
        if (poResponse.data.data && poResponse.data.data.length > 0) {
          console.log('📦 Purchase Orders:');
          poResponse.data.data.forEach((po, index) => {
            console.log(`     ${index + 1}. ${po.poId} - ${po.supplier} - ₹${po.totalValue} - ${po.status}`);
          });
        }
        
        return; // Exit on first successful login
      }
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ Failed: ${error.response.status} - ${error.response.data.message}`);
      } else {
        console.log(`❌ Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n❌ All login attempts failed');
};

testAdminLogin();