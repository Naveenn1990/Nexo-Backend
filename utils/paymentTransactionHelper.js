const { PaymentTransaction } = require('../models/RegisterFee');

/**
 * Create a PaymentTransaction record for any payment-related activity
 * This ensures all financial transactions are tracked in /admin/fee-transactions
 */
async function createPaymentTransaction({
  partnerId,
  userId,
  amount,
  feeType,
  paymentMethod = 'manual',
  status = 'success',
  description,
  source = 'partner',
  transactionId,
  metadata = {}
}) {
  try {
    // Generate unique transaction ID if not provided
    if (!transactionId) {
      const timestamp = Date.now();
      const prefix = feeType.toUpperCase().substring(0, 4);
      const id = partnerId || userId || 'UNKNOWN';
      transactionId = `${prefix}-${id}-${timestamp}`;
    }

    // Ensure required fields
    if (!amount || amount <= 0) {
      console.warn('⚠️ Skipping PaymentTransaction creation: Invalid amount', { amount });
      return null;
    }

    if (!partnerId && !userId) {
      console.warn('⚠️ Skipping PaymentTransaction creation: No partnerId or userId provided');
      return null;
    }

    // Create the transaction record
    const transactionData = {
      amount,
      status,
      paymentMethod,
      transactionId,
      feeType,
      description: description || `${feeType.replace('_', ' ')} payment`,
      source,
      metadata: {
        ...metadata,
        source,
        createdBy: 'system',
        timestamp: new Date()
      }
    };

    // Add partner or user ID
    if (partnerId) {
      transactionData.partnerId = partnerId.toString();
    }
    if (userId) {
      transactionData.userId = userId.toString();
    }

    const transaction = await PaymentTransaction.create(transactionData);
    
    console.log(`✅ PaymentTransaction created: ${feeType} ₹${amount} for ${partnerId ? 'partner' : 'user'} ${partnerId || userId}`);
    return transaction;

  } catch (error) {
    console.error('❌ Error creating PaymentTransaction:', error);
    // Don't throw error to avoid breaking main operations
    return null;
  }
}

/**
 * Create PaymentTransaction for wallet recharge
 */
async function createWalletRechargeTransaction(partnerId, amount, paymentMethod, transactionId, metadata = {}) {
  return createPaymentTransaction({
    partnerId,
    amount,
    feeType: 'wallet_recharge',
    paymentMethod,
    transactionId,
    description: `Wallet recharge - ₹${amount}`,
    source: 'partner',
    metadata: {
      ...metadata,
      walletRecharge: true
    }
  });
}

/**
 * Create PaymentTransaction for lead fee deduction
 */
async function createLeadFeeTransaction(partnerId, amount, bookingId, serviceName, metadata = {}) {
  return createPaymentTransaction({
    partnerId,
    amount,
    feeType: 'lead_fee',
    paymentMethod: 'wallet',
    description: `Lead acceptance fee - ${serviceName} - Booking: ${bookingId}`,
    source: 'partner',
    metadata: {
      ...metadata,
      bookingId,
      serviceName,
      leadFeeDeduction: true
    }
  });
}

/**
 * Create PaymentTransaction for user payments (AMC, subscriptions, etc.)
 */
async function createUserPaymentTransaction(userId, amount, feeType, paymentMethod, transactionId, metadata = {}) {
  return createPaymentTransaction({
    userId,
    amount,
    feeType,
    paymentMethod,
    transactionId,
    description: `User ${feeType.replace('_', ' ')} payment - ₹${amount}`,
    source: 'user',
    metadata: {
      ...metadata,
      userPayment: true
    }
  });
}

/**
 * Create PaymentTransaction for admin manual entries
 */
async function createAdminManualTransaction(partnerId, amount, feeType, description, approvedBy, metadata = {}) {
  return createPaymentTransaction({
    partnerId,
    amount,
    feeType,
    paymentMethod: 'manual',
    description: `${description} - Manual approval by ${approvedBy}`,
    source: 'admin',
    metadata: {
      ...metadata,
      manualApproval: true,
      approvedBy,
      approvedAt: new Date()
    }
  });
}

module.exports = {
  createPaymentTransaction,
  createWalletRechargeTransaction,
  createLeadFeeTransaction,
  createUserPaymentTransaction,
  createAdminManualTransaction
};