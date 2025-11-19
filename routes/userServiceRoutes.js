const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/userAuth");
const userServiceController = require("../controllers/userServiceController");
const {
  createBooking,
  getUserBookings,
  getBookingDetails,
  updateBooking,
  cancelBooking,
  addReview,
  getAllBookings,
  getAllReviews,
} = require("../controllers/bookingController");
const {
  addToCart,
  getCart,
  removeFromCart,
  updateCartItem,
  clearCart,
  addSubServiceToCart,
} = require("../controllers/cartController");
const ReviewController = require("../controllers/reviewController");
const { getAllOffers } = require("../controllers/offerController");
const Partner = require("../models/PartnerModel");
const booking = require("../models/booking");

/**
 * @swagger
 * tags:
 *   name: User Services
 *   description: Service browsing and cart management endpoints for users
 */

/**
 * @swagger
 * /api/user/service-hierarchy:
 *   get:
 *     summary: Get complete service hierarchy
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: Service hierarchy retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/service-hierarchy", userServiceController.getServiceHierarchy);

/**
 * @swagger
 * /api/user/all-services:
 *   get:
 *     summary: Get all services (debug endpoint)
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: All services retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/all-services", userServiceController.getAllServices);

/**
 * @swagger
 * /api/user/categories:
 *   get:
 *     summary: Get all service categories
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/categories", userServiceController.getAllCategories);
router.get("/patners", userServiceController.getAllPartners);

/**
 * @swagger
 * /api/user/categories-for-user:
 *   get:
 *     summary: Get all service categories for user
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
  "/categories-for-user",
  userServiceController.getAllCategoriesForUser
);

/**
 * @swagger
 * /api/user/category/{categoryId}/services:
 *   get:
 *     summary: Get services by category
 *     tags: [User Services]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the category
 *     responses:
 *       200:
 *         description: Services retrieved successfully
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.get(
  "/category/:categoryId/services",
  userServiceController.getCategoryServices
);

/**
 * @swagger
 * /api/user/service/{serviceId}:
 *   get:
 *     summary: Get service details
 *     tags: [User Services]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the service
 *     responses:
 *       200:
 *         description: Service details retrieved successfully
 *       404:
 *         description: Service not found
 *       500:
 *         description: Server error
 */
router.get("/service/:serviceId", userServiceController.getServiceDetails);

/**
 * @swagger
 * /api/user/search:
 *   get:
 *     summary: Search services
 *     tags: [User Services]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/search", userServiceController.searchServices);

/**
 * @swagger
 * /api/user/popular:
 *   get:
 *     summary: Get popular services
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: Popular services retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/popular", userServiceController.getPopularServices);

/**
 * @swagger
 * /api/user/service-by-slug/{slug}:
 *   get:
 *     summary: Get service by slug
 *     tags: [User Services]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug of the service
 *     responses:
 *       200:
 *         description: Service retrieved successfully
 *       404:
 *         description: Service not found
 *       500:
 *         description: Server error
 */
router.get("/service-by-slug/:slug", userServiceController.getServiceBySlug);

/**
 * @swagger
 * /api/user/subcategories:
 *   get:
 *     summary: Get all subcategories
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: Subcategories retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/subcategories", userServiceController.getAllSubCategories);

/**
 * @swagger
 * /api/user/subservices:
 *   get:
 *     summary: Get all subservices
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: Subservices retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/subservices", userServiceController.getAllSubServices);

/**
 * @swagger
 * /api/user/subservices:
 *   get:
 *     summary: Get all subservices for user
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: Subservices retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/subservices", userServiceController.getAllSubServicesForUser);

/**
 * @swagger
 * /api/user/services:
 *   get:
 *     summary: Get all services for user
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: Services retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/services", userServiceController.getAllServicesForUser);

/**
 * @swagger
 * /api/user/services:
 *   get:
 *     summary: Get all services
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: Services retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/services", userServiceController.getAllServices);

/**
 * @swagger
 * /api/user/subcategory-hierarchy:
 *   get:
 *     summary: Get subcategory hierarchy
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: Subcategory hierarchy retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
  "/subcategory-hierarchy",
  userServiceController.getSubCategoryHierarchy
);

/**
 * @swagger
 * /api/user/subcategory-hierarchy:
 *   get:
 *     summary: Get subcategory hierarchy
 *     tags: [User Services]
 *     responses:
 *       200:
 *         description: Subcategory hierarchy retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
  "/subcategory-hierarchy",
  userServiceController.getSubCategoryHierarchy
);

// Cart routes
/**
 * @swagger
 * /api/user/cart:
 *   post:
 *     summary: Add item to cart
 *     tags: [User Services]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceId
 *               - quantity
 *             properties:
 *               serviceId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       201:
 *         description: Item added to cart successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/cart/subservice", auth, addSubServiceToCart);

/**
 * @swagger
 * /api/user/cart:
 *   get:
 *     summary: Get user's cart
 *     tags: [User Services]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/cart", auth, getCart);

/**
 * @swagger
 * /api/user/cart/{itemId}:
 *   put:
 *     summary: Update cart item quantity
 *     tags: [User Services]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the cart item
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Cart item not found
 *       500:
 *         description: Server error
 */
router.put("/cart/:itemId", auth, updateCartItem);

/**
 * @swagger
 * /api/user/cart/{itemId}:
 *   delete:
 *     summary: Remove item from cart
 *     tags: [User Services]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the cart item
 *     responses:
 *       200:
 *         description: Item removed from cart successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Cart item not found
 *       500:
 *         description: Server error
 */
router.delete("/cart/:itemId", auth, removeFromCart);

/**
 * @swagger
 * /api/user/cart:
 *   delete:
 *     summary: Clear cart
 *     tags: [User Services]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete("/cart", auth, clearCart);

// Add subservice to cart
router.post("/cart/subservice", auth, addSubServiceToCart);

// User Booking routes
router.post("/bookings", auth, createBooking);
router.get("/bookings", auth, getUserBookings);
router.get("/bookings/:bookingId", auth, getBookingDetails);
router.put("/bookings/:bookingId", auth, updateBooking);
router.put("/bookings/:bookingId/cancel", cancelBooking);
router.post("/bookings/:bookingId/review", auth, addReview);

router.get("/categories", userServiceController.getAllCategories);

// Fetch all reviews made by all users
router.get("/reviews", getAllReviews);

// Route to submit a review
router.post("/reviews", ReviewController.submitReview);

// Route to fetch reviews for a specific subservice
router.get("/subservices/:subServiceId/reviews", ReviewController.getReviews);

router.get("/wallet/topup/:userId", ReviewController.topUpWallet);
router.post("/wallet/transactions", ReviewController.transactionsWallet);
router.get("/offers", getAllOffers);

router.get("/wallet/topup/:userId", ReviewController.topUpWallet);
router.post("/wallet/transactions", ReviewController.transactionsWallet);
router.get("/offers", getAllOffers);

// View cart of partner
router.get(
  "/partner-cart/:bookingId",
  auth,
  userServiceController.viewPartnerCart
);

//Approve cart of partner
router.put(
  "/approve/:bookingId",
  auth,
  userServiceController.approvePartnerCart
);

//review partner
router.post("/review/partner", auth, ReviewController.reviewPartner);

router.post("/contactus", auth, ReviewController.ContactUs);

//get all completed booking in system
router.get(
  "/completed-bookings",
  userServiceController.getAllCompletedBookingsinsystem
);
module.exports = router;
