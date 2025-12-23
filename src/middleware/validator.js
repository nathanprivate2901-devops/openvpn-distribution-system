const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Validation middleware to check validation results
 * Should be used after validation chains
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    logger.warn('Validation failed:', {
      path: req.path,
      method: req.method,
      errors: formattedErrors,
      user: req.user?.email || 'anonymous'
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: formattedErrors
    });
  }

  next();
};

/**
 * Registration validation schema
 */
const registerSchema = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .isLength({ max: 128 })
    .withMessage('Password must not exceed 128 characters'),

  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),

  body('full_name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Full name must not exceed 255 characters')
];

/**
 * Login validation schema
 */
const loginSchema = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Update profile validation schema
 */
const updateProfileSchema = [
  body('username')
    .optional()
    .trim()
    .custom((value) => {
      // Allow empty string (skip validation)
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      // Otherwise validate length and pattern
      if (value.length < 3 || value.length > 50) {
        throw new Error('Username must be between 3 and 50 characters');
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
      }
      return true;
    }),

  body('full_name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Full name must not exceed 255 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters')
];

/**
 * Change password validation schema
 */
const changePasswordSchema = [
  body('oldPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
    .isLength({ max: 128 })
    .withMessage('New password must not exceed 128 characters')
    .custom((value, { req }) => {
      if (value === req.body.oldPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    })
];

/**
 * QoS policy validation schema
 */
const qosPolicySchema = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Policy name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Policy name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9_\s-]+$/)
    .withMessage('Policy name can only contain letters, numbers, spaces, underscores, and hyphens'),

  body('bandwidth_limit')
    .isInt({ min: 1, max: 10000 })
    .withMessage('Bandwidth limit must be between 1 and 10000 Mbps')
    .toInt(),

  body('priority')
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be one of: low, medium, high'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
];

/**
 * Email verification validation schema
 */
const verifyEmailSchema = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
    .isLength({ min: 32, max: 64 })
    .withMessage('Invalid token format')
];

/**
 * Resend verification email validation schema
 */
const resendVerificationSchema = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
];

/**
 * Forgot password validation schema
 */
const forgotPasswordSchema = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
];

/**
 * Reset password validation schema
 */
const resetPasswordSchema = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 32, max: 64 })
    .withMessage('Invalid token format'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
    .isLength({ max: 128 })
    .withMessage('New password must not exceed 128 characters')
];

/**
 * Assign QoS policy validation schema
 */
const assignQosSchema = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('Valid user ID is required')
    .toInt(),

  body('policyId')
    .isInt({ min: 1 })
    .withMessage('Valid policy ID is required')
    .toInt()
];

/**
 * OpenVPN config generation validation schema
 */
const generateConfigSchema = [
  body('qosPolicyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Valid QoS policy ID is required')
    .toInt()
];

/**
 * User ID parameter validation
 */
const userIdParamSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid user ID is required')
    .toInt()
];

/**
 * Policy ID parameter validation
 */
const policyIdParamSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid policy ID is required')
    .toInt()
];

/**
 * Config ID parameter validation
 */
const configIdParamSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid config ID is required')
    .toInt()
];

/**
 * Docker container ID parameter validation
 */
const containerIdParamSchema = [
  param('id')
    .notEmpty()
    .withMessage('Container ID is required')
    .isLength({ min: 12, max: 64 })
    .withMessage('Invalid container ID format')
];

/**
 * Pagination query validation
 */
const paginationSchema = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];

/**
 * Search query validation
 */
const searchSchema = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Search query must not exceed 255 characters'),

  query('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Role must be either user or admin'),

  query('verified')
    .optional()
    .isBoolean()
    .withMessage('Verified must be a boolean value')
    .toBoolean()
];

/**
 * Docker create container validation schema
 */
const dockerCreateSchema = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Container name is required')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Container name can only contain letters, numbers, underscores, and hyphens'),

  body('image')
    .trim()
    .notEmpty()
    .withMessage('Image name is required'),

  body('port')
    .optional()
    .isInt({ min: 1, max: 65535 })
    .withMessage('Port must be between 1 and 65535')
    .toInt(),

  body('protocol')
    .optional()
    .isIn(['tcp', 'udp'])
    .withMessage('Protocol must be either tcp or udp')
];

/**
 * Docker pull image validation schema
 */
const dockerPullSchema = [
  body('image')
    .trim()
    .notEmpty()
    .withMessage('Image name is required')
];

/**
 * Container logs query validation
 */
const containerLogsSchema = [
  query('tail')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Tail must be between 1 and 10000')
    .toInt(),

  query('follow')
    .optional()
    .isBoolean()
    .withMessage('Follow must be a boolean value')
    .toBoolean()
];

/**
 * Update user validation schema (admin)
 */
const updateUserSchema = [
  body('username')
    .optional()
    .trim()
    .custom((value) => {
      // Allow empty string (skip validation)
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      // Otherwise validate length and pattern
      if (value.length < 3 || value.length > 50) {
        throw new Error('Username must be between 3 and 50 characters');
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
      }
      return true;
    }),

  body('full_name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Full name must not exceed 255 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  body('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Role must be either user or admin'),

  body('email_verified')
    .optional()
    .isBoolean()
    .withMessage('Email verified must be a boolean value')
    .toBoolean()
];

// Backward compatibility with existing QoS schemas
const createQosPolicySchema = [
  body('policy_name')
    .trim()
    .notEmpty()
    .withMessage('Policy name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Policy name must be between 3 and 100 characters'),

  body('max_download_speed')
    .isInt({ min: 1 })
    .withMessage('Max download speed must be a positive integer')
    .toInt(),

  body('max_upload_speed')
    .isInt({ min: 1 })
    .withMessage('Max upload speed must be a positive integer')
    .toInt(),

  body('priority')
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be one of: low, medium, high'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
];

const updateQosPolicySchema = [
  body('policy_name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Policy name must be between 3 and 100 characters'),

  body('max_download_speed')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max download speed must be a positive integer')
    .toInt(),

  body('max_upload_speed')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max upload speed must be a positive integer')
    .toInt(),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be one of: low, medium, high'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
];

const assignQosPolicySchema = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('Valid user ID is required')
    .toInt(),

  body('policyId')
    .isInt({ min: 1 })
    .withMessage('Valid policy ID is required')
    .toInt()
];

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  qosPolicySchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  assignQosSchema,
  generateConfigSchema,
  userIdParamSchema,
  policyIdParamSchema,
  configIdParamSchema,
  containerIdParamSchema,
  paginationSchema,
  searchSchema,
  dockerCreateSchema,
  dockerPullSchema,
  containerLogsSchema,
  updateUserSchema,
  // Backward compatibility exports
  createQosPolicySchema,
  updateQosPolicySchema,
  assignQosPolicySchema
};
