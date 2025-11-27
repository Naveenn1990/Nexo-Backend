const express = require("express");
const router = express.Router();
const { vendorAuth } = require("../middleware/vendorAuth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Import controllers
const vendorAuthController = require("../controllers/vendorAuthController");
const vendorSparePartController = require("../controllers/vendorSparePartController");
const vendorBookingController = require("../controllers/vendorBookingController");
const vendorTransactionController = require("../controllers/vendorTransactionController");
const vendorNotificationController = require("../controllers/vendorNotificationController");

// Create upload directories if they don't exist
const uploadDir = path.join(__dirname, "..", "uploads");
const sparePartsDir = path.join(uploadDir, "spare-parts");

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(sparePartsDir, { recursive: true });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, sparePartsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Authentication routes
router.post("/auth/send-otp", vendorAuthController.sendLoginOTP);
router.post("/auth/verify-otp", vendorAuthController.verifyOTP);
router.post("/auth/login", vendorAuthController.loginWithPassword);
router.put("/auth/update-fcm-token", vendorAuth, vendorAuthController.updateFCMToken);
router.get("/auth/profile", vendorAuth, vendorAuthController.getProfile);

// Spare Parts routes
router.get("/spare-parts", vendorAuth, vendorSparePartController.getSpareParts);
router.get("/spare-parts/categories", vendorAuth, vendorSparePartController.getCategories);
router.get("/spare-parts/:id", vendorAuth, vendorSparePartController.getSparePart);
router.post("/spare-parts", vendorAuth, upload.single("image"), vendorSparePartController.addSparePart);
router.put("/spare-parts/:id", vendorAuth, upload.single("image"), vendorSparePartController.updateSparePart);
router.delete("/spare-parts/:id", vendorAuth, vendorSparePartController.deleteSparePart);

// Booking routes
router.get("/bookings", vendorAuth, vendorBookingController.getBookings);
router.get("/bookings/stats", vendorAuth, vendorBookingController.getBookingStats);
router.get("/bookings/:id", vendorAuth, vendorBookingController.getBooking);
router.put("/bookings/:id/status", vendorAuth, vendorBookingController.updateBookingStatus);

// Transaction routes
router.get("/transactions", vendorAuth, vendorTransactionController.getTransactions);
router.get("/transactions/stats", vendorAuth, vendorTransactionController.getTransactionStats);
router.get("/transactions/:id", vendorAuth, vendorTransactionController.getTransaction);
router.post("/transactions", vendorAuth, vendorTransactionController.createTransaction);

// Notification routes
router.get("/notifications", vendorAuth, vendorNotificationController.getVendorNotifications);
router.put("/notifications/:notificationId/mark-read", vendorAuth, vendorNotificationController.markVendorNotificationAsRead);
router.put("/notifications/mark-read", vendorAuth, vendorNotificationController.markVendorNotificationAsRead);

module.exports = router;

