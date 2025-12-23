/**
 * OpenVPN Routes Module
 *
 * Defines all routes for OpenVPN configuration management.
 * Handles config generation, retrieval, download, and revocation.
 *
 * @module routes/openvpnRoutes
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const openvpnController = require('../controllers/openvpnController');
const vpnProfileController = require('../controllers/vpnProfileController');

/**
 * @route   POST /api/openvpn/generate-config
 * @desc    Generate new OpenVPN configuration file for authenticated user
 * @access  Private (requires authentication)
 * @returns {Object} Configuration file metadata with download info
 *
 * Response format:
 * {
 *   success: true,
 *   message: "OpenVPN configuration generated successfully",
 *   data: {
 *     id: 1,
 *     filename: "username_1234567890.ovpn",
 *     qos_policy: {
 *       name: "Premium",
 *       priority: "high",
 *       bandwidth_limit: 20480
 *     },
 *     created_at: "2025-01-15T10:30:00.000Z"
 *   }
 * }
 */
router.post('/generate-config', verifyToken, openvpnController.generateConfig);

/**
 * @route   GET /api/openvpn/configs
 * @desc    Get all configuration files for authenticated user
 * @access  Private (requires authentication)
 * @returns {Object} List of user's configuration files
 *
 * Response format:
 * {
 *   success: true,
 *   message: "Configuration files retrieved successfully",
 *   data: {
 *     total: 3,
 *     configs: [
 *       {
 *         id: 1,
 *         filename: "username_1234567890.ovpn",
 *         qos_policy: {
 *           name: "Premium",
 *           priority: "high",
 *           bandwidth_limit: 20480
 *         },
 *         downloaded_at: "2025-01-15T10:35:00.000Z",
 *         created_at: "2025-01-15T10:30:00.000Z"
 *       }
 *     ]
 *   }
 * }
 */
router.get('/configs', verifyToken, openvpnController.getUserConfigs);

/**
 * @route   GET /api/openvpn/config/latest
 * @desc    Get the most recent configuration file for authenticated user
 * @access  Private (requires authentication)
 * @returns {Object} Latest configuration file metadata
 *
 * Response format:
 * {
 *   success: true,
 *   message: "Latest configuration retrieved successfully",
 *   data: {
 *     id: 3,
 *     filename: "username_1234567893.ovpn",
 *     qos_policy: {
 *       name: "Premium",
 *       priority: "high",
 *       bandwidth_limit: 20480
 *     },
 *     downloaded_at: null,
 *     created_at: "2025-01-15T11:00:00.000Z"
 *   }
 * }
 */
router.get('/config/latest', verifyToken, openvpnController.getLatestConfig);

/**
 * @route   GET /api/openvpn/config/:id/info
 * @desc    Get configuration file metadata without content
 * @access  Private (requires authentication, owner or admin)
 * @param   {number} id - Configuration file ID
 * @returns {Object} Configuration file metadata
 *
 * Response format:
 * {
 *   success: true,
 *   message: "Configuration info retrieved successfully",
 *   data: {
 *     id: 1,
 *     filename: "username_1234567890.ovpn",
 *     qos_policy: {
 *       name: "Premium",
 *       priority: "high",
 *       bandwidth_limit: 20480
 *     },
 *     downloaded_at: "2025-01-15T10:35:00.000Z",
 *     created_at: "2025-01-15T10:30:00.000Z",
 *     user: {  // Only included for admin users
 *       email: "user@example.com",
 *       name: "John Doe"
 *     }
 *   }
 * }
 */
router.get('/config/:id/info', verifyToken, openvpnController.getConfigInfo);

/**
 * @route   GET /api/openvpn/config/:id
 * @desc    Download OpenVPN configuration file
 * @access  Private (requires authentication, owner or admin)
 * @param   {number} id - Configuration file ID
 * @returns {File} OpenVPN configuration file (.ovpn)
 *
 * Response headers:
 * - Content-Type: application/x-openvpn-profile
 * - Content-Disposition: attachment; filename="username_1234567890.ovpn"
 * - Content-Length: <file_size>
 *
 * Response body: Raw .ovpn file content
 */
router.get('/config/:id', verifyToken, openvpnController.downloadConfig);

/**
 * @route   DELETE /api/openvpn/config/:id
 * @desc    Revoke (soft delete) configuration file
 * @access  Private (requires authentication, owner or admin)
 * @param   {number} id - Configuration file ID
 * @returns {Object} Revocation confirmation
 *
 * Response format:
 * {
 *   success: true,
 *   message: "Configuration file revoked successfully",
 *   data: {
 *     id: 1,
 *     filename: "username_1234567890.ovpn",
 *     revoked_at: "2025-01-15T12:00:00.000Z"
 *   }
 * }
 */
router.delete('/config/:id', verifyToken, openvpnController.revokeConfig);

/**
 * @route   GET /api/openvpn/profile/download
 * @desc    Download user's VPN profile from OpenVPN Access Server
 * @access  Private (requires authentication and email verification)
 * @returns {File} OpenVPN profile file (.ovpn)
 */
router.get('/profile/download', verifyToken, vpnProfileController.downloadProfile);

/**
 * @route   GET /api/openvpn/profile/info
 * @desc    Get profile metadata without downloading
 * @access  Private (requires authentication)
 * @returns {Object} Profile availability and metadata
 */
router.get('/profile/info', verifyToken, vpnProfileController.getProfileInfo);

/**
 * @route   GET /api/openvpn/profile/autologin/:username
 * @desc    Download autologin profile for specific user (admin only)
 * @access  Private (admin only)
 * @param   {string} username - Username for profile generation
 * @returns {File} Autologin OpenVPN profile
 */
router.get('/profile/autologin/:username', verifyToken, isAdmin, vpnProfileController.downloadAutologinProfile);

/**
 * @route   POST /api/openvpn/profile/generate/:userId
 * @desc    Generate profile for specific user (admin only)
 * @access  Private (admin only)
 * @param   {number} userId - User ID
 * @returns {Object} Profile generation metadata
 */
router.post('/profile/generate/:userId', verifyToken, isAdmin, vpnProfileController.generateUserProfile);

/**
 * Error handling for invalid routes
 * Catches any unmatched routes within the /api/openvpn namespace
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'OpenVPN endpoint not found',
    path: req.originalUrl
  });
});

module.exports = router;
