const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/partnerAuth");
const { adminAuth } = require("../middleware/adminAuth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const partnerServiceController = require("../controllers/partnerServiceController");
const partnerAuthController = require("../controllers/partnerAuthController");
const partnerWalletController = require("../controllers/partnerWalletController");

// Create upload directories if they don't exist
const uploadDir = path.join(__dirname, "..", "uploads");
const profilesDir = path.join(uploadDir, "profiles");
const kycDir = path.join(uploadDir, "kyc");
const bookingPhotosDir = path.join(uploadDir, "booking-photos");
const bookingVideosDir = path.join(uploadDir, "booking-videos");

// Create directories with recursive option
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(profilesDir, { recursive: true });
fs.mkdirSync(kycDir, { recursive: true });
fs.mkdirSync(bookingPhotosDir, { recursive: true });
fs.mkdirSync(bookingVideosDir, { recursive: true });

// Import controllers
const {
  getAvailableServices,
  selectService,
  getCurrentService,
  getServiceHistory,
  updateServiceStatus,
  getMatchingBookings,
  acceptBooking,
sendOtpWithNotification,
verifyOtpbooking,
sendSmsOtp,
} = partnerServiceController;

const {
  sendLoginOTP,
  resendOTP,
  verifyLoginOTP,
  getProfile,
  updateProfile,
  completeProfile,
  completeKYC,
  getAllPartnerProfile,
  updateKYCStatus,
  updateLocation,
  updateOnboardingStep
} = require("../controllers/partnerAuthController");

const {acceptBookingDriver,rejectBookingDriver,getByDriverId}=require('../controllers/DriverBooking')

const {
  getAllCategories,
} = require("../controllers/partnerDropdownController");



const upload = multer({

  limits: {
    fileSize: (file) =>
      file.fieldname === "videos" ? 100 * 1024 * 1024 : 5 * 1024 * 1024, // 100MB for videos, 5MB for images
  },

});

// Partner Authentication Routes
router.post("/auth/send-otp", sendLoginOTP);
router.post("/auth/resend-otp", resendOTP);
router.post("/auth/verify-otp", verifyLoginOTP);

// Partner Profile Routes (Protected)
router.get("/profile", auth, getProfile);
router.put("/profile/onboarding-step", auth, updateOnboardingStep);
router.get("/partnersprofile", getAllPartnerProfile);

router.put(
  "/profile/update",
  auth,
  (req, res, next) => {
    upload.single("profilePicture")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      next();
    });
  },
  updateProfile
);

router.post(
  "/profile/complete",
  auth,
 upload.single("profilePicture"),

  completeProfile
);



router.get("/getAllReferralpartner", adminAuth, partnerAuthController.getAllReferralpartner);

// Partner KYC Routes (Protected)
router.post(
  "/kyc/complete",
  auth,
  (req, res, next) => {
    upload.fields([
      { name: "panCard", maxCount: 1 },
      { name: "aadhaar", maxCount: 1 },
      { name: "aadhaarback", maxCount: 1 },
      { name: "chequeImage", maxCount: 1 },
      { name: "drivingLicence", maxCount: 1 },
      { name: "bill", maxCount: 1 },
    ])(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      // Log the files received
      // console.log("Files received:", req.files);
      next();
    });
  },
  completeKYC
);

// Admin route to update KYC status (Protected, Admin Only)
router.put("/kyc/:partnerId/status", adminAuth, updateKYCStatus);

router.get('/referralcode/:referralCode',auth,partnerAuthController.getReferralCode);

// Partner Service Hub Routes (Protected)
const adminServiceController = require("../controllers/adminServiceController");
const hubController = require("../controllers/hubController");
router.get("/service-hubs/available", auth, adminServiceController.getAllAvailableServiceHubs);
router.post("/service-hubs", auth, async (req, res) => {
  try {
    // Use the same controller but get partnerId from req.partner
    const partnerId = req.partner._id.toString();
    req.params.partnerId = partnerId;
    return adminServiceController.createPartnerServiceHub(req, res);
  } catch (error) {
    console.error('Partner Service Hub Creation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create service hub', error: error.message });
  }
});

// Partner Hub Assignment Routes (New Hub System)
router.post("/hubs/assign", auth, async (req, res) => {
  try {
    const { hubId } = req.body;
    if (!hubId) {
      return res.status(400).json({ success: false, message: 'Hub ID is required' });
    }
    const partnerId = req.partner._id.toString();
    console.log(`Assigning hub ${hubId} to partner ${partnerId}`);
    req.params.hubId = hubId;
    req.body.partnerId = partnerId;
    return hubController.assignHubToPartner(req, res);
  } catch (error) {
    console.error('Partner Hub Assignment Error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign hub', error: error.message });
  }
});

router.post("/hubs/unassign", auth, async (req, res) => {
  try {
    const { hubId } = req.body;
    if (!hubId) {
      return res.status(400).json({ success: false, message: 'Hub ID is required' });
    }
    const partnerId = req.partner._id.toString();
    req.params.hubId = hubId;
    req.body.partnerId = partnerId;
    return hubController.unassignHubFromPartner(req, res);
  } catch (error) {
    console.error('Partner Hub Unassignment Error:', error);
    res.status(500).json({ success: false, message: 'Failed to unassign hub', error: error.message });
  }
});

// Partner Service Routes (Protected)
router.get("/services/available", auth, getAvailableServices);
router.post("/services/select", auth, selectService);
router.get("/services/current", auth, getCurrentService);
router.get("/services/history", auth, getServiceHistory);
router.put("/services/status", auth, updateServiceStatus);
router.get("/bookings/matching", auth, getMatchingBookings);
router.put(
  "/bookings/:bookingId/accept",
  partnerServiceController.acceptBooking
);
router.put(
  "/bookings/:bookingId/reject",
  partnerServiceController.rejectBooking
);

// New route to mark an accepted booking as completed and handle photo/video uploads
router.post(
  "/bookings/:id/complete",
  auth,
  upload.fields([
    { name: "photos", maxCount: 10 },
    { name: "videos", maxCount: 5 },
      { name: "afterVideo", maxCount: 5 },
  ]),
  partnerServiceController.completeBooking
);

// Dropdown data route
router.get("/dropdown/categories", getAllCategories);

// Route to get all completed bookings for a partner
router.get(
  "/bookings/completed",
  auth,
  partnerServiceController.getCompletedBookings
);

// Route to get all pending bookings for a partner
router.get(
  "/bookings/pending",
  auth,
  partnerServiceController.getPendingBookings
);

// Route to get all rejected bookings for a partner
router.get(
  "/bookings/rejected",
  auth,
  partnerServiceController.getRejectedBookings
);
// Route to select a service and category
router.post(
  "/select-category-and-service",
  auth,
  partnerAuthController.selectCategoryAndServices
);

// Route to get all accepted bookings for a partner
router.get(
  "/bookings/accepted/:partnerId",
  auth,
  partnerServiceController.getPartnerBookings
);

// Route to pause a booking
router.post(
  "/bookings/:bookingId/pause",
  auth,
  partnerServiceController.pauseBooking
);

// Routes for paused bookings
router.get(
  "/bookings/paused",
  auth,
  partnerServiceController.getPausedBookings
);
router.post(
  "/bookings/:bookingId/resume",
  auth,
  partnerServiceController.resumeBooking
);

// Route to top up wallet
router.post("/wallet/topup", auth, partnerWalletController.topUpWallet);
// Route to get wallet transactions
router.get(
  "/partner/:partnerId/transactions",
  auth,
  partnerWalletController.transactionsWallet
);

router.get(
  "/products/:category",
  auth,
  partnerServiceController.getProductsByCategory
); // Get products by category
// router.put('/products/use/:id', auth, partnerServiceController.useProduct); // Use product (decrease stock)
// router.put('/products/return/:id', auth, partnerServiceController.returnProduct); // Return product (increase stock)
router.post("/products/add", auth, partnerServiceController.addToCart); // Add product to cart
router.get("/cart", auth, partnerServiceController.getCart); // Get partner's cart
router.delete("/cart/remove", auth, partnerServiceController.removeFromCart); // Remove item from cart
router.delete("/cart/clear", auth, partnerServiceController.clearCart); // Clear entire cart

// Spare Parts Order Management
router.post("/orders/place", auth, partnerServiceController.placeOrder); // Place order from cart
router.post("/orders/payment/initiate", auth, partnerServiceController.initiateOrderPayment); // Initiate payment for order
router.get("/orders", auth, partnerServiceController.getOrders); // Get partner's orders
router.get("/orders/:orderId", auth, partnerServiceController.getOrderDetails); // Get order details

// Order Payment Callbacks (public routes - called by PayU)
router.post("/order-payment-success", partnerServiceController.orderPaymentSuccess); // PayU success callback
router.post("/order-payment-failure", partnerServiceController.orderPaymentFailure); // PayU failure callback

router.put('/product/removecart',auth,partnerServiceController.removeCart); // Remove from booking cart (legacy)

router.put("/products/addmanulcart",upload.any(), auth, partnerServiceController.AddManulProductCart); // Get cart items

router.get("/bookings", auth, partnerServiceController.allpartnerBookings);

router.get("/bookings", auth, partnerServiceController.allpartnerBookings);

router.get(
  "/bookingbyid/:bookingId",
  auth,
  partnerServiceController.getBookingBybookid
);

// Route to get user reviews
router.get("/reviews/user", auth, partnerServiceController.getUserReviews);

// Route to review user
router.post("/reviews/user", auth, partnerServiceController.reviewUser);
router.put('/upload/review-video',upload.any(),auth,partnerServiceController.reviewVideo);
router.get("/getWalletbypartner", auth, partnerAuthController.getWallet);
router.put("/updateTokenFmc",auth,partnerAuthController.updateTokenFmc);
router.put("/updateLocation",auth,partnerAuthController.updateLocation);
router.put("/regigiste-fee",auth,partnerAuthController.completePaymentVendor)
router.post(
  "/addtransactionwallet",
  auth,
  partnerAuthController.addtransactionwallet
);
router.get(
  "/getAllwalletTransaction",
  auth,
  partnerAuthController.getAllwalletTransaction
);

router.put("/acceptdriver",auth,acceptBookingDriver);
router.put("/rejectdriver",auth,rejectBookingDriver);
router.get("/getByDriver",auth,getByDriverId);
router.post("/sendOtpWithNotification", auth, sendOtpWithNotification);
router.post("/verifyOtpbooking", auth, verifyOtpbooking);
router.post("/sendSmsOtp", auth, sendSmsOtp);

// MG Plan Routes (Partner)
const mgPlanController = require('../controllers/mgPlanController');
// Public route for fetching MG Plans (for onboarding page)
router.get("/mg-plans/public", mgPlanController.getAllPlans);
router.get("/mg-plans", auth, mgPlanController.getAllPlans);
router.get("/mg-plans/current", auth, mgPlanController.getPartnerPlan);
router.post("/mg-plans/subscribe", auth, mgPlanController.subscribeToPlan);
router.post("/mg-plans/renew", auth, mgPlanController.renewPlan);

// Public Partner Verification Route (No Auth Required)
router.get("/verify/:partnerId", partnerAuthController.verifyPartner);

// Team Member Routes
const teamMemberController = require("../controllers/teamMemberController");
router.get("/team-members", auth, teamMemberController.getTeamMembers);
router.post("/team-members", auth, upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'aadhaar', maxCount: 1 },
  { name: 'aadhaarback', maxCount: 1 },
  { name: 'chequeImage', maxCount: 1 },
  { name: 'drivingLicence', maxCount: 1 },
  { name: 'bill', maxCount: 1 }
]), teamMemberController.addTeamMember);
router.put("/team-members/:memberId", upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'aadhaar', maxCount: 1 },
  { name: 'aadhaarback', maxCount: 1 },
  { name: 'chequeImage', maxCount: 1 },
  { name: 'drivingLicence', maxCount: 1 },
  { name: 'bill', maxCount: 1 }
]), auth, teamMemberController.updateTeamMember);
router.delete("/team-members/:memberId", auth, teamMemberController.deleteTeamMember);
router.get("/team-members/:memberId/activities", auth, teamMemberController.getTeamMemberActivities);
router.post("/team-members/assign-booking", auth, teamMemberController.assignBookingToTeamMember);

// Partner Notifications
// IMPORTANT: Order matters! More specific routes must come first
const partnerNotificationController = require("../controllers/partnerNotification");
router.get("/notifications", auth, partnerNotificationController.getPartnerNotifications);
router.put("/notifications/mark-read", auth, partnerNotificationController.markAllAsRead);
router.put("/notifications/:id/mark-read", auth, partnerNotificationController.markAsRead);

// Quotation Routes
const quotationController = require("../controllers/quotationController");
router.post("/bookings/:bookingId/quotation", auth, quotationController.createQuotation);
router.get("/bookings/:bookingId/quotations", auth, quotationController.getQuotationsByBooking);
router.get("/quotations", auth, quotationController.getPartnerQuotations);
router.get("/quotations/:quotationId", auth, quotationController.getQuotationById);

module.exports = router;
