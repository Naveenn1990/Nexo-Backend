const Partner = require("../models/PartnerModel");
const Booking = require("../models/booking");
const SubService = require("../models/SubService");
const Wallet = require("../models/Wallet");
const { v4: uuidv4 } = require("uuid");

exports.topUpWallet = async (req, res) => {
  try {
    const partnerId = req.partner?._id || req.params?.partnerId;
    const { amount, type, description, reference } = req.body;

    if (!partnerId || !amount || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const lowerType = type.toLowerCase();
    if (!["credit", "debit"].includes(lowerType)) {
      return res.status(400).json({ message: "Invalid transaction type" });
    }

    const PartnerWallet = require("../models/PartnerWallet");
    let wallet = await PartnerWallet.findOne({ partner: partnerId });

    if (!wallet) {
      wallet = new PartnerWallet({ partner: partnerId, balance: 0, transactions: [] });
    }

    // Calculate new balance
    const transactionAmount = parseFloat(amount);
    let newBalance = wallet.balance;

    if (lowerType === "credit") {
      newBalance = wallet.balance + transactionAmount;
    } else if (lowerType === "debit") {
      if (wallet.balance < transactionAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      newBalance = wallet.balance - transactionAmount;
    }

    // Create transaction
    const transaction = {
      type: lowerType,
      amount: transactionAmount,
      description: description || 'Topup',
      reference: reference || `TOPUP-${Date.now()}`,
      balance: newBalance
    };

    // Add transaction and update balance
    wallet.transactions.push(transaction);
    wallet.balance = newBalance;

    await wallet.save();

    res.status(201).json({ 
      success: true,
      message: "Transaction successful", 
      wallet: await PartnerWallet.findOne({ partner: partnerId }).populate('partner', 'profile.name phone')
    });
  } catch (error) {
    console.error("Top-up wallet error:", error);
    res.status(500).json({ error: error.message });
  }
};


exports.transactionsWallet = async (req, res) => {
  try {
    const { partnerId } = req.params; // Use params instead of body

    if (!partnerId) {
      return res.status(400).json({ message: "Missing partner ID" });
    }

    // Retrieve partner wallet
    const wallet = await PartnerWallet.findOne({ partner: partnerId });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    res.status(200).json({ transactions: wallet.transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

