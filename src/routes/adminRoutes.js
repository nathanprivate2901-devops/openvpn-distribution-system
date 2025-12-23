const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const { updateUserSchema, validate } = require('../middleware/validator');

/**
 * Admin Routes
 * All routes require authentication and admin role
 * Base path: /api/admin
 */

// Apply authentication and admin check to all routes
router.use(verifyToken);
router.use(isAdmin);

/**
 * User Management Routes
 */

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination, search, and filtering
 * @access  Admin only
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 10, max: 100)
 * @query   {string} search - Search in email and name fields
 * @query   {string} role - Filter by role (user/admin)
 * @query   {string} verified - Filter by email_verified status (true/false)
 */
router.get('/users', adminController.getAllUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get specific user by ID with detailed information
 * @access  Admin only
 * @param   {string} id - User ID
 */
router.get('/users/:id', adminController.getUserById);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user information
 * @access  Admin only
 * @param   {string} id - User ID
 * @body    {string} [username] - User's username
 * @body    {string} [email] - User's email
 * @body    {string} [role] - User's role (user/admin)
 * @body    {boolean} [email_verified] - Email verification status
 */
router.put('/users/:id', updateUserSchema, validate, adminController.updateUser);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user (soft or hard delete)
 * @access  Admin only
 * @param   {string} id - User ID
 * @query   {string} hard - Set to 'true' for permanent deletion (default: soft delete)
 */
router.delete('/users/:id', adminController.deleteUser);

/**
 * @route   POST /api/admin/users/:id/reset-password
 * @desc    Trigger password reset for a user (sends reset email)
 * @access  Admin only
 * @param   {string} id - User ID
 */
router.post('/users/:id/reset-password', adminController.resetUserPassword);

/**
 * System Statistics Routes
 */

/**
 * @route   GET /api/admin/stats
 * @desc    Get system statistics
 * @access  Admin only
 * @returns {object} System stats including users, configs, policies, and system info
 */
router.get('/stats', adminController.getSystemStats);

/**
 * Configuration Management Routes
 */

/**
 * @route   GET /api/admin/configs
 * @desc    Get all VPN configurations with pagination
 * @access  Admin only
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 10, max: 100)
 */
router.get('/configs', adminController.getAllConfigs);

/**
 * @route   DELETE /api/admin/configs/:id
 * @desc    Delete VPN configuration file
 * @access  Admin only
 * @param   {string} id - Configuration ID
 */
router.delete('/configs/:id', adminController.deleteConfig);

/**
 * Maintenance Routes
 */

/**
 * @route   POST /api/admin/cleanup-tokens
 * @desc    Clean up expired verification tokens
 * @access  Admin only
 * @returns {object} Count of deleted tokens
 */
router.post('/cleanup-tokens', adminController.cleanupExpiredTokens);

/**
 * Device Management Routes
 */

/**
 * @route   GET /api/admin/devices
 * @desc    Get all devices across all users with pagination
 * @access  Admin only
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 20, max: 100)
 */
router.get('/devices', adminController.getAllDevices);

module.exports = router;
