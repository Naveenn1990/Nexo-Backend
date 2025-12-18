const express = require('express');
const router = express.Router();
const cityController = require('../controllers/cityController');
const { adminAuth } = require('../middleware/adminAuth');
const { upload } = require('../middleware/upload');

// Public routes
router.get('/enabled', cityController.getEnabledCities);

// Admin routes
router.get('/all', adminAuth, cityController.getAllCities);
router.post('/', adminAuth, cityController.createCity);
router.put('/:id', adminAuth, cityController.updateCity);
router.patch('/:id/toggle', adminAuth, cityController.toggleCityStatus);
router.delete('/:id', adminAuth, cityController.deleteCity);

// Image upload route
router.post('/upload-image', adminAuth, upload.single('image'), cityController.uploadCityImage);

module.exports = router;
