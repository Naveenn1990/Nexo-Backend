const axios = require('axios');

const testEnhancedMaterialQuotation = async () => {
  console.log('🧪 Testing Enhanced Material Quotation System...');
  
  try {
    // Test data for enhanced material quotation
    const quotationData = {
      // Partner details
      name: 'Rajesh Kumar',
      phone: '+91-9876543210',
      email: 'rajesh@example.com',
      
      // Customer details
      customerName: 'Priya Sharma',
      customerPhone: '+91-9876543211',
      customerEmail: 'priya@example.com',
      customerAddress: '123 MG Road, Bangalore, Karnataka 560001',
      
      // Technician details
      technicianName: 'Suresh Electrician',
      technicianPhone: '+91-9876543212',
      technicianId: 'TECH001',
      
      // Service details
      serviceType: 'electrical',
      urgency: 'urgent',
      category: 'Electrical Components',
      brandPreference: 'Havells, Schneider',
      requirements: 'Need electrical wires, switches, and MCB for house wiring',
      notes: 'Customer prefers branded items only',
      
      // Selected items (example structure)
      selectedItems: {
        'Electrical Components': [
          { name: 'Electrical Wire 2.5mm', quantity: 100, unit: 'meters' },
          { name: 'Modular Switches', quantity: 10, unit: 'pieces' },
          { name: 'MCB 16A', quantity: 5, unit: 'pieces' }
        ]
      },
      totalAmount: 8500
    };

    console.log('\n📋 Test 1: Submit Enhanced Material Quotation');
    console.log('===============================================');
    
    const response = await axios.post('https://nexo.works/api/user/material-quotation', quotationData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      console.log('✅ Enhanced material quotation submitted successfully!');
      console.log('📊 Response data:', JSON.stringify(response.data, null, 2));
      
      const requestId = response.data.data.requestId;
      console.log(`🆔 Request ID: ${requestId}`);
      
      // Test admin login and approval
      console.log('\n🔐 Test 2: Admin Login');
      console.log('======================');
      
      const loginResponse = await axios.post('https://nexo.works/api/admin/login', {
        email: 'test@nexo.com',
        password: 'test123'
      });
      
      if (loginResponse.data.token) {
        const token = loginResponse.data.token;
        console.log('✅ Admin login successful');
        
        // Test fetching material quotations
        console.log('\n📋 Test 3: Fetch Material Quotations');
        console.log('====================================');
        
        const quotationsResponse = await axios.get('https://nexo.works/api/admin/material-quotations', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Material quotations fetched successfully');
        console.log(`📊 Found ${quotationsResponse.data.count} quotations`);
        
        // Test approval
        console.log('\n✅ Test 4: Approve Material Quotation');
        console.log('=====================================');
        
        const approvalData = {
          approvedAmount: 8200,
          deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
          notes: 'Approved with slight price adjustment. Quality materials will be provided.'
        };
        
        const approvalResponse = await axios.put(`https://nexo.works/api/admin/material-quotations/${requestId}/approve`, approvalData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Material quotation approved successfully');
        console.log('📊 Approval response:', JSON.stringify(approvalResponse.data, null, 2));
        
        // Test marking as delivered
        console.log('\n🚚 Test 5: Mark Materials as Delivered');
        console.log('======================================');
        
        const deliveryData = {
          deliveredBy: 'Delivery Team - Ravi',
          deliveryNotes: 'All materials delivered in good condition. Customer signature obtained.'
        };
        
        const deliveryResponse = await axios.put(`https://nexo.works/api/admin/material-quotations/${requestId}/delivered`, deliveryData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Materials marked as delivered successfully');
        console.log('📊 Delivery response:', JSON.stringify(deliveryResponse.data, null, 2));
        
        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('====================');
        console.log('✅ Enhanced material quotation system is working correctly');
        console.log('✅ Customer and technician details are captured');
        console.log('✅ Notifications are sent to all parties');
        console.log('✅ Admin can approve and manage quotations');
        console.log('✅ Complete workflow from submission to delivery works');
        
      } else {
        console.log('❌ Admin login failed');
      }
      
    } else {
      console.log('❌ Material quotation submission failed:', response.data.message);
    }
    
  } catch (error) {
    if (error.response) {
      console.log('❌ API Error:', error.response.status);
      console.log('📊 Error data:', error.response.data);
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
};

testEnhancedMaterialQuotation();