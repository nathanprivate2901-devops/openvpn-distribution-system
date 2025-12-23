const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { verifyToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validator');
const { body } = require('express-validator');

// Validation schemas
const updateDeviceSchema = [
    body('name').optional().trim().isLength({ min: 1, max: 255 })
        .withMessage('Device name must be between 1 and 255 characters'),
    body('deviceType').optional().trim().isIn(['mobile', 'desktop', 'tablet', 'laptop'])
        .withMessage('Device type must be mobile, desktop, laptop, or tablet'),
    body('is_active').optional().isBoolean()
        .withMessage('is_active must be a boolean')
];

// Routes
router.use(verifyToken); // All device routes require authentication

/**
 * @route   GET /api/devices
 * @desc    Get all devices for authenticated user (auto-created on VPN connection)
 * @access  Private
 */
router.get('/', deviceController.getDevices);

/**
 * @route   GET /api/devices/:id
 * @desc    Get device by ID
 * @access  Private
 */
router.get('/:id', deviceController.getDevice);

/**
 * @route   PUT /api/devices/:id
 * @desc    Update device
 * @access  Private
 */
router.put('/:id', updateDeviceSchema, validate, deviceController.updateDevice);

/**
 * @route   DELETE /api/devices/:id
 * @desc    Delete device
 * @access  Private
 */
router.delete('/:id', deviceController.deleteDevice);

module.exports = router;