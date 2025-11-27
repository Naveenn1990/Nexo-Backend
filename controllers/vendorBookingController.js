const VendorBooking = require("../models/VendorBooking");
const VendorSparePart = require("../models/VendorSparePart");
const admin = require("../config/firebase");

// Get all bookings for a vendor
exports.getBookings = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const { status, startDate, endDate } = req.query;

    const query = { vendor: vendorId };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) {
        query.orderDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.orderDate.$lte = new Date(endDate);
      }
    }

    const bookings = await VendorBooking.find(query)
      .populate("sparePart", "name price image")
      .populate("customer", "name phone email")
      .populate("partner", "phone profile.name")
      .sort({ orderDate: -1 });

    res.json({
      success: true,
      data: bookings,
      count: bookings.length,
    });
  } catch (error) {
    console.error("Get Bookings Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
};

// Get single booking
exports.getBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.vendor._id;

    const booking = await VendorBooking.findOne({
      _id: id,
      vendor: vendorId,
    })
      .populate("sparePart", "name price image description")
      .populate("customer", "name phone email")
      .populate("partner", "phone profile.name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Get Booking Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
    });
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, deliveryDate, notes } = req.body;
    const vendorId = req.vendor._id;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const validStatuses = ["pending", "confirmed", "dispatched", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const updateData = { status };
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (deliveryDate) updateData.deliveryDate = new Date(deliveryDate);
    if (notes) updateData.notes = notes;

    const booking = await VendorBooking.findOneAndUpdate(
      { _id: id, vendor: vendorId },
      { $set: updateData },
      { new: true }
    )
      .populate("sparePart", "name price")
      .populate("customer", "name phone email")
      .populate("partner", "phone profile.name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // If status is cancelled, restore stock
    if (status === "cancelled" && booking.status !== "cancelled") {
      const sparePart = await VendorSparePart.findById(booking.sparePart._id);
      if (sparePart) {
        sparePart.stock += booking.quantity;
        if (sparePart.stock > 0 && sparePart.status === "out_of_stock") {
          sparePart.status = "active";
        }
        await sparePart.save();
      }
    }

    // Send notification to customer/partner if status changed
    try {
      const vendor = await require("../models/VendorModel").findById(vendorId);
      const message = {
        notification: {
          title: "Booking Status Updated",
          body: `Your booking for ${booking.sparePart.name} is now ${status}`,
        },
      };

      if (booking.customer && booking.customer.fcmtoken) {
        await admin.messaging().send({
          ...message,
          token: booking.customer.fcmtoken,
        });
      }

      if (booking.partner && booking.partner.fcmtoken) {
        await admin.messaging().send({
          ...message,
          token: booking.partner.fcmtoken,
        });
      }
    } catch (notifError) {
      console.error("Notification error:", notifError);
    }

    res.json({
      success: true,
      message: "Booking status updated successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Update Booking Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update booking status",
    });
  }
};

// Get booking statistics
exports.getBookingStats = async (req, res) => {
  try {
    const vendorId = req.vendor._id;

    const stats = await VendorBooking.aggregate([
      { $match: { vendor: vendorId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalBookings = await VendorBooking.countDocuments({ vendor: vendorId });
    const totalRevenue = await VendorBooking.aggregate([
      { $match: { vendor: vendorId, status: "delivered" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    res.json({
      success: true,
      data: {
        stats,
        totalBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error("Get Booking Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking statistics",
    });
  }
};

