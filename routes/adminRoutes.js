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
const { addtransactionwalletadmin, getWalletByAdminId, completePaymentVendor, updatedDocuments, getAllwalletTransaction } = require("../controllers/partnerAuthController");
const { auth } = require("../middleware/partnerAuth");
const mgPlanController = require('../controllers/mgPlanController');
const feeManagementController = require('../controllers/feeManagementController');
const adminPopularServiceController = require('../controllers/adminPopularServiceController');
const leadController = require('../controllers/leadController');
const subscriptionPlanController = require('../controllers/subscriptionPlanController');
const featuredReviewController = require('../controllers/featuredReviewController');
const materialCategoryController = require('../controllers/materialCategoryController');
const inventoryController = require('../controllers/inventoryController');
const amcPlanController = require('../controllers/amcPlanController');
const adminVendorController = require('../controllers/adminVendorController');

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
router.get("/customers", adminAuth, adminController.getAllCustomers);

// Partner management
router.get("/partners", adminAuth, adminController.getAllPartners);
router.get("/partners-revenue-stats", adminAuth, adminController.getPartnerRevenueStats);

// Test endpoint to verify route is working
router.post("/partners/manual-register/test", adminAuth, (req, res) => {
  res.json({ success: true, message: "Route is working", body: Object.keys(req.body) });
});

router.post("/partners/manual-register", adminAuth, upload.any(), (req, res, next) => {
  // Wrap controller in try-catch to ensure JSON response
  try {
    adminController.manualPartnerRegistration(req, res, next);
  } catch (error) {
    console.error('Route-level error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in route handler',
      error: error.message
    });
  }
});
router.get(
  "/partners/:partnerId",
  adminAuth,
  adminController.getPartnerDetails
);

//get partner details
router.put("/partners/:id", adminController.getPartnerProfile); 

router.put("/partners/:partnerId/status", adminController.updatePartnerStatus);
router.put("/partners/:partnerId/approve-payment", adminController.approvePartnerPayment);
router.put("/partners/:partnerId/mg-plan/payment-details", adminAuth, adminController.updateMGPlanPaymentDetails);
router.get("/partners/kyc/pending", adminAuth, adminController.getPendingKYC);
router.get(
  "/partners/:partnerId/kyc",
  adminAuth,
  adminController.getPartnerKYC
);

// Vendor management
router.get("/vendors", adminAuth, adminVendorController.getAllVendors);
router.post("/vendors", adminAuth, adminVendorController.createVendor);

// Vendor Spare Parts (Admin can view all vendor spare parts) - MUST come before /vendors/:vendorId
router.get("/vendors/spare-parts", adminAuth, adminVendorController.getAllVendorSpareParts);
router.get("/vendors/:vendorId/spare-parts", adminAuth, adminVendorController.getVendorSpareParts);

// Vendor details and management - MUST come after specific routes
router.get("/vendors/:vendorId", adminAuth, adminVendorController.getVendorDetails);
router.put("/vendors/:vendorId", adminAuth, adminVendorController.updateVendor);
router.put("/vendors/:vendorId/status", adminAuth, adminVendorController.updateVendorStatus);
router.delete("/vendors/:vendorId", adminAuth, adminVendorController.deleteVendor);
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
router.get("/team-members", adminAuth, adminController.getAllTeamMembers);
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
  "/reports/category-revenue",
  adminAuth,
  adminReportController.getCategoryRevenue
);
router.get(
  "/reports/transactions",
  adminAuth,
  adminReportController.getTransactionReport
);

// Lead Management routes
router.get("/leads", adminAuth, leadController.getAllLeads);
router.get("/leads/analytics", adminAuth, leadController.getLeadAnalytics);
router.get("/leads/bids", adminAuth, leadController.getAllBids);
router.post("/leads/create", adminAuth, leadController.createLeadFromBooking);
router.post("/leads/create-manual", adminAuth, leadController.createManualLead);
router.post("/leads/sync", adminAuth, leadController.syncBookingsToLeads);
router.put("/leads/:leadId/status", adminAuth, leadController.updateLeadStatus);
router.post("/leads/accept-bid", adminAuth, leadController.acceptBid);

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
router.get('/wallet-transactions', adminAuth, getAllwalletTransaction);
router.put('/registrationfeeupdate',adminAuth,completePaymentVendor)
router.get('/fee-transactions', adminAuth, adminController.getAllFeeTransactions);
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
router.post('/mg-plans/:planId/subscribe', adminAuth, mgPlanController.adminSubscribeToPlan);

// MG Plan History Management (Admin)
router.get('/partners/:partnerId/mg-plan/history', adminAuth, mgPlanController.getPartnerPlanHistory);
router.delete('/partners/:partnerId/mg-plan/history/:historyIndex', adminAuth, mgPlanController.deletePlanHistoryEntry);

// Remove MG Plan (Admin)
router.post('/partners/:partnerId/remove-mg-plan', adminAuth, mgPlanController.removeMGPlan);

// Ensure Free Plan exists (Admin utility)
router.post('/mg-plans/ensure-free-plan', adminAuth, mgPlanController.ensureFreePlanExists);

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

// Popular Services Management
router.get('/popular-services', adminAuth, adminPopularServiceController.getAllPopularServices);
router.get('/popular-services/:id', adminAuth, adminPopularServiceController.getPopularService);
router.post('/popular-services', adminAuth, adminPopularServiceController.createPopularService);
router.put('/popular-services/:id', adminAuth, adminPopularServiceController.updatePopularService);
router.delete('/popular-services/:id', adminAuth, adminPopularServiceController.deletePopularService);
router.put('/popular-services/order/update', adminAuth, adminPopularServiceController.updateOrder);
router.post('/popular-services/migrate', adminAuth, adminPopularServiceController.migrateExistingServices);

// Subscription Plans Management (Admin)
router.get('/subscription-plans', adminAuth, subscriptionPlanController.getAllPlansAdmin);
router.get('/subscription-plans/:planId', adminAuth, subscriptionPlanController.getPlanById);
router.post('/subscription-plans', adminAuth, subscriptionPlanController.createPlan);
router.put('/subscription-plans/:planId', adminAuth, subscriptionPlanController.updatePlan);
router.delete('/subscription-plans/:planId', adminAuth, subscriptionPlanController.deletePlan);

// AMC Plans Management (Admin)
router.get('/amc-plans', adminAuth, amcPlanController.getAllPlansAdmin);
router.get('/amc-plans/:planId', adminAuth, amcPlanController.getPlanById);
router.post('/amc-plans', adminAuth, amcPlanController.createPlan);
router.put('/amc-plans/:planId', adminAuth, amcPlanController.updatePlan);
router.delete('/amc-plans/:planId', adminAuth, amcPlanController.deletePlan);
router.post('/amc-plans/generate-from-services', adminAuth, amcPlanController.generatePlansFromServices);
router.post('/amc-plans/create-samples', adminAuth, amcPlanController.createSamplePlans);
router.get('/amc-subscribers', adminAuth, amcPlanController.getAMCSubscribers);
router.post('/amc-subscribers/assign-partner', adminAuth, amcPlanController.assignAMCSubscriptionToPartner);

// Fix user data issues
router.post('/fix-user-data', adminAuth, async (req, res) => {
  try {
    const { runAllFixes } = require('../utils/fixUserCompanyDetails');
    const result = await runAllFixes();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error running user data fixes',
      error: error.message
    });
  }
});

// Featured Reviews Management (Admin)
router.get('/featured-reviews', adminAuth, featuredReviewController.getAllReviewsAdmin);
router.get('/featured-reviews/:reviewId', adminAuth, featuredReviewController.getReviewById);
router.post('/featured-reviews', adminAuth, featuredReviewController.createReview);
router.put('/featured-reviews/:reviewId', adminAuth, featuredReviewController.updateReview);
router.delete('/featured-reviews/:reviewId', adminAuth, featuredReviewController.deleteReview);

// Material Categories Management (Admin)
router.get('/material-categories', adminAuth, materialCategoryController.getAllMaterialCategories);
router.get('/material-categories/:id', adminAuth, materialCategoryController.getMaterialCategory);
router.post('/material-categories', adminAuth, materialCategoryController.createMaterialCategory);
router.put('/material-categories/:id', adminAuth, materialCategoryController.updateMaterialCategory);
router.delete('/material-categories/:id', adminAuth, materialCategoryController.deleteMaterialCategory);
router.put('/material-categories/order/update', adminAuth, materialCategoryController.updateMaterialCategoryOrder);

// Inventory Management (Admin)
// Inventory Items
router.get('/inventory/items', adminAuth, inventoryController.getAllInventoryItems);
router.get('/inventory/items/stats', adminAuth, inventoryController.getInventoryStats);
router.get('/inventory/items/:id', adminAuth, inventoryController.getInventoryItem);
router.get('/inventory/items/:id/history', adminAuth, inventoryController.getInventoryItemHistory);
router.post('/inventory/items', adminAuth, inventoryController.createInventoryItem);
router.put('/inventory/items/:id', adminAuth, inventoryController.updateInventoryItem);
router.delete('/inventory/items/:id', adminAuth, inventoryController.deleteInventoryItem);

// Purchase Orders
router.get('/inventory/purchase-orders', adminAuth, inventoryController.getAllPurchaseOrders);
router.get('/inventory/purchase-orders/:id', adminAuth, inventoryController.getPurchaseOrder);
router.post('/inventory/purchase-orders', adminAuth, inventoryController.createPurchaseOrder);
router.put('/inventory/purchase-orders/:id', adminAuth, inventoryController.updatePurchaseOrder);
router.delete('/inventory/purchase-orders/:id', adminAuth, inventoryController.deletePurchaseOrder);

// Inventory Thresholds
router.get('/inventory/thresholds', adminAuth, inventoryController.getAllThresholds);
router.get('/inventory/thresholds/:category', adminAuth, inventoryController.getThreshold);
router.post('/inventory/thresholds', adminAuth, inventoryController.upsertThreshold);
router.put('/inventory/thresholds/:category', adminAuth, inventoryController.upsertThreshold);
router.delete('/inventory/thresholds/:category', adminAuth, inventoryController.deleteThreshold);

// Quotation Routes (Admin)
const quotationController = require("../controllers/quotationController");
router.get("/quotations", adminAuth, quotationController.getAllQuotations);
router.get("/quotations/:quotationId", adminAuth, quotationController.getQuotationById);
router.put("/quotations/:quotationId/approve", adminAuth, quotationController.adminAcceptQuotation);
router.put("/quotations/:quotationId/reject", adminAuth, quotationController.adminRejectQuotation);

// User Subscription Management (Admin)
const userSubscriptionController = require("../controllers/userSubscriptionController");
router.get("/user-subscriptions", adminAuth, userSubscriptionController.getAllSubscriptions);
router.get("/user-subscriptions/stats", adminAuth, userSubscriptionController.getSubscriptionStats);

module.exports = router;
