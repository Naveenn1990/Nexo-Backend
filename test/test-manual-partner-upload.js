const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test manual partner registration with file uploads
async function testManualPartnerRegistration() {
  const API_URL = process.env.API_URL || 'http://localhost:5000';
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-admin-token-here';

  console.log('Testing Manual Partner Registration with File Uploads...\n');

  const formData = new FormData();

  // Add basic fields
  formData.append('phone', '9876543210');
  formData.append('whatsappNumber', '9876543210');
  formData.append('name', 'Test Partner Upload');
  formData.append('email', 'testupload@example.com');
  formData.append('qualification', 'ITI');
  formData.append('experience', '5 years');
  formData.append('partnerType', 'individual');
  formData.append('address', '123 Test Street');
  formData.append('landmark', 'Near Test Mall');
  formData.append('pincode', '560001');
  formData.append('city', 'Bangalore');
  formData.append('modeOfService', 'both');
  formData.append('profileStatus', 'active');
  formData.append('paidBy', 'Admin');
  formData.append('paymentApproved', 'true');
  formData.append('registerdFee', 'true');
  formData.append('termsAccepted', 'true');

  // Add arrays as JSON
  formData.append('category', JSON.stringify([]));
  formData.append('categoryNames', JSON.stringify([]));
  formData.append('selectedHubs', JSON.stringify([]));

  // Add bank details
  formData.append('bankDetails', JSON.stringify({
    accountNumber: '1234567890',
    ifscCode: 'TEST0001234',
    accountHolderName: 'Test Partner',
    bankName: 'Test Bank'
  }));

  // Add payment info
  formData.append('registerAmount', '500');
  formData.append('securityDeposit', '1000');
  formData.append('toolkitPrice', '0');

  // Create a test image file (1x1 pixel PNG)
  const testImageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // Add test files
  formData.append('profilePicture', testImageBuffer, {
    filename: 'test-profile.png',
    contentType: 'image/png'
  });

  formData.append('panCard', testImageBuffer, {
    filename: 'test-pan.png',
    contentType: 'image/png'
  });

  formData.append('aadhaar', testImageBuffer, {
    filename: 'test-aadhaar.png',
    contentType: 'image/png'
  });

  try {
    console.log('Sending request to:', `${API_URL}/api/admin/partners/manual-register`);
    console.log('Form data fields:', Object.keys(formData.getHeaders()));

    const response = await fetch(`${API_URL}/api/admin/partners/manual-register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.get('content-type'));

    const data = await response.json();
    console.log('\nResponse data:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ SUCCESS: Partner registered with files!');
      console.log('Partner ID:', data.partner._id);
      console.log('Profile Picture:', data.partner.profilePicture);
      console.log('KYC Documents:', data.partner.kyc);
    } else {
      console.log('\n❌ FAILED:', data.message);
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testManualPartnerRegistration();
