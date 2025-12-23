const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  changePassword,
  getConfigs,
  getDashboard,
  deleteAccount,
} = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');
const {
  validate,
  updateProfileSchema,
  changePasswordSchema,
} = require('../middleware/validator');

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', verifyToken, getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', verifyToken, updateProfileSchema, validate, updateProfile);

/**
 * @route   PUT /api/users/password
 * @desc    Change user password
 * @access  Private
 */
router.put('/password', verifyToken, changePasswordSchema, validate, changePassword);

/**
 * @route   GET /api/users/configs
 * @desc    Get user's VPN configs with pagination
 * @access  Private
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10, max: 100)
 */
router.get('/configs', verifyToken, getConfigs);

/**
 * @route   GET /api/users/dashboard
 * @desc    Get user dashboard statistics
 * @access  Private
 */
router.get('/dashboard', verifyToken, getDashboard);

/**
 * @route   DELETE /api/users/account
 * @desc    Soft delete user account
 * @access  Private
 */
router.delete('/account', verifyToken, deleteAccount);

module.exports = router;
