const axios = require('axios');

const testPurchaseOrderAPI = async () => {
  console.log('🧪 Testing Purchase Order API...');
  
  try {
    // Test 1: Check if API endpoint is reachable
    console.log('\n📋 Test 1: API Endpoint Reachability');
    
    try {
      const response = await axios.get('http://localhost:9088/api/admin/inventory/purchase-orders', {
        timeout: 5000
      });
      console.log('✅ API endpoint is reachable');
      console.log('📊 Response status:', response.status);
      console.log('📊 Response data:', response.data);
    } catch (error) {
      if (error.response) {
        console.log('⚠️ API responded with error:', error.response.status);
        console.log('📊 Error data:', error.response.data);
        if (error.response.status === 401) {
          console.log('🔐 Authentication required - this is expected without token');
        }
      } else if (error.code === 'ECONNREFUSED') {
        console.log('❌ Server not running on port 9088');
      } else {
        console.log('❌ Network error:', error.message);
      }
    }

    // Test 2: Check database for existing purchase orders
    console.log('\n📋 Test 2: Database Check');
    console.log('ℹ️ Checking if there are any purchase orders in the database...');
    
    // This would require database connection, but we can simulate
    console.log('📊 Expected database collection: purchaseorders');
    console.log('📊 Expected fields: poId, supplier, items, totalValue, status');

    // Test 3: Sample purchase order data structure
    console.log('\n📋 Test 3: Expected Data Structure');
    
    const samplePO = {
      _id: '507f1f77bcf86cd799439011',
      poId: 'PO-0001',
      supplier: 'Hardware Supplier Ltd',
      supplierContact: '+91-9876543210',
      items: [
        {
          sku: 'HANDLE-001',
          name: 'Cabinet Handles',
          quantity: 2,
          unitPrice: 50,
          totalPrice: 100
        },
        {
          sku: 'LOCK-001',
          name: 'Door Locks',
          quantity: 34,
          unitPrice: 500,
          totalPrice: 17000
        }
      ],
      totalValue: 17100,
      status: 'Pending',
      expectedDeliveryDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('📊 Sample Purchase Order:');
    console.log(`   PO ID: ${samplePO.poId}`);
    console.log(`   Supplier: ${samplePO.supplier}`);
    console.log(`   Items: ${samplePO.items.length}`);
    console.log(`   Total Value: ₹${samplePO.totalValue.toLocaleString('en-IN')}`);
    console.log(`   Status: ${samplePO.status}`);

    // Test 4: Frontend data transformation
    console.log('\n📋 Test 4: Frontend Data Transformation');
    
    const transformedForTable = {
      ...samplePO,
      itemsDisplay: samplePO.items.map(item => `${item.name} (${item.quantity})`).join(', '),
      value: `₹${samplePO.totalValue.toLocaleString()}`,
      eta: samplePO.expectedDeliveryDate ? new Date(samplePO.expectedDeliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A'
    };

    console.log('📊 Transformed for table display:');
    console.log(`   Items Display: ${transformedForTable.itemsDisplay}`);
    console.log(`   Value Display: ${transformedForTable.value}`);
    console.log(`   ETA Display: ${transformedForTable.eta}`);

    // Test 5: Common issues and solutions
    console.log('\n🔧 Common Issues & Solutions:');
    console.log('❌ Issue: Empty table in Procurement Tracker');
    console.log('✅ Solution 1: Check if backend server is running');
    console.log('✅ Solution 2: Verify API routes are properly defined');
    console.log('✅ Solution 3: Check if purchase orders exist in database');
    console.log('✅ Solution 4: Verify authentication token is valid');
    console.log('✅ Solution 5: Check network connectivity');
    console.log('✅ Solution 6: Verify data transformation in backend');

    // Test 6: Debugging steps
    console.log('\n🔍 Debugging Steps:');
    console.log('1. Check browser network tab for API calls');
    console.log('2. Look for 401/403 authentication errors');
    console.log('3. Verify backend server is running on port 9088');
    console.log('4. Check if purchase orders exist in MongoDB');
    console.log('5. Test API endpoint directly with Postman/curl');
    console.log('6. Check console for JavaScript errors');

    console.log('\n🎯 Next Steps:');
    console.log('1. Verify backend server is running');
    console.log('2. Create sample purchase orders if none exist');
    console.log('3. Test API authentication');
    console.log('4. Check frontend error handling');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
};

testPurchaseOrderAPI();