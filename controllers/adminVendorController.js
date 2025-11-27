const Vendor = require("../models/VendorModel");
const VendorSparePart = require("../models/VendorSparePart");
const VendorBooking = require("../models/VendorBooking");
const VendorTransaction = require("../models/VendorTransaction");

// Get all vendors
exports.getAllVendors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { gstNumber: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const total = await Vendor.countDocuments(query);

    const vendors = await Vendor.find(query)
      .select("-password -tempOTP -otpExpiry")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    // Get stats for each vendor
    const vendorsWithStats = await Promise.all(
      vendors.map(async (vendor) => {
        const [sparePartsCount, bookingsCount, transactionsStats] = await Promise.all([
          VendorSparePart.countDocuments({ vendor: vendor._id }),
          VendorBooking.countDocuments({ vendor: vendor._id }),
          VendorTransaction.aggregate([
            { $match: { vendor: vendor._id, status: 'completed' } },
            {
              $group: {
                _id: null,
                totalCredits: {
                  $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] }
                },
                totalDebits: {
                  $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] }
                },
              },
            },
          ]),
        ]);

        const stats = transactionsStats[0] || { totalCredits: 0, totalDebits: 0 };
        const balance = stats.totalCredits - stats.totalDebits;

        return {
          ...vendor.toObject(),
          stats: {
            sparePartsCount,
            bookingsCount,
            totalRevenue: stats.totalCredits,
            balance,
          },
        };
      })
    );

    res.json({
      success: true,
      vendors: vendorsWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get Vendors Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching vendors",
    });
  }
};

// Get vendor details
exports.getVendorDetails = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId).select("-password -tempOTP -otpExpiry");

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Get vendor statistics
    const [spareParts, bookings, transactions] = await Promise.all([
      VendorSparePart.find({ vendor: vendorId }).sort({ createdAt: -1 }),
      VendorBooking.find({ vendor: vendorId })
        .populate("sparePart", "name price")
        .populate("customer", "name phone email")
        .populate("partner", "phone profile.name")
        .sort({ orderDate: -1 })
        .limit(50),
      VendorTransaction.find({ vendor: vendorId })
        .populate("booking", "sparePart totalAmount")
        .sort({ transactionDate: -1 })
        .limit(50),
    ]);

    // Calculate statistics
    const transactionsStats = await VendorTransaction.aggregate([
      { $match: { vendor: vendorId, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalCredits: {
            $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] }
          },
          totalDebits: {
            $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] }
          },
        },
      },
    ]);

    const stats = transactionsStats[0] || { totalCredits: 0, totalDebits: 0 };

    res.json({
      success: true,
      vendor: {
        ...vendor.toObject(),
        stats: {
          sparePartsCount: spareParts.length,
          bookingsCount: bookings.length,
          totalRevenue: stats.totalCredits,
          totalDebits: stats.totalDebits,
          balance: stats.totalCredits - stats.totalDebits,
        },
        spareParts: spareParts.slice(0, 10),
        recentBookings: bookings.slice(0, 10),
        recentTransactions: transactions.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("Get Vendor Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching vendor details",
    });
  }
};

// Create vendor
exports.createVendor = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      companyName,
      address,
      gstNumber,
      panNumber,
      bankDetails,
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, and password are required",
      });
    }

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: "Vendor with this email or phone already exists",
      });
    }

    // Create vendor (password will be hashed by pre-save hook)
    const vendor = new Vendor({
      name,
      email: email.toLowerCase().trim(),
      phone,
      password, // Will be hashed by pre-save hook
      companyName,
      address,
      gstNumber,
      panNumber,
      bankDetails,
      status: 'active',
    });

    await vendor.save();

    res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        companyName: vendor.companyName,
        status: vendor.status,
      },
    });
  } catch (error) {
    console.error("Create Vendor Error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating vendor",
    });
  }
};

// Update vendor status (block/unblock)
exports.updateVendorStatus = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required (active, inactive, suspended)",
      });
    }

    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      { status },
      { new: true }
    ).select("-password -tempOTP -otpExpiry");

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Send notification to vendor
    try {
      const { sendVendorNotification } = require("../services/notificationService");
      const notificationTitle = status === 'active' ? 'Account Activated' : status === 'suspended' ? 'Account Suspended' : 'Account Deactivated';
      const notificationMessage = status === 'active' 
        ? 'Your vendor account has been activated. You can now manage your spare parts and bookings.'
        : status === 'suspended'
        ? 'Your vendor account has been suspended. Please contact support for more information.'
        : 'Your vendor account has been deactivated. Please contact support for more information.';
      
      await sendVendorNotification(
        vendorId,
        notificationTitle,
        notificationMessage,
        status === 'active' ? 'success' : 'alert',
        '/android-chrome-192x192.png'
      );
    } catch (notifError) {
      console.error("Error sending notification to vendor:", notifError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      message: `Vendor ${status === 'active' ? 'activated' : status === 'suspended' ? 'suspended' : 'deactivated'} successfully`,
      vendor,
    });
  } catch (error) {
    console.error("Update Vendor Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating vendor status",
    });
  }
};

// Update vendor details
exports.updateVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const updateData = req.body;

    console.log('Update vendor request:', { vendorId, updateDataKeys: Object.keys(updateData), hasPassword: !!updateData.password });

    // Find vendor first (need to fetch with password to check if it exists)
    const vendor = await Vendor.findById(vendorId).select('+password');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.tempOTP;
    delete updateData.otpExpiry;

    // Handle password separately - only update if provided and not empty
    let passwordUpdated = false;
    let newPasswordValue = null;
    if (updateData.password !== undefined && updateData.password && updateData.password.trim() !== '') {
      // Password provided - set it and mark as modified to trigger pre-save hook
      newPasswordValue = updateData.password.trim();
      vendor.password = newPasswordValue;
      vendor.markModified('password'); // Explicitly mark password as modified
      passwordUpdated = true;
      delete updateData.password;
      console.log('Password update requested for vendor:', vendorId);
    } else if (updateData.password !== undefined) {
      // Empty password - don't update password field
      delete updateData.password;
      console.log('Password field empty, keeping existing password');
    }

    // Normalize email if being updated
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase().trim();
    }

    // Update other fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && updateData[key] !== null) {
        // Handle nested objects (address, bankDetails)
        if (typeof updateData[key] === 'object' && !Array.isArray(updateData[key]) && updateData[key] !== null) {
          vendor[key] = { ...(vendor[key] || {}), ...updateData[key] };
          vendor.markModified(key);
        } else {
          vendor[key] = updateData[key];
        }
      }
    });

    // Check if password was modified before saving
    const isPasswordModified = vendor.isModified('password');
    console.log('Password modified check:', isPasswordModified, 'Password updated flag:', passwordUpdated);

    // Save vendor (this will trigger pre-save hook for password hashing)
    await vendor.save();
    console.log('Vendor saved successfully:', vendorId);

    // Verify password was updated if it was supposed to be
    if (passwordUpdated && newPasswordValue) {
      const verifyVendor = await Vendor.findById(vendorId).select('+password');
      const testMatch = await verifyVendor.comparePassword(newPasswordValue);
      console.log('Password verification after update:', testMatch);
      if (!testMatch) {
        console.error('WARNING: Password update may have failed - verification failed');
      }
    }

    // Return vendor without sensitive fields
    const updatedVendor = await Vendor.findById(vendorId).select("-password -tempOTP -otpExpiry");

    res.json({
      success: true,
      message: "Vendor updated successfully",
      vendor: updatedVendor,
    });
  } catch (error) {
    console.error("Update Vendor Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating vendor",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete vendor
exports.deleteVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Check if vendor has any bookings or transactions
    const [bookingsCount, transactionsCount] = await Promise.all([
      VendorBooking.countDocuments({ vendor: vendorId }),
      VendorTransaction.countDocuments({ vendor: vendorId }),
    ]);

    if (bookingsCount > 0 || transactionsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete vendor with existing bookings or transactions. Please suspend instead.",
      });
    }

    // Delete vendor and related data
    await Promise.all([
      Vendor.findByIdAndDelete(vendorId),
      VendorSparePart.deleteMany({ vendor: vendorId }),
    ]);

    res.json({
      success: true,
      message: "Vendor deleted successfully",
    });
  } catch (error) {
    console.error("Delete Vendor Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting vendor",
    });
  }
};

// Get all vendor spare parts (for admin)
exports.getAllVendorSpareParts = async (req, res) => {
  try {
    const { vendorId, category, status, search } = req.query;

    const query = {};

    // Filter by vendor if specified
    if (vendorId) {
      query.vendor = vendorId;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const spareParts = await VendorSparePart.find(query)
      .populate("vendor", "name email companyName phone")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: spareParts,
      count: spareParts.length,
    });
  } catch (error) {
    console.error("Get All Vendor Spare Parts Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor spare parts",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get spare parts for a specific vendor (for admin)
exports.getVendorSpareParts = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { category, status, search } = req.query;

    const query = { vendor: vendorId };

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    const spareParts = await VendorSparePart.find(query)
      .populate("vendor", "name email companyName phone")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: spareParts,
      count: spareParts.length,
    });
  } catch (error) {
    console.error("Get Vendor Spare Parts Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor spare parts",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

