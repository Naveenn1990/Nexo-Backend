const fetch = require('node-fetch');

async function testMaterialAPI() {
  try {
    console.log('🔍 Testing Material Categories API...');
    
    const apiUrl = 'https://nexo.works';
    const response = await fetch(`${apiUrl}/api/public/material-categories`);
    
    console.log('📡 API Response Status:', response.status);
    console.log('📡 API Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response Data:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.success && data.data && Array.isArray(data.data)) {
        console.log(`\n📦 Found ${data.data.length} material categories:`);
        data.data.forEach((category, index) => {
          console.log(`${index + 1}. ${category.name} (${category.icon}) - ${category.items?.length || 0} items`);
          if (category.items && category.items.length > 0) {
            category.items.slice(0, 3).forEach((item, itemIndex) => {
              const itemName = typeof item === 'string' ? item : item.name;
              console.log(`   - ${itemName}`);
            });
            if (category.items.length > 3) {
              console.log(`   ... and ${category.items.length - 3} more items`);
            }
          }
        });
      } else {
        console.log('⚠️  API returned unexpected data structure');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API Error Response:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMaterialAPI();