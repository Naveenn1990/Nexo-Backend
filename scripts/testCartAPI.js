const fetch = require('node-fetch');

async function testCartAPI() {
  try {
    console.log('🔍 Testing Cart API endpoints...');
    
    // You'll need to replace this with a valid partner token
    // For testing, you can get this from the browser's localStorage or network tab
    const token = 'YOUR_PARTNER_TOKEN_HERE';
    
    if (token === 'YOUR_PARTNER_TOKEN_HERE') {
      console.log('❌ Please update the token in the script with a valid partner token');
      console.log('💡 You can get this from browser localStorage or network tab when logged in as partner');
      return;
    }
    
    const baseURL = 'https://nexo.works/api/partner';
    
    // Test 1: Get Cart
    console.log('\n📦 Testing GET /cart...');
    const getCartResponse = await fetch(`${baseURL}/cart`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const cartData = await getCartResponse.json();
    console.log('Cart Response:', JSON.stringify(cartData, null, 2));
    
    // Test 2: Add to Cart (you'll need a valid product ID)
    console.log('\n📦 Testing POST /products/add...');
    const addToCartResponse = await fetch(`${baseURL}/products/add`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId: 'REPLACE_WITH_VALID_PRODUCT_ID',
        quantity: 1
      })
    });
    
    const addToCartData = await addToCartResponse.json();
    console.log('Add to Cart Response:', JSON.stringify(addToCartData, null, 2));
    
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}

testCartAPI();