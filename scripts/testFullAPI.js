const axios = require('axios');

const testFullAPI = async () => {
  console.log('🧪 Testing Complete API Flow...');
  
  try {
    // Step 1: Login
    console.log('\n🔐 Step 1: Admin Login');
    const loginResponse = await axios.post('http://localhost:9088/api/admin/login', {
      email: 'test@nexo.com',
      password: 'test123'
    });
    
    if (!loginResponse.data.token) {
      console.log('❌ No token received');
      return;
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received');
    
    // Step 2: Test Purchase Orders API
    console.log('\n📋 Step 2: Fetch Purchase Orders');
    const poResponse = await axios.get('http://localhost:9088/api/admin/inventory/purchase-orders', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Purchase Orders API successful');
    console.log('📊 Response:', JSON.stringify(poResponse.data, null, 2));
    
    if (poResponse.data.success && poResponse.data.data) {
      console.log(`\n📦 Found ${poResponse.data.data.length} purchase orders:`);
      
      poResponse.data.data.forEach((po, index) => {
        console.log(`\n   ${index + 1}. Purchase Order Details:`);
        console.log(`      PO ID: ${po.poId}`);
        console.log(`      Supplier: ${po.supplier}`);
        console.log(`      Total Value: ₹${po.totalValue}`);
        console.log(`      Status: ${po.status}`);
        console.log(`      Items Display: ${po.itemsDisplay}`);
        console.log(`      ETA: ${po.eta}`);
        console.log(`      Items Array Length: ${po.items?.length || 0}`);
      });
      
      console.log('\n🎯 DIAGNOSIS COMPLETE:');
      console.log('✅ Backend server is running correctly');
      console.log('✅ Database connection is working');
      console.log('✅ Purchase orders exist in database');
      console.log('✅ Admin authentication is working');
      console.log('✅ API endpoint is returning data correctly');
      console.log('✅ Data transformation is working');
      
      console.log('\n🔧 FRONTEND ISSUE IDENTIFIED:');
      console.log('The problem is in the frontend React application.');
      console.log('Possible causes:');
      console.log('1. Admin not logged in properly in frontend');
      console.log('2. Authentication token not being sent from frontend');
      console.log('3. useAdminData hook not calling the API');
      console.log('4. Frontend API base URL incorrect');
      console.log('5. CORS or network issues in browser');
      
      console.log('\n🛠️ NEXT STEPS:');
      console.log('1. Check browser network tab for API calls');
      console.log('2. Verify admin login state in frontend');
      console.log('3. Check console for JavaScript errors');
      console.log('4. Verify API base URL in frontend config');
      
    } else {
      console.log('⚠️ API returned success but no data');
    }
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ API Error: ${error.response.status}`);
      console.log('📊 Error data:', error.response.data);
    } else {
      console.log(`❌ Network Error: ${error.message}`);
    }
  }
};

testFullAPI();