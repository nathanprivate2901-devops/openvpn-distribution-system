const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  validate,
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} = require('../middleware/validator');

/**
 * Authentication Routes
 * All routes related to user authentication and email verification
 */

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { username, email, password }
 */
router.post(
  '/register',
  authLimiter,
  registerSchema,
  validate,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT token
 * @access  Public
 * @body    { email, password }
 */
router.post(
  '/login',
  authLimiter,
  loginSchema,
  validate,
  authController.login
);

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify user email with token (from email link)
 * @access  Public
 * @query   token
 */
router.get(
  '/verify-email',
  authController.verifyEmailFromLink
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email with token
 * @access  Public
 * @body    { token }
 */
router.post(
  '/verify-email',
  verifyEmailSchema,
  validate,
  authController.verifyEmail
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Public
 * @body    { email }
 */
router.post(
  '/resend-verification',
  authLimiter,
  resendVerificationSchema,
  validate,
  authController.resendVerification
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user info
 * @access  Private (requires valid JWT token)
 * @header  Authorization: Bearer <token>
 */
router.get(
  '/me',
  verifyToken,
  authController.getCurrentUser
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 * @body    { email }
 */
router.post(
  '/forgot-password',
  authLimiter,
  forgotPasswordSchema,
  validate,
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 * @body    { token, newPassword }
 */
router.post(
  '/reset-password',
  authLimiter,
  resetPasswordSchema,
  validate,
  authController.resetPassword
);

/**
 * @route   GET /api/auth/verify-reset-token
 * @desc    Verify password reset token validity
 * @access  Public
 * @query   token
 */
router.get(
  '/verify-reset-token',
  authController.verifyResetToken
);

module.exports = router;
