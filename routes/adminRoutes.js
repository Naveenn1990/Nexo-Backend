const express = require("express");
const  router = express.Router();
const { adminAuth } = require("../middleware/adminAuth");
const adminController = require("../controllers/adminController");
const adminServiceController = require("../controllers/adminServiceController");
const adminSettingsController = require("../controllers/adminSettingsController");
const adminReportController = require("../controllers/adminReportController");
const bannerController = require("../controllers/bannerController");
const userServiceController = require("../controllers/userServiceController");
const bookingController = require("../controllers/bookingController");
const { upload, processFilePath } = require("../middleware/upload");
const SubCategory = require("../models/SubCategory");
const Product = require("../models/product");
const ReviewController = require("../controllers/reviewController");
const { addtransactionwalletadmin, getWalletByAdminId, completePaymentVendor, updatedDocuments } = require("../controllers/partnerAuthController");
const { auth } = require("../middleware/partnerAuth");
const mgPlanController = require('../controllers/mgPlanController');
const feeManagementController = require('../controllers/feeManagementController');

// Auth routes
router.post("/login", adminController.loginAdmin);
router.post("/create", adminAuth, adminController.createAdmin);
router.post("/createmainadmin", adminController.createMainAdmin);
router.get("/profile", adminAuth, adminController.getProfile);
router.get("/profiles", adminAuth, adminController.getProfiles);
router.put("/profile/:subadminId", adminAuth, adminController.updateProfile);
router.delete("/profile/:subadminId", adminAuth, adminController.deleteProfile);

// Dashboard and analytics
router.get("/dashboard", adminAuth, adminController.getDashboardAnalytics);
router.get("/dashboard/counts", adminAuth, adminController.getDashboardCounts);

// User Management
router.get("/users", adminAuth, adminController.getAllUsers);

// Partner management
router.get("/partners", adminAuth, adminController.getAllPartners);
router.get(
  "/partners/:partnerId",
  adminAuth,
  adminController.getPartnerDetails
);

//get partner details
router.put("/partners/:id", adminController.getPartnerProfile); 

router.put("/partners/:partnerId/status", adminController.updatePartnerStatus);
router.get("/partners/kyc/pending", adminAuth, adminController.getPendingKYC);
router.get(
  "/partners/:partnerId/kyc",
  adminAuth,
  adminController.getPartnerKYC
);
router.put(
  "/partners/:partnerId/kyc",
  adminAuth,
  adminController.verifyPartnerKYC
);

// Service Category Management
router.post(
  "/service-category",
  adminAuth,
  upload.single("icon"), // Optional - only if file is uploaded
  adminServiceController.createCategory
);
router.get(
  "/service-categories",
  adminAuth,
  adminServiceController.getAllCategories
);
router.get(
  "/categories",
  adminAuth,
  adminServiceController.getAllCategoriesWithDetails
);
router.get(
  "/categories-with-details",
  adminAuth,
  adminServiceController.getAllCategoriesWithDetails
);
router.get(
  "/categories-with-sub-categories",
  adminAuth,
  adminServiceController.getAllCategoriesWithDetails
);
router.put(
  "/service-category/:categoryId",
  adminAuth,
  upload.single("icon"),
  adminServiceController.updateServiceCategory
);
router.delete(
  "/service-category/:categoryId",
  adminAuth,
  adminServiceController.deleteServiceCategory
);

// Sub-Category Management
router.post(
  "/sub-category",
  adminAuth,
  upload.single("image"),

  adminController.addSubCategory
);
router.put(
  "/sub-category/:subcategoryId",
  adminAuth,
  upload.single("image"),

  adminController.updateSubCategory
);
router.delete(
  "/sub-category/:subcategoryId",
  adminAuth,
  adminController.deleteSubCategory
);

// Service Management
router.post("/service",adminAuth, upload.single("icon"), adminServiceController.createService);
router.get("/services", adminAuth, adminServiceController.getAllServices);
router.get(
  "/category/:categoryId/services",
  adminAuth,
  adminServiceController.getServicesByCategory
);
router.put(
  "/service/:serviceId",
  adminAuth,
  upload.single("icon"),

  adminServiceController.updateService
);
router.delete(
  "/service/:serviceId",
  adminAuth,
  adminServiceController.deleteService
);

// Sub-Service Management
// router.post("/sub-service", adminAuth, upload.any(),  adminServiceController.createSubService);
router.post(
  "/sub-service",
  adminAuth,
  upload.array("images", 4),
  adminServiceController.createSubService
);
router.post("/sub-service/mutiimages",adminAuth, upload.any(), adminServiceController.multiimages);
// Bulk Create Sub-Services
router.post(
  '/sub-service/bulk', 
  adminAuth,  
  adminServiceController.bulkCreateSubServices
);
router.put(
  '/sub-service/bulk', 
  adminAuth,  
  adminServiceController.bulkUpdateSubServices
);
router.post(
  "/service/:serviceId/sub-service",
  adminAuth,
  upload.array("images", 4),
  adminServiceController.addSubService
);
router.put(
  "/service/:serviceId/sub-service/:subServiceId",
  adminAuth,
  upload.array("images", 4),
  adminServiceController.updateSubService
);
router.delete(
  "/service/:serviceId/sub-service/:subServiceId",
  adminAuth,
  adminServiceController.deleteSubService
);
router.post(
  "/service/:serviceId/sub-service/create",
  adminAuth,
  upload.single("icon"),

  adminServiceController.createSubService
);

// Service Analytics
router.get(
  "/services/:categoryId/analytics",
  adminAuth,
  adminServiceController.getServiceAnalytics
);

// Booking Management
router.get(
  "/users/:userId/bookings",
  adminAuth,
  adminController.getUserBookings
);
router.put(
  "/bookings/:bookingId/complete",
  adminAuth,
  adminController.completeBooking
);


router.put("/bookings/assign-partner", adminAuth, adminController.assignedbooking);
router.post("/bookings/create", adminAuth, bookingController.createBooking);

// Promotional Video Management
router.post("/promovideo", adminAuth, upload.single("image"), bannerController.uploadPromovideo);
router.get("/promovideo", bannerController.getAllPromovideos);
router.put("/promovideo/:id", adminAuth, upload.single("image"), bannerController.updatePromoVideo);
router.delete("/promovideo/:id", adminAuth, bannerController.deletePromoVideo);

// Banner Management
router.post(
  "/banners",
  adminAuth,
  upload.single("image"),

  bannerController.uploadBanner
);
router.get("/banners", adminAuth, bannerController.getAllBanners);
router.put(
  "/banners/:bannerId",
  adminAuth,
  upload.single("image"),

  bannerController.updateBanner
);
router.delete("/banners/:bannerId", adminAuth, bannerController.deleteBanner);

// Review Management
router.get("/reviews", adminAuth, adminController.getAllReviews);
// Update review status
router.put(
  "/reviews/:reviewId/status",
  adminAuth,
  adminController.updateReviewStatus
);

// Settings management
router.get("/settings", adminAuth, adminSettingsController.getAllSettings);
router.put("/settings", adminAuth, adminSettingsController.updateSettings);
router.get(
  "/settings/commission",
  adminAuth,
  adminSettingsController.getCommissionGuidelines
);
router.put(
  "/settings/commission",
  adminAuth,
  adminSettingsController.updateCommissionGuidelines
);
router.get(
  "/settings/support",
  adminAuth,
  adminSettingsController.getSupportSettings
);
router.put(
  "/settings/support",
  adminAuth,
  adminSettingsController.updateSupportSettings
);

// Reports and analytics
router.get(
  "/reports/revenue",
  adminAuth,
  adminReportController.getRevenueAnalytics
);
router.get(
  "/reports/partners/performance",
  adminAuth,
  adminReportController.getPartnerPerformance
);
router.get("/reports/users", adminAuth, adminReportController.getUserAnalytics);
router.get(
  "/reports/transactions",
  adminAuth,
  adminReportController.getTransactionReport
);

// Get all categories with sub-categories, services, and sub-services
router.get(
  "/categories",
  adminAuth,
  adminServiceController.getAllCategoriesWithDetails
);

// Admin Routes
router.post(
  "/products",
  upload.single("image"),
  adminAuth,
  adminServiceController.addProduct
); // Add product
router.get("/products", adminAuth, adminServiceController.getAllProducts); // Get all products
router.put(
  "/products/:id",
  upload.single("image"),
  adminAuth,
  adminServiceController.updateProduct
); // Update product
router.delete("/products/:id", adminAuth, adminServiceController.deleteProduct); // Delete product

//change the status of partner
router.put(
  "/partner/:partnerId/status",
  adminAuth,
  adminServiceController.updatePartnerStatus
);

// Fee Management
router.get("/fees", adminAuth, feeManagementController.getFees);
router.put("/fees", adminAuth, feeManagementController.updateFees);

//get partner earnings
router.get(
  "/partner/:partnerId/earnings",
  adminServiceController.getPartnerEarnings
);

router.get("/contactus", adminAuth, ReviewController.getAllContactUs);

// Add a new wallet partner
router.put('/partner/addwallets',adminAuth,addtransactionwalletadmin );
router.get('/adminwallets/:id', adminAuth, getWalletByAdminId);
router.put('/registrationfeeupdate',adminAuth,completePaymentVendor)
router.put("/updatedDocuments",upload.any(),adminAuth,updatedDocuments);
router.delete('/deletepartner/:partnerId', adminAuth, adminServiceController.deletePartner);
// Middleware to handle both JSON and multipart/form-data
const handleUpdateProfile = (req, res, next) => {
  const contentType = req.headers['content-type'] || ''
  if (contentType.includes('multipart/form-data')) {
    return upload.single('profileImage')(req, res, (err) => {
      if (err) {
        console.error('Multer error in handleUpdateProfile:', err)
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error'
        })
      }
      next()
    })
  }
  // For JSON, just pass through - Express.json() will handle it
  next()
}

router.put('/updatePartnerProfile/:id', adminAuth, handleUpdateProfile, adminServiceController.updatePartnerProfile);
router.delete('/deletepartner1/:partnerId', auth, adminServiceController.deletePartner);

// MG Plan Management (Admin)
router.get('/mg-plans', adminAuth, mgPlanController.getAllPlans);
router.get('/mg-plans/:planId', adminAuth, mgPlanController.getPlanById);
router.post('/mg-plans', adminAuth, mgPlanController.createPlan);
router.put('/mg-plans/:planId', adminAuth, mgPlanController.updatePlan);
router.delete('/mg-plans/:planId', adminAuth, mgPlanController.deletePlan);

router.get(
  '/partners/:partnerId/service-hubs',
  adminAuth,
  adminServiceController.getPartnerServiceHubs
);
router.post(
  '/partners/:partnerId/service-hubs',
  adminAuth,
  adminServiceController.createPartnerServiceHub
);
router.put(
  '/partners/:partnerId/service-hubs/:hubId',
  adminAuth,
  adminServiceController.updatePartnerServiceHub
);
router.delete(
  '/partners/:partnerId/service-hubs/:hubId',
  adminAuth,
  adminServiceController.deletePartnerServiceHub
);

module.exports = router;
