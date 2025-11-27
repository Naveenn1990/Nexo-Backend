/**
 * Automated Payment API Test Suite
 * 
 * Tests all PayU payment endpoints
 * 
 * Usage:
 *   node test/test-payment-apis.js
 * 
 * Requirements:
 *   - Backend server running
 *   - Valid partner token
 *   - Valid partner ID
 */

require('dotenv').config();
const axios = require('axios');
const colors = require('colors');

// Configuration
const API_URL = process.env.BASE_URL || 'http://localhost:9000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'YOUR_TOKEN_HERE';
const TEST_PARTNER_ID = process.env.TEST_PARTNER_ID || 'YOUR_PARTNER_ID_HERE';

// Test results
const results = {
  passed: 0,
  failed: 0,
  total: 0,
  tests: []
};

// Helper function to log test results
function logTest(name, passed, message = '') {
  results.total++;
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`.green);
    if (message) console.log(`   ${message}`.gray);
  } else {
    results.failed++;
    console.log(`❌ ${name}`.red);
    if (message) console.log(`   ${message}`.yellow);
  }
  results.tests.push({ name, passed, message });
}

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

// Test Suite
async function runTests() {
  console.log('\n' + '='.repeat(60).cyan);
  console.log('  PAYMENT API TEST SUITE'.cyan.bold);
  console.log('='.repeat(60).cyan + '\n');
  
  console.log(`API URL: ${API_URL}`.gray);
  console.log(`Partner ID: ${TEST_PARTNER_ID}`.gray);
  console.log(`Token: ${TEST_TOKEN.substring(0, 20)}...`.gray);
  console.log('');
  
  let txnid = null;
  
  // TEST 1: Health Check
  console.log('\n📋 TEST 1: Health Check'.bold);
  try {
    const result = await apiCall('GET', '/api/payu/health');
    logTest(
      'Health Check',
      result.success && result.data.success === true,
      result.success ? `Message: ${result.data.message}` : `Error: ${result.error}`
    );
  } catch (error) {
    logTest('Health Check', false, error.message);
  }
  
  // TEST 2: Initiate Payment (Valid)
  console.log('\n📋 TEST 2: Initiate Payment (Valid Request)'.bold);
  try {
    const result = await apiCall(
      'POST',
      '/api/payu/initiate-payment',
      {
        amount: 5000,
        phone: '9876543210',
        name: 'Test User',
        email: 'test@example.com',
        partnerId: TEST_PARTNER_ID
      },
      { Authorization: `Bearer ${TEST_TOKEN}` }
    );
    
    if (result.success && result.data.success) {
      txnid = result.data.data.txnid;
      logTest(
        'Initiate Payment (Valid)',
        true,
        `Transaction ID: ${txnid}`
      );
    } else {
      logTest(
        'Initiate Payment (Valid)',
        false,
        `Error: ${JSON.stringify(result.error)}`
      );
    }
  } catch (error) {
    logTest('Initiate Payment (Valid)', false, error.message);
  }
  
  // TEST 3: Initiate Payment (Missing Fields)
  console.log('\n📋 TEST 3: Initiate Payment (Missing Fields)'.bold);
  try {
    const result = await apiCall(
      'POST',
      '/api/payu/initiate-payment',
      {
        amount: 5000,
        phone: '9876543210'
      },
      { Authorization: `Bearer ${TEST_TOKEN}` }
    );
    
    logTest(
      'Initiate Payment (Missing Fields)',
      !result.success && result.status === 400,
      result.success ? 'Should have failed' : `Error: ${result.error.message}`
    );
  } catch (error) {
    logTest('Initiate Payment (Missing Fields)', false, error.message);
  }
  
  // TEST 4: Initiate Payment (Invalid Partner ID)
  console.log('\n📋 TEST 4: Initiate Payment (Invalid Partner ID)'.bold);
  try {
    const result = await apiCall(
      'POST',
      '/api/payu/initiate-payment',
      {
        amount: 5000,
        phone: '9876543210',
        name: 'Test User',
        email: 'test@example.com',
        partnerId: '000000000000000000000000'
      },
      { Authorization: `Bearer ${TEST_TOKEN}` }
    );
    
    logTest(
      'Initiate Payment (Invalid Partner)',
      !result.success && result.status === 404,
      result.success ? 'Should have failed' : `Error: ${result.error.message}`
    );
  } catch (error) {
    logTest('Initiate Payment (Invalid Partner)', false, error.message);
  }
  
  // TEST 5: Check Payment Status (Initiated)
  if (txnid) {
    console.log('\n📋 TEST 5: Check Payment Status (Initiated)'.bold);
    try {
      const result = await apiCall(
        'GET',
        `/api/payu/payment-status/${txnid}`,
        null,
        { Authorization: `Bearer ${TEST_TOKEN}` }
      );
      
      logTest(
        'Check Status (Initiated)',
        result.success && result.data.data.status === 'initiated',
        result.success 
          ? `Status: ${result.data.data.status}, Approved: ${result.data.data.approved}`
          : `Error: ${JSON.stringify(result.error)}`
      );
    } catch (error) {
      logTest('Check Status (Initiated)', false, error.message);
    }
  } else {
    logTest('Check Status (Initiated)', false, 'No transaction ID from previous test');
  }
  
  // TEST 6: Check Payment Status (Not Found)
  console.log('\n📋 TEST 6: Check Payment Status (Not Found)'.bold);
  try {
    const result = await apiCall(
      'GET',
      '/api/payu/payment-status/TXN9999999999999999',
      null,
      { Authorization: `Bearer ${TEST_TOKEN}` }
    );
    
    logTest(
      'Check Status (Not Found)',
      !result.success && result.status === 404,
      result.success ? 'Should have failed' : `Error: ${result.error.message}`
    );
  } catch (error) {
    logTest('Check Status (Not Found)', false, error.message);
  }
  
  // TEST 7: Payment Success Callback (Simulated)
  if (txnid) {
    console.log('\n📋 TEST 7: Payment Success Callback (Simulated)'.bold);
    console.log('⚠️  Note: This test simulates PayU callback without hash verification'.yellow);
    
    try {
      // Note: This will fail hash verification in production
      // For testing, you may need to temporarily disable hash verification
      const result = await axios.post(
        `${API_URL}/api/payu/payment-success`,
        new URLSearchParams({
          txnid: txnid,
          mihpayid: 'TEST123456789',
          status: 'success',
          amount: '5000',
          firstname: 'Test User',
          email: 'test@example.com',
          productinfo: 'Partner Registration Fee',
          key: process.env.PAYU_MERCHANT_KEY || 'test',
          hash: 'test_hash'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          maxRedirects: 0,
          validateStatus: (status) => status === 302 || status === 200
        }
      );
      
      logTest(
        'Payment Success Callback',
        result.status === 302,
        result.status === 302 
          ? `Redirected to: ${result.headers.location}`
          : 'Expected 302 redirect'
      );
    } catch (error) {
      if (error.response && error.response.status === 302) {
        logTest(
          'Payment Success Callback',
          true,
          `Redirected to: ${error.response.headers.location}`
        );
      } else {
        logTest('Payment Success Callback', false, error.message);
      }
    }
  } else {
    logTest('Payment Success Callback', false, 'No transaction ID from previous test');
  }
  
  // TEST 8: Check Payment Status (After Success - if callback worked)
  if (txnid) {
    console.log('\n📋 TEST 8: Check Payment Status (After Success)'.bold);
    console.log('⚠️  This test may fail if hash verification prevented callback'.yellow);
    
    // Wait a bit for callback to process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const result = await apiCall(
        'GET',
        `/api/payu/payment-status/${txnid}`,
        null,
        { Authorization: `Bearer ${TEST_TOKEN}` }
      );
      
      const isCompleted = result.success && result.data.data.status === 'completed';
      logTest(
        'Check Status (After Success)',
        isCompleted,
        result.success 
          ? `Status: ${result.data.data.status}, Approved: ${result.data.data.approved}`
          : `Error: ${JSON.stringify(result.error)}`
      );
      
      if (!isCompleted && result.success) {
        console.log('   ℹ️  Status is still "initiated" - PayU callback may have failed hash verification'.yellow);
      }
    } catch (error) {
      logTest('Check Status (After Success)', false, error.message);
    }
  } else {
    logTest('Check Status (After Success)', false, 'No transaction ID from previous test');
  }
  
  // Print Summary
  console.log('\n' + '='.repeat(60).cyan);
  console.log('  TEST SUMMARY'.cyan.bold);
  console.log('='.repeat(60).cyan);
  console.log(`Total Tests: ${results.total}`.white);
  console.log(`Passed: ${results.passed}`.green);
  console.log(`Failed: ${results.failed}`.red);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`.yellow);
  console.log('='.repeat(60).cyan + '\n');
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
console.log('\n🚀 Starting Payment API Tests...\n'.bold);
runTests().catch(error => {
  console.error('Test suite failed:'.red, error);
  process.exit(1);
});
