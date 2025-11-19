const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/adminAuth');
const hubController = require('../controllers/hubController');

/**
 * @swagger
 * tags:
 *   name: Hub Management
 *   description: Service hub management endpoints for admin
 */

// Hub CRUD operations
router.post('/', adminAuth, hubController.createHub);
router.get('/', adminAuth, hubController.getAllHubs);
router.get('/:hubId', adminAuth, hubController.getHubById);
router.put('/:hubId', adminAuth, hubController.updateHub);
router.delete('/:hubId', adminAuth, hubController.deleteHub);

// Hub-Partner assignment
router.post('/:hubId/assign-partner', adminAuth, hubController.assignHubToPartner);
router.post('/:hubId/unassign-partner', adminAuth, hubController.unassignHubFromPartner);
router.get('/:hubId/partners', adminAuth, hubController.getHubPartners);

// Area management within hub
router.post('/:hubId/areas', adminAuth, hubController.addAreaToHub);
router.put('/:hubId/areas/:areaId', adminAuth, hubController.updateAreaInHub);
router.delete('/:hubId/areas/:areaId', adminAuth, hubController.deleteAreaFromHub);

// Search and filter
router.get('/pin-code/:pinCode', adminAuth, hubController.getHubsByPinCode);

module.exports = router;

