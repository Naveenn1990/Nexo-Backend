/**
 * Test Script for Manual Partner Registration
 * 
 * This script verifies that all fields are properly saved to the database
 * Run with: node backend/test/test-manual-registration.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Partner = require('../models/PartnerModel');

async function verifyPartnerData(phone) {
  try {
    console.log('\n🔍 Fetching partner data for phone:', phone);
    
    const partner = await Partner.findOne({ phone })
      .populate('category', 'name')
      .populate('mgPlan', 'name price leads commission')
      .lean();

    if (!partner) {
      console.log('❌ Partner not found!');
      return;
    }

    console.log('\n✅ Partner found! Verifying all fields...\n');

    // Personal Information
    console.log('📋 PERSONAL INFORMATION:');
    console.log('  Phone:', partner.phone || '❌ MISSING');
    console.log('  WhatsApp:', partner.whatsappNumber || '❌ MISSING');
    console.log('  Name:', partner.profile?.name || '❌ MISSING');
    console.log('  Email:', partner.profile?.email || '❌ MISSING');
    console.log('  Qualification:', partner.qualification || '⚠️  Not provided');
    console.log('  Experience:', partner.experience || '⚠️  Not provided');
    console.log('  Partner Type:', partner.partnerType || '❌ MISSING');
    console.log('  Agent Name:', partner.agentName || '⚠️  Not provided');

    // Address Information
    console.log('\n📍 ADDRESS INFORMATION:');
    console.log('  Address:', partner.profile?.address || '❌ MISSING');
    console.log('  Landmark:', partner.profile?.landmark || '❌ MISSING');
    console.log('  Pincode:', partner.profile?.pincode || '❌ MISSING');
    console.log('  City:', partner.profile?.city || '❌ MISSING');
    console.log('  GST Number:', partner.profile?.gstNumber || '⚠️  Not provided');

    // Service Information
    console.log('\n🛠️  SERVICE INFORMATION:');
    console.log('  Categories:', partner.category?.length || 0, 'selected');
    if (partner.category?.length > 0) {
      partner.category.forEach(cat => {
        console.log('    -', cat.name || cat);
      });
    }
    console.log('  Category Names:', partner.categoryNames?.join(', ') || '⚠️  Not provided');
    console.log('  Mode of Service:', partner.modeOfService || '❌ MISSING');
    console.log('  Service Hubs:', partner.serviceHubs?.length || 0, 'selected');
    if (partner.serviceHubs?.length > 0) {
      partner.serviceHubs.forEach(hub => {
        console.log('    -', hub.name, '(', hub.pinCodes?.length || 0, 'pin codes)');
      });
    }

    // Profile Picture
    console.log('\n📸 PROFILE PICTURE:');
    console.log('  Profile Picture:', partner.profilePicture || '⚠️  Not uploaded');

    // KYC Documents
    console.log('\n📄 KYC DOCUMENTS:');
    console.log('  Status:', partner.kyc?.status || '❌ MISSING');
    console.log('  PAN Card:', partner.kyc?.panCard || '⚠️  Not uploaded');
    console.log('  Aadhaar Front:', partner.kyc?.aadhaar || '⚠️  Not uploaded');
    console.log('  Aadhaar Back:', partner.kyc?.aadhaarback || '⚠️  Not uploaded');
    console.log('  Driving Licence:', partner.kyc?.drivingLicence || '⚠️  Not uploaded');
    console.log('  Utility Bill:', partner.kyc?.bill || '⚠️  Not uploaded');
    console.log('  Cheque Image:', partner.kyc?.chequeImage || '⚠️  Not uploaded');

    // Bank Details
    console.log('\n🏦 BANK DETAILS:');
    console.log('  Account Number:', partner.bankDetails?.accountNumber || '⚠️  Not provided');
    console.log('  IFSC Code:', partner.bankDetails?.ifscCode || '⚠️  Not provided');
    console.log('  Account Holder:', partner.bankDetails?.accountHolderName || '⚠️  Not provided');
    console.log('  Bank Name:', partner.bankDetails?.bankName || '⚠️  Not provided');

    // Payment Information
    console.log('\n💰 PAYMENT INFORMATION:');
    console.log('  Registration Amount: ₹', partner.profile?.registerAmount || 0);
    console.log('  Security Deposit: ₹', partner.profile?.securityDeposit || 0);
    console.log('  Toolkit Price: ₹', partner.profile?.toolkitPrice || 0);
    console.log('  Registration Fee Paid:', partner.profile?.registerdFee ? '✅ Yes' : '❌ No');
    console.log('  Payment Approved:', partner.profile?.paymentApproved ? '✅ Yes' : '❌ No');
    console.log('  Paid By:', partner.profile?.paidBy || '❌ MISSING');
    console.log('  Approved By:', partner.profile?.approvedBy || '⚠️  Not set');
    console.log('  Approved At:', partner.profile?.approvedAt || '⚠️  Not set');

    // MG Plan
    console.log('\n🎯 MG PLAN:');
    if (partner.mgPlan) {
      console.log('  Plan:', partner.mgPlan.name || partner.mgPlan);
      console.log('  Lead Quota:', partner.mgPlanLeadQuota || 0);
      console.log('  Leads Used:', partner.mgPlanLeadsUsed || 0);
      console.log('  Subscribed At:', partner.mgPlanSubscribedAt || '❌ MISSING');
      console.log('  Expires At:', partner.mgPlanExpiresAt || '❌ MISSING');
      console.log('  History Entries:', partner.mgPlanHistory?.length || 0);
    } else {
      console.log('  ⚠️  No MG plan selected');
    }

    // Terms & Signature
    console.log('\n📝 TERMS & SIGNATURE:');
    console.log('  Terms Accepted:', partner.terms?.accepted ? '✅ Yes' : '❌ No');
    console.log('  Signature:', partner.terms?.signature ? '✅ Provided' : '⚠️  Not provided');
    console.log('  Accepted At:', partner.terms?.acceptedAt || '⚠️  Not set');

    // Status & Approval
    console.log('\n✅ STATUS & APPROVAL:');
    console.log('  Status:', partner.status || '❌ MISSING');
    console.log('  Approved At:', partner.approvedAt || '⚠️  Not set');
    console.log('  Profile Completed:', partner.profileCompleted ? '✅ Yes' : '❌ No');
    console.log('  Profile Status:', partner.profileStatus || '❌ MISSING');
    console.log('  Referral Code:', partner.referralCode || '❌ MISSING');

    // Onboarding Progress
    console.log('\n📊 ONBOARDING PROGRESS:');
    const progress = partner.onboardingProgress || {};
    for (let i = 1; i <= 11; i++) {
      const step = progress[`step${i}`];
      if (step) {
        const status = step.completed ? '✅' : '❌';
        const approved = step.approved ? ' (Approved)' : '';
        console.log(`  Step ${i}: ${status}${approved}`);
      }
    }

    // Summary
    console.log('\n📈 SUMMARY:');
    const totalFields = 50;
    let filledFields = 0;
    
    // Count filled fields
    if (partner.phone) filledFields++;
    if (partner.whatsappNumber) filledFields++;
    if (partner.profile?.name) filledFields++;
    if (partner.profile?.email) filledFields++;
    if (partner.qualification) filledFields++;
    if (partner.experience) filledFields++;
    if (partner.partnerType) filledFields++;
    if (partner.profile?.address) filledFields++;
    if (partner.profile?.landmark) filledFields++;
    if (partner.profile?.pincode) filledFields++;
    if (partner.profile?.city) filledFields++;
    if (partner.category?.length > 0) filledFields++;
    if (partner.modeOfService) filledFields++;
    if (partner.profilePicture) filledFields++;
    if (partner.kyc?.status) filledFields++;
    if (partner.bankDetails?.accountNumber) filledFields++;
    if (partner.profile?.registerAmount !== undefined) filledFields++;
    if (partner.profile?.securityDeposit !== undefined) filledFields++;
    if (partner.profile?.toolkitPrice !== undefined) filledFields++;
    if (partner.status) filledFields++;
    if (partner.referralCode) filledFields++;
    
    console.log(`  Fields Filled: ${filledFields}/${totalFields}`);
    console.log(`  Completion: ${Math.round((filledFields/totalFields) * 100)}%`);
    
    if (filledFields === totalFields) {
      console.log('\n🎉 All fields are properly saved!');
    } else {
      console.log('\n⚠️  Some optional fields are not filled (this is normal)');
    }

    console.log('\n✅ Verification complete!\n');

  } catch (error) {
    console.error('❌ Error verifying partner data:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Get phone number from command line argument
const phone = process.argv[2];

if (!phone) {
  console.log('Usage: node test-manual-registration.js <phone_number>');
  console.log('Example: node test-manual-registration.js 1234567890');
  process.exit(1);
}

verifyPartnerData(phone);
