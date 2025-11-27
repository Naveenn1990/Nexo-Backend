const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { auth } = require("../middleware/userAuth");
const {
  register,
  loginWithPassword,
  sendLoginOTP,
  verifyLoginOTP,
  getProfile,
  updateProfile,
  addAddress,
  updateAddress,
  deleteAddress,
  sendForgotPasswordOTP,
  resetPassword,
  getUserDetails,
  addliveselectedAdd
} = require("../controllers/userController");
const authController = require("../controllers/authController");
const userServiceController = require("../controllers/userServiceController");
const bannerController = require("../controllers/bannerController");
const userController = require("../controllers/userController");
const bookingController = require("../controllers/bookingController");

/**
 * @swagger
 * tags:
 *   name: User Authentication
 *   description: User authentication and registration endpoints
 */

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/profiles/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({

  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Please upload an image file"));
    }
  },
});

// Auth routes
/**
 * @swagger
 * /api/user/auth/send-otp:
 *   post:
 *     summary: Send OTP for user authentication
 *     tags: [User Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid phone number
 *       500:
 *         description: Server error
 */
router.post("/auth/send-otp", authController.sendOTP);

/**
 * @swagger
 * /api/user/auth/verify-otp:
 *   post:
 *     summary: Verify OTP for user authentication
 *     tags: [User Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *               otp:
 *                 type: string
 *                 description: OTP received on phone
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 *       500:
 *         description: Server error
 */
router.post("/auth/verify-otp", authController.verifyOTP);

/**
 * @swagger
 * /api/user/auth/resend-otp:
 *   post:
 *     summary: Resend OTP for user authentication
 *     tags: [User Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: Invalid phone number
 *       500:
 *         description: Server error
 */
router.post("/auth/resend-otp", authController.resendOTP);

/**
 * @swagger
 * /api/user/register:
 *   post:
 *     summary: Register a new user
 *     tags: [User Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.post("/register", register);

/**
 * @swagger
 * /api/user/login/password:
 *   post:
 *     summary: Login with password
 *     tags: [User Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post("/login/password", loginWithPassword);

/**
 * @swagger
 * /api/user/login/otp/send:
 *   post:
 *     summary: Send OTP for login
 *     tags: [User Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid phone number
 *       500:
 *         description: Server error
 */
router.post("/login/otp/send", sendLoginOTP);

/**
 * @swagger
 * /api/user/login/otp/verify:
 *   post:
 *     summary: Verify OTP and login
 *     tags: [User Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *               otp:
 *                 type: string
 *                 description: OTP received on phone
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token
 *       400:
 *         description: Invalid OTP
 *       500:
 *         description: Server error
 */
router.post("/login/otp/verify", verifyLoginOTP);

/**
 * @swagger
 * /api/user/auth/request-password-reset-otp:
 *   post:
 *     summary: Request password reset OTP
 *     tags: [User Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *     responses:
 *       200:
 *         description: Password reset OTP sent successfully
 *       400:
 *         description: Invalid phone number
 *       500:
 *         description: Server error
 */
router.post(
  "/auth/request-password-reset-otp",
  authController.requestPasswordResetOTP
);

/**
 * @swagger
 * /api/user/auth/verify-password-reset-otp:
 *   post:
 *     summary: Verify password reset OTP
 *     tags: [User Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *               - newPassword
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *               otp:
 *                 type: string
 *                 description: OTP received on phone
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: New password
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid OTP or password
 *       500:
 *         description: Server error
 */
router.post(
  "/auth/verify-password-reset-otp",
  authController.verifyPasswordResetOTP
);

// Forgot password routes
router.post("/forgot-password/send-otp", sendForgotPasswordOTP);
router.post("/forgot-password/reset", resetPassword);

// Profile routes (protected)
/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [User Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   description: User's full name
 *                 email:
 *                   type: string
 *                   format: email
 *                   description: User's email address
 *                 phone:
 *                   type: string
 *                   description: User's phone number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/profile", auth, getProfile);

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [User Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/profile", auth, upload.single("profilePicture"), updateProfile);

// Get user details route
router.get("/details/:userId", auth, getUserDetails);

router.put("/addliveselectedAdd",auth,addliveselectedAdd);

// Address routes (protected)
/**
 * @swagger
 * /api/user/address:
 *   post:
 *     summary: Add a new address
 *     tags: [User Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *               - city
 *               - state
 *               - zip
 *             properties:
 *               address:
 *                 type: string
 *                 description: Address line 1
 *               city:
 *                 type: string
 *                 description: City
 *               state:
 *                 type: string
 *                 description: State
 *               zip:
 *                 type: string
 *                 description: Zip code
 *     responses:
 *       201:
 *         description: Address added successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/address", auth, addAddress);

/**
 * @swagger
 * /api/user/address:
 *   put:
 *     summary: Update an existing address
 *     tags: [User Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *               - city
 *               - state
 *               - zip
 *             properties:
 *               address:
 *                 type: string
 *                 description: Address line 1
 *               city:
 *                 type: string
 *                 description: City
 *               state:
 *                 type: string
 *                 description: State
 *               zip:
 *                 type: string
 *                 description: Zip code
 *     responses:
 *       200:
 *         description: Address updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/address/:addressId", auth, updateAddress);

/**
 * @swagger
 * /api/user/address:
 *   delete:
 *     summary: Delete an address
 *     tags: [User Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Address deleted successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete("/address/:addressId", auth, deleteAddress);

// Public routes for services
/**
 * @swagger
 * /api/services/categories:
 *   get:
 *     summary: Get all service categories
 *     tags: [Services]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Category ID
 *                   name:
 *                     type: string
 *                     description: Category name
 *       500:
 *         description: Server error
 */
router.get("/services/categories", userServiceController.getCategories);

// Service Category routes
/**
 * @swagger
 * /api/services/categories/{categoryId}/services:
 *   get:
 *     summary: Get services for a category
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *           description: Category ID
 *     responses:
 *       200:
 *         description: Services retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Service ID
 *                   name:
 *                     type: string
 *                     description: Service name
 *       400:
 *         description: Invalid category ID
 *       500:
 *         description: Server error
 */
router.get(
  "/services/categories/:categoryId/services",
  userServiceController.getCategoryServices
);

/**
 * @swagger
 * /api/services/{serviceId}:
 *   get:
 *     summary: Get a service by ID
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: integer
 *           description: Service ID
 *     responses:
 *       200:
 *         description: Service retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Service ID
 *                 name:
 *                   type: string
 *                   description: Service name
 *       400:
 *         description: Invalid service ID
 *       500:
 *         description: Server error
 */
router.get("/services/:serviceId", userServiceController.getServiceDetails);

/**
 * @swagger
 * /api/services/search:
 *   get:
 *     summary: Search for services
 *     tags: [Services]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           description: Search query
 *     responses:
 *       200:
 *         description: Services retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Service ID
 *                   name:
 *                     type: string
 *                     description: Service name
 *       400:
 *         description: Invalid search query
 *       500:
 *         description: Server error
 */
router.get("/services/search", userServiceController.searchServices);

/**
 * @swagger
 * /api/services/popular:
 *   get:
 *     summary: Get popular services
 *     tags: [Services]
 *     responses:
 *       200:
 *         description: Services retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Service ID
 *                   name:
 *                     type: string
 *                     description: Service name
 *       500:
 *         description: Server error
 */
router.get("/services/popular", userServiceController.getPopularServices);

// Banner routes
/**
 * @swagger
 * /api/banners:
 *   get:
 *     summary: Get active banners
 *     tags: [Banners]
 *     responses:
 *       200:
 *         description: Banners retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Banner ID
 *                   image:
 *                     type: string
 *                     format: binary
 *                     description: Banner image
 *       500:
 *         description: Server error
 */
router.get("/banners", bannerController.getActiveBanners);

// Booking routes
router.get(
  "/api/user/bookings/all",
  auth,
  bookingController.getAllUserBookings
);

/**
 * @swagger
 * /api/user/bookings:
 *   get:
 *     summary: Get all bookings for a user
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Booking ID
 *                   serviceId:
 *                     type: integer
 *                     description: Service ID
 *                   userId:
 *                     type: integer
 *                     description: User ID
 *                   bookingDate:
 *                     type: string
 *                     format: date
 *                     description: Booking date
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/api/user/bookings", auth, bookingController.getAllUserBookings);
router.put("/updateFcmToken", userController.updateFcmToken);
router.delete('/deleteduser',auth,userController.deleteUser)

// Quotation Routes (Customer)
const quotationController = require("../controllers/quotationController");
router.get("/bookings/:bookingId/quotations", auth, quotationController.getQuotationsByBooking);
router.get("/quotations/:quotationId", auth, quotationController.getQuotationById);
router.post("/quotations/:quotationId/accept", auth, quotationController.customerAcceptQuotation);
router.post("/quotations/:quotationId/reject", auth, quotationController.customerRejectQuotation);

module.exports = router;
