const express = require('express');
const router = express.Router();
const vpnProfileController = require('../controllers/vpnProfileController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

/**
 * VPN Profile Routes
 * All routes require authentication
 */

/**
 * @route   GET /api/vpn/profile/download
 * @desc    Download user's VPN profile
 * @access  Private (authenticated users)
 */
router.get('/download', authenticateToken, vpnProfileController.downloadProfile);

/**
 * @route   GET /api/vpn/profile/info
 * @desc    Get profile metadata without downloading
 * @access  Private (authenticated users)
 */
router.get('/info', authenticateToken, vpnProfileController.getProfileInfo);

/**
 * @route   GET /api/vpn/profile/autologin/:username
 * @desc    Download autologin profile for specific user
 * @access  Private (admin only)
 */
router.get('/autologin/:username', authenticateToken, requireAdmin, vpnProfileController.downloadAutologinProfile);

/**
 * @route   POST /api/vpn/profile/generate/:userId
 * @desc    Generate profile for specific user
 * @access  Private (admin only)
 */
router.post('/generate/:userId', authenticateToken, requireAdmin, vpnProfileController.generateUserProfile);

module.exports = router;
