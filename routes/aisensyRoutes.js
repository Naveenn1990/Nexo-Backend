const express = require('express');
const router = express.Router();
const aisensyController = require('../controllers/aisensyController');

/**
 * @swagger
 * tags:
 *   name: AiSensy Integration
 *   description: Public APIs for AiSensy integration to create bookings without authentication
 */

/**
 * @swagger
 * /api/aisensy/customer/create-booking:
 *   post:
 *     summary: Create a booking for customer via AiSensy (No Auth Required)
 *     tags: [AiSensy Integration]
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
 *               - location
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
 *               subServiceId:
 *                 type: string
 *                 description: Sub-service ID (optional, if known)
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               scheduledDate:
 *                 type: string
 *                 format: date
 *                 description: Booking date (YYYY-MM-DD)
 *                 example: "2024-01-15"
 *               scheduledTime:
 *                 type: string
 *                 description: Booking time (HH:mm)
 *                 example: "14:30"
 *               location:
 *                 type: object
 *                 required:
 *                   - address
 *                 properties:
 *                   address:
 *                     type: string
 *                     description: Full address
 *                     example: "123 Main Street, City"
 *                   landmark:
 *                     type: string
 *                     description: Nearby landmark
 *                     example: "Near City Mall"
 *                   pincode:
 *                     type: string
 *                     description: Area pincode
 *                     example: "560001"
 *               amount:
 *                 type: number
 *                 description: Service amount
 *                 example: 500
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
 *               - location
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
 *               subServiceId:
 *                 type: string
 *                 description: Sub-service ID (optional, if known)
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               scheduledDate:
 *                 type: string
 *                 format: date
 *                 description: Booking date (YYYY-MM-DD)
 *                 example: "2024-01-15"
 *               scheduledTime:
 *                 type: string
 *                 description: Booking time (HH:mm)
 *                 example: "10:00"
 *               location:
 *                 type: object
 *                 required:
 *                   - address
 *                 properties:
 *                   address:
 *                     type: string
 *                     description: Full address
 *                     example: "456 Oak Street, City"
 *                   landmark:
 *                     type: string
 *                     description: Nearby landmark
 *                     example: "Near Park"
 *                   pincode:
 *                     type: string
 *                     description: Area pincode
 *                     example: "560002"
 *               amount:
 *                 type: number
 *                 description: Service amount
 *                 example: 750
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

module.exports = router;