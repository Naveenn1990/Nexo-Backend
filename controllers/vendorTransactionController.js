const VendorTransaction = require("../models/VendorTransaction");
const VendorBooking = require("../models/VendorBooking");

// Get all transactions for a vendor
exports.getTransactions = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const { type, status, startDate, endDate } = req.query;

    const query = { vendor: vendorId };

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) {
        query.transactionDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.transactionDate.$lte = new Date(endDate);
      }
    }

    const transactions = await VendorTransaction.find(query)
      .populate("booking", "sparePart totalAmount")
      .sort({ transactionDate: -1 });

    res.json({
      success: true,
      data: transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error("Get Transactions Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
    });
  }
};

// Get single transaction
exports.getTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.vendor._id;

    const transaction = await VendorTransaction.findOne({
      _id: id,
      vendor: vendorId,
    }).populate("booking", "sparePart totalAmount");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Get Transaction Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction",
    });
  }
};

// Get transaction statistics
exports.getTransactionStats = async (req, res) => {
  try {
    const vendorId = req.vendor._id;

    const stats = await VendorTransaction.aggregate([
      { $match: { vendor: vendorId } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalCredits = await VendorTransaction.aggregate([
      { $match: { vendor: vendorId, type: "credit", status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalDebits = await VendorTransaction.aggregate([
      { $match: { vendor: vendorId, type: "debit", status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const balance = (totalCredits[0]?.total || 0) - (totalDebits[0]?.total || 0);

    res.json({
      success: true,
      data: {
        stats,
        totalCredits: totalCredits[0]?.total || 0,
        totalDebits: totalDebits[0]?.total || 0,
        balance,
      },
    });
  } catch (error) {
    console.error("Get Transaction Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction statistics",
    });
  }
};

// Create transaction (usually called when booking is confirmed/delivered)
exports.createTransaction = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const { bookingId, type, amount, description, paymentMethod, reference } = req.body;

    if (!type || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: "Type, amount, and description are required",
      });
    }

    // Verify booking exists and belongs to vendor
    if (bookingId) {
      const booking = await VendorBooking.findOne({
        _id: bookingId,
        vendor: vendorId,
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }
    }

    const transaction = new VendorTransaction({
      vendor: vendorId,
      booking: bookingId,
      type,
      amount: parseFloat(amount),
      description,
      paymentMethod: paymentMethod || "online",
      reference: reference || `TXN-${Date.now()}`,
      status: "completed",
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: transaction,
    });
  } catch (error) {
    console.error("Create Transaction Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create transaction",
    });
  }
};

