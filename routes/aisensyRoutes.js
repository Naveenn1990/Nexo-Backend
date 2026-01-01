const express = require('express');
const router = express.Router();
const aisensyController = require('../controllers/aisensyController');
const { validateAisensyToken } = require('../middleware/aisensyAuth');

// Apply token validation middleware to all AiSensy routes
router.use(validateAisensyToken);

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     AisensyToken:
 *       type: apiKey
 *       in: header
 *       name: Authorization
 *       description: Static token for AiSensy API authentication. Use "Bearer aisensy_nexo_2025_secure_token_v1"
 *     AisensyTokenHeader:
 *       type: apiKey
 *       in: header
 *       name: x-api-token
 *       description: Static token for AiSensy API authentication
 *     AisensyTokenQuery:
 *       type: apiKey
 *       in: query
 *       name: token
 *       description: Static token for AiSensy API authentication
 * 
 * security:
 *   - AisensyToken: []
 *   - AisensyTokenHeader: []
 *   - AisensyTokenQuery: []
 */

/**
 * @swagger
 * tags:
 *   name: AiSensy Integration
 *   description: Secure APIs for AiSensy integration with static token authentication
 */

/**
 * @swagger
 * /api/aisensy/customer/create-booking:
 *   post:
 *     summary: Create a booking for customer via AiSensy (Token Required)
 *     tags: [AiSensy Integration]
 *     security:
 *       - AisensyToken: []
 *       - AisensyTokenHeader: []
 *       - AisensyTokenQuery: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerPhone
 *               - customerName
 *               - serviceName
 *               - scheduledDate
 *               - scheduledTime
 *               - locationAddress
 *               - amount
 *             properties:
 *               customerPhone:
 *                 type: string
 *                 description: Customer phone number (will be used to find/create user)
 *                 example: "+919876543210"
 *               customerName:
 *                 type: string
 *                 description: Customer name
 *                 example: "John Doe"
 *               customerEmail:
 *                 type: string
 *                 description: Customer email (optional)
 *                 example: "john@example.com"
 *               serviceName:
 *                 type: string
 *                 description: Name of the service to book
 *                 example: "AC Repair"
 *               serviceId:
 *                 type: string
 *                 description: Service ID (optional, if known)
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               addOnNames:
 *                 type: string
 *                 description: Comma-separated add-on names (optional)
 *                 example: "Deep Cleaning,Gas Refill"
 *               scheduledDate:
 *                 type: string
 *                 format: date
 *                 description: Booking date (YYYY-MM-DD)
 *                 example: "2024-01-15"
 *               scheduledTime:
 *                 type: string
 *                 description: Booking time (HH:mm)
 *                 example: "14:30"
 *               locationAddress:
 *                 type: string
 *                 description: Full address (flattened from location.address)
 *                 example: "123 Main Street, City"
 *               locationLandmark:
 *                 type: string
 *                 description: Nearby landmark (optional, flattened from location.landmark)
 *                 example: "Near City Mall"
 *               locationPincode:
 *                 type: string
 *                 description: Area pincode (optional, flattened from location.pincode)
 *                 example: "560001"
 *               amount:
 *                 type: string
 *                 description: Service amount as string (will be converted to number)
 *                 example: "500"
 *               paymentMode:
 *                 type: string
 *                 enum: ["cash", "online", "upi"]
 *                 default: "cash"
 *                 description: Payment mode
 *               specialInstructions:
 *                 type: string
 *                 description: Any special instructions
 *                 example: "Please call before arriving"
 *               lat:
 *                 type: string
 *                 description: Latitude (optional)
 *                 example: "12.9716"
 *               lng:
 *                 type: string
 *                 description: Longitude (optional)
 *                 example: "77.5946"
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Booking created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                     customerId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b4"
 *                     selectedAddOns:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           basePrice:
 *                             type: number
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     scheduledDate:
 *                       type: string
 *                       example: "2024-01-15"
 *                     scheduledTime:
 *                       type: string
 *                       example: "14:30"
 *                     amount:
 *                       type: number
 *                       example: 500
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.post('/customer/create-booking', aisensyController.createCustomerBooking);

/**
 * @swagger
 * /api/aisensy/partner/create-booking:
 *   post:
 *     summary: Create a booking for partner via AiSensy (No Auth Required)
 *     tags: [AiSensy Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - partnerPhone
 *               - customerPhone
 *               - customerName
 *               - serviceName
 *               - scheduledDate
 *               - scheduledTime
 *               - locationAddress
 *               - amount
 *             properties:
 *               partnerPhone:
 *                 type: string
 *                 description: Partner phone number (must be registered partner)
 *                 example: "+919876543210"
 *               customerPhone:
 *                 type: string
 *                 description: Customer phone number
 *                 example: "+919876543211"
 *               customerName:
 *                 type: string
 *                 description: Customer name
 *                 example: "Jane Doe"
 *               customerEmail:
 *                 type: string
 *                 description: Customer email (optional)
 *                 example: "jane@example.com"
 *               serviceName:
 *                 type: string
 *                 description: Name of the service to book
 *                 example: "Plumbing Service"
 *               serviceId:
 *                 type: string
 *                 description: Service ID (optional, if known)
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               addOnNames:
 *                 type: string
 *                 description: Comma-separated add-on names (optional)
 *                 example: "Pipe Replacement,Emergency Service"
 *               scheduledDate:
 *                 type: string
 *                 format: date
 *                 description: Booking date (YYYY-MM-DD)
 *                 example: "2024-01-15"
 *               scheduledTime:
 *                 type: string
 *                 description: Booking time (HH:mm)
 *                 example: "10:00"
 *               locationAddress:
 *                 type: string
 *                 description: Full address (flattened from location.address)
 *                 example: "456 Oak Street, City"
 *               locationLandmark:
 *                 type: string
 *                 description: Nearby landmark (optional, flattened from location.landmark)
 *                 example: "Near Park"
 *               locationPincode:
 *                 type: string
 *                 description: Area pincode (optional, flattened from location.pincode)
 *                 example: "560002"
 *               amount:
 *                 type: string
 *                 description: Service amount as string (will be converted to number)
 *                 example: "750"
 *               paymentMode:
 *                 type: string
 *                 enum: ["cash", "online", "upi"]
 *                 default: "cash"
 *                 description: Payment mode
 *               specialInstructions:
 *                 type: string
 *                 description: Any special instructions
 *                 example: "Urgent repair needed"
 *               lat:
 *                 type: string
 *                 description: Latitude (optional)
 *                 example: "12.9716"
 *               lng:
 *                 type: string
 *                 description: Longitude (optional)
 *                 example: "77.5946"
 *     responses:
 *       201:
 *         description: Booking created and assigned to partner successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Booking created and assigned to partner successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                     customerId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b4"
 *                     partnerId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b5"
 *                     selectedAddOns:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           basePrice:
 *                             type: number
 *                     status:
 *                       type: string
 *                       example: "accepted"
 *                     scheduledDate:
 *                       type: string
 *                       example: "2024-01-15"
 *                     scheduledTime:
 *                       type: string
 *                       example: "10:00"
 *                     amount:
 *                       type: number
 *                       example: 750
 *                     otp:
 *                       type: string
 *                       example: "123456"
 *       400:
 *         description: Invalid input data or partner not found
 *       500:
 *         description: Server error
 */
router.post('/partner/create-booking', aisensyController.createPartnerBooking);

/**
 * @swagger
 * /api/aisensy/booking/{bookingId}/status:
 *   get:
 *     summary: Get booking status (No Auth Required)
 *     tags: [AiSensy Integration]
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     responses:
 *       200:
 *         description: Booking status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                     status:
 *                       type: string
 *                       example: "accepted"
 *                     paymentStatus:
 *                       type: string
 *                       example: "pending"
 *                     customerName:
 *                       type: string
 *                       example: "John Doe"
 *                     customerPhone:
 *                       type: string
 *                       example: "+919876543210"
 *                     serviceName:
 *                       type: string
 *                       example: "AC Repair"
 *                     scheduledDate:
 *                       type: string
 *                       example: "2024-01-15"
 *                     scheduledTime:
 *                       type: string
 *                       example: "14:30"
 *                     amount:
 *                       type: number
 *                       example: 500
 *                     partnerName:
 *                       type: string
 *                       example: "Partner Name"
 *                     partnerPhone:
 *                       type: string
 *                       example: "+919876543212"
 *                     otp:
 *                       type: string
 *                       example: "123456"
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/booking/:bookingId/status', aisensyController.getBookingStatus);

/**
 * @swagger
 * /api/aisensy/services:
 *   get:
 *     summary: Get available services (No Auth Required)
 *     tags: [AiSensy Integration]
 *     responses:
 *       200:
 *         description: Services retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       serviceId:
 *                         type: string
 *                         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                       serviceName:
 *                         type: string
 *                         example: "AC Repair"
 *                       subServices:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             subServiceId:
 *                               type: string
 *                               example: "60f7b3b3b3b3b3b3b3b3b3b4"
 *                             subServiceName:
 *                               type: string
 *                               example: "AC Installation"
 *                             price:
 *                               type: number
 *                               example: 500
 *       500:
 *         description: Server error
 */
router.get('/services', aisensyController.getAvailableServices);

// Customer Actions
router.put('/customer/cancel-booking', aisensyController.cancelCustomerBooking);
router.post('/customer/submit-review', aisensyController.submitCustomerReview);
router.put('/customer/quotation-action', aisensyController.customerQuotationAction);

// Partner Actions
router.put('/partner/accept-booking', aisensyController.partnerAcceptBooking);
router.put('/partner/reject-booking', aisensyController.partnerRejectBooking);
router.put('/partner/complete-booking', aisensyController.partnerCompleteBooking);
router.post('/partner/create-quotation', aisensyController.partnerCreateQuotation);

/**
 * @swagger
 * /api/aisensy/payu/initiate-payment:
 *   post:
 *     summary: Initiate PayU payment for booking via AiSensy (No Auth Required)
 *     tags: [AiSensy Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - customerPhone
 *               - customerName
 *               - amount
 *             properties:
 *               bookingId:
 *                 type: string
 *                 description: Booking ID to make payment for
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               customerPhone:
 *                 type: string
 *                 description: Customer phone number (must match booking)
 *                 example: "+919876543210"
 *               customerName:
 *                 type: string
 *                 description: Customer name
 *                 example: "John Doe"
 *               customerEmail:
 *                 type: string
 *                 description: Customer email (optional)
 *                 example: "john@example.com"
 *               amount:
 *                 type: string
 *                 description: Payment amount as string
 *                 example: "750"
 *               productInfo:
 *                 type: string
 *                 description: Product description (optional)
 *                 example: "Service Booking Payment"
 *     responses:
 *       200:
 *         description: Payment initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Payment initiated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     txnid:
 *                       type: string
 *                       example: "AISENSY_60f7b3b3b3b3b3b3b3b3b3b3_1640995200000"
 *                     bookingId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                     amount:
 *                       type: number
 *                       example: 750
 *                     paymentUrl:
 *                       type: string
 *                       example: "https://secure.payu.in/_payment?key=..."
 *                     payuData:
 *                       type: object
 *                       properties:
 *                         action:
 *                           type: string
 *                           example: "https://secure.payu.in/_payment"
 *                         params:
 *                           type: object
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/aisensy/payu/payment-status/{txnid}:
 *   get:
 *     summary: Check PayU payment status by transaction ID (No Auth Required)
 *     tags: [AiSensy Integration]
 *     parameters:
 *       - in: path
 *         name: txnid
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *         example: "AISENSY_60f7b3b3b3b3b3b3b3b3b3b3_1640995200000"
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                     txnid:
 *                       type: string
 *                       example: "AISENSY_60f7b3b3b3b3b3b3b3b3b3b3_1640995200000"
 *                     paymentStatus:
 *                       type: string
 *                       enum: ["pending", "completed", "failed"]
 *                       example: "completed"
 *                     paymentMode:
 *                       type: string
 *                       example: "online"
 *                     amount:
 *                       type: number
 *                       example: 750
 *                     customerName:
 *                       type: string
 *                       example: "John Doe"
 *                     serviceName:
 *                       type: string
 *                       example: "AC Repair & Maintenance"
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/aisensy/payu/booking-payment-status/{bookingId}:
 *   get:
 *     summary: Check PayU payment status by booking ID (No Auth Required)
 *     tags: [AiSensy Integration]
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */

// PayU Payment Integration
router.post('/payu/initiate-payment', aisensyController.aisensyInitiatePayment);
router.post('/payu/payment-success', aisensyController.aisensyPaymentSuccess);
router.post('/payu/payment-failure', aisensyController.aisensyPaymentFailure);
router.get('/payu/payment-status/:txnid', aisensyController.aisensyCheckPaymentStatus);
router.get('/payu/booking-payment-status/:bookingId', aisensyController.aisensyCheckPaymentStatus);

/**
 * @swagger
 * /api/aisensy/simple-booking:
 *   post:
 *     summary: Create simple booking with minimal data (No Auth Required)
 *     tags: [AiSensy Integration]
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
 *                 description: Customer phone number (required)
 *                 example: "+919876543210"
 *               name:
 *                 type: string
 *                 description: Customer name (optional, defaults to "Customer")
 *                 example: "John Doe"
 *               service:
 *                 type: string
 *                 description: Service name (optional, uses first available if not provided)
 *                 example: "AC Repair"
 *               amount:
 *                 type: string
 *                 description: Service amount (optional, uses service base price if not provided)
 *                 example: "500"
 *     responses:
 *       201:
 *         description: Simple booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Simple booking created successfully! Customer will be contacted to confirm details."
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                     customerPhone:
 *                       type: string
 *                       example: "+919876543210"
 *                     serviceName:
 *                       type: string
 *                       example: "AC Repair & Maintenance"
 *                     scheduledDate:
 *                       type: string
 *                       example: "2024-02-16"
 *                     scheduledTime:
 *                       type: string
 *                       example: "10:00"
 *                     amount:
 *                       type: number
 *                       example: 500
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     note:
 *                       type: string
 *                       example: "This is a simplified booking. Customer will be contacted to confirm address and other details."
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/aisensy/minimal-booking:
 *   post:
 *     summary: Create ultra-minimal booking with phone only (No Auth Required)
 *     tags: [AiSensy Integration]
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
 *                 description: Customer phone number (only field required)
 *                 example: "+919876543210"
 *     responses:
 *       201:
 *         description: Minimal booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Booking created! Our team will contact you shortly to confirm details."
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                     customerPhone:
 *                       type: string
 *                       example: "+919876543210"
 *                     serviceName:
 *                       type: string
 *                       example: "AC Repair & Maintenance"
 *                     scheduledDate:
 *                       type: string
 *                       example: "2024-02-16"
 *                     scheduledTime:
 *                       type: string
 *                       example: "10:00"
 *                     amount:
 *                       type: number
 *                       example: 500
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     message:
 *                       type: string
 *                       example: "Customer service will call to confirm address and service details"
 *       400:
 *         description: Invalid phone number
 *       500:
 *         description: Server error
 */

// Minimal Request APIs
router.post('/simple-booking', aisensyController.createSimpleBooking);
router.post('/minimal-booking', aisensyController.createMinimalBooking);

/**
 * @swagger
 * /api/aisensy/customer/bookings/{phone}:
 *   get:
 *     summary: Get all bookings by customer phone number (No Auth Required)
 *     tags: [AiSensy Integration]
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer phone number
 *         example: "+919876543210"
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     customerPhone:
 *                       type: string
 *                       example: "+919876543210"
 *                     customerName:
 *                       type: string
 *                       example: "John Doe"
 *                     totalBookings:
 *                       type: number
 *                       example: 3
 *                     bookings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           bookingId:
 *                             type: string
 *                             example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                           serviceName:
 *                             type: string
 *                             example: "AC Repair"
 *                           status:
 *                             type: string
 *                             example: "completed"
 *                           paymentStatus:
 *                             type: string
 *                             example: "completed"
 *                           amount:
 *                             type: number
 *                             example: 750
 *                           scheduledDate:
 *                             type: string
 *                             example: "2024-01-15"
 *                           scheduledTime:
 *                             type: string
 *                             example: "14:30"
 *                           partnerInfo:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: "Partner Name"
 *                               phone:
 *                                 type: string
 *                                 example: "+919876543211"
 *       404:
 *         description: No user found with this phone number
 *       400:
 *         description: Invalid phone number format
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/aisensy/customer/actions:
 *   get:
 *     summary: Get all available customer actions (No Auth Required)
 *     tags: [AiSensy Integration]
 *     responses:
 *       200:
 *         description: Customer actions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Available customer actions"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalActions:
 *                       type: number
 *                       example: 10
 *                     actions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           action:
 *                             type: string
 *                             example: "create-booking"
 *                           method:
 *                             type: string
 *                             example: "POST"
 *                           endpoint:
 *                             type: string
 *                             example: "/api/aisensy/customer/create-booking"
 *                           description:
 *                             type: string
 *                             example: "Create a new booking with full details"
 *                           requiredFields:
 *                             type: array
 *                             items:
 *                               type: string
 *                           optionalFields:
 *                             type: array
 *                             items:
 *                               type: string
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/aisensy/partner/actions:
 *   get:
 *     summary: Get all available partner actions (No Auth Required)
 *     tags: [AiSensy Integration]
 *     responses:
 *       200:
 *         description: Partner actions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Available partner actions"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalActions:
 *                       type: number
 *                       example: 6
 *                     actions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           action:
 *                             type: string
 *                             example: "accept-booking"
 *                           method:
 *                             type: string
 *                             example: "PUT"
 *                           endpoint:
 *                             type: string
 *                             example: "/api/aisensy/partner/accept-booking"
 *                           description:
 *                             type: string
 *                             example: "Accept a pending booking"
 *                           requiredFields:
 *                             type: array
 *                             items:
 *                               type: string
 *                           optionalFields:
 *                             type: array
 *                             items:
 *                               type: string
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/aisensy/partner/bookings/{partnerPhone}:
 *   get:
 *     summary: Get all bookings assigned to partner (No Auth Required)
 *     tags: [AiSensy Integration]
 *     parameters:
 *       - in: path
 *         name: partnerPhone
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner phone number
 *         example: "+919876543210"
 *     responses:
 *       200:
 *         description: Partner bookings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     partnerPhone:
 *                       type: string
 *                       example: "+919876543210"
 *                     partnerName:
 *                       type: string
 *                       example: "Partner Name"
 *                     totalBookings:
 *                       type: number
 *                       example: 5
 *                     bookings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           bookingId:
 *                             type: string
 *                             example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                           serviceName:
 *                             type: string
 *                             example: "Plumbing Service"
 *                           status:
 *                             type: string
 *                             example: "accepted"
 *                           paymentStatus:
 *                             type: string
 *                             example: "pending"
 *                           amount:
 *                             type: number
 *                             example: 1200
 *                           scheduledDate:
 *                             type: string
 *                             example: "2024-01-16"
 *                           scheduledTime:
 *                             type: string
 *                             example: "10:00"
 *                           customerInfo:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: "Customer Name"
 *                               phone:
 *                                 type: string
 *                                 example: "+919876543211"
 *                           otp:
 *                             type: string
 *                             example: "123456"
 *       404:
 *         description: No partner found with this phone number
 *       400:
 *         description: Invalid phone number format
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/aisensy/actions:
 *   get:
 *     summary: Get all available actions (customer, partner, and general) (No Auth Required)
 *     tags: [AiSensy Integration]
 *     responses:
 *       200:
 *         description: All actions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "All available AiSensy API actions"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalActions:
 *                       type: number
 *                       example: 19
 *                     customerActions:
 *                       type: number
 *                       example: 8
 *                     partnerActions:
 *                       type: number
 *                       example: 6
 *                     generalActions:
 *                       type: number
 *                       example: 3
 *                     actions:
 *                       type: object
 *                       properties:
 *                         customer:
 *                           type: array
 *                           items:
 *                             type: object
 *                         partner:
 *                           type: array
 *                           items:
 *                             type: object
 *                         general:
 *                           type: array
 *                           items:
 *                             type: object
 *       500:
 *         description: Server error
 */

// Booking Retrieval and Action APIs
router.get('/customer/bookings/:phone', aisensyController.getBookingsByPhone);
router.get('/customer/actions', aisensyController.getCustomerActions);
router.get('/partner/actions', aisensyController.getPartnerActions);
router.get('/partner/bookings/:partnerPhone', aisensyController.getPartnerBookings);
router.get('/actions', aisensyController.getAllActions);

module.exports = router;