/**
 * Example Routes - Demonstrates middleware usage
 * This file shows how to properly use all middleware components
 */

const express = require('express');
const router = express.Router();

// Import middleware components
const { verifyToken, isAdmin, optionalAuth } = require('./authMiddleware');
const { asyncHandler, AppError } = require('./errorHandler');
const {
  generalLimiter,
  authLimiter,
  createLimiter,
  dockerLimiter
} = require('./rateLimiter');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  qosPolicySchema,
  userIdParamSchema,
  paginationSchema,
  validate
} = require('./validator');

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

/**
 * POST /auth/register
 * Public route with strict rate limiting and validation
 */
router.post('/auth/register',
  authLimiter,           // Limit registration attempts
  registerSchema,        // Validate registration data
  validate,              // Check validation results
  asyncHandler(async (req, res) => {
    const { email, password, username } = req.body;

    // Simulate user registration
    // In real implementation, this would call authController.register
    const user = {
      id: 1,
      email,
      username,
      role: 'user'
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user
    });
  })
);

/**
 * POST /auth/login
 * Public route with strict rate limiting
 */
router.post('/auth/login',
  authLimiter,           // Prevent brute force attacks
  loginSchema,           // Validate credentials
  validate,              // Check validation results
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Simulate login logic
    const token = 'sample-jwt-token-here';
    const user = {
      id: 1,
      email,
      username: 'johndoe',
      role: 'user'
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: { token, user }
    });
  })
);

// ============================================================================
// USER ROUTES (Protected)
// ============================================================================

/**
 * GET /users/profile
 * Protected route - requires authentication
 */
router.get('/users/profile',
  generalLimiter,        // Standard rate limiting
  verifyToken,           // Require JWT authentication
  asyncHandler(async (req, res) => {
    // req.user is populated by verifyToken middleware
    const userId = req.user.id;

    // Simulate fetching user profile
    const profile = {
      id: userId,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      created_at: new Date()
    };

    res.json({
      success: true,
      data: profile
    });
  })
);

/**
 * PUT /users/profile
 * Protected route - update profile
 */
router.put('/users/profile',
  generalLimiter,
  verifyToken,
  updateProfileSchema,   // Validate update data
  validate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const updates = req.body;

    // Simulate profile update
    const updatedProfile = {
      id: userId,
      ...updates,
      updated_at: new Date()
    };

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile
    });
  })
);

/**
 * PUT /users/password
 * Protected route - change password
 */
router.put('/users/password',
  generalLimiter,
  verifyToken,
  changePasswordSchema,  // Validate password change
  validate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    // Simulate password verification
    const isValid = true; // Would verify oldPassword here

    if (!isValid) {
      throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
    }

    // Update password logic would go here

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

// ============================================================================
// ADMIN ROUTES (Protected + Admin Only)
// ============================================================================

/**
 * GET /admin/users
 * Admin only - list all users
 */
router.get('/admin/users',
  generalLimiter,
  verifyToken,           // Must be authenticated
  isAdmin,               // Must have admin role
  paginationSchema,      // Validate pagination params
  validate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    // Simulate fetching users
    const users = [
      { id: 1, username: 'user1', email: 'user1@example.com', role: 'user' },
      { id: 2, username: 'user2', email: 'user2@example.com', role: 'user' }
    ];

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: users.length
        }
      }
    });
  })
);

/**
 * GET /admin/users/:id
 * Admin only - get specific user
 */
router.get('/admin/users/:id',
  generalLimiter,
  verifyToken,
  isAdmin,
  userIdParamSchema,     // Validate user ID parameter
  validate,
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    // Simulate fetching specific user
    const user = {
      id: userId,
      username: 'johndoe',
      email: 'john@example.com',
      role: 'user',
      email_verified: true,
      created_at: new Date()
    };

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: user
    });
  })
);

/**
 * DELETE /admin/users/:id
 * Admin only - delete user
 */
router.delete('/admin/users/:id',
  generalLimiter,
  verifyToken,
  isAdmin,
  userIdParamSchema,
  validate,
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    // Prevent self-deletion
    if (userId === req.user.id) {
      throw new AppError('Cannot delete your own account', 400, 'SELF_DELETE_FORBIDDEN');
    }

    // Simulate user deletion
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  })
);

// ============================================================================
// QOS POLICY ROUTES
// ============================================================================

/**
 * POST /qos/policies
 * Admin only - create QoS policy
 */
router.post('/qos/policies',
  createLimiter,         // Limit resource creation
  verifyToken,
  isAdmin,
  qosPolicySchema,       // Validate QoS policy data
  validate,
  asyncHandler(async (req, res) => {
    const { name, bandwidth_limit, priority, description } = req.body;

    // Simulate policy creation
    const policy = {
      id: 1,
      name,
      bandwidth_limit,
      priority,
      description,
      created_by: req.user.id,
      created_at: new Date()
    };

    res.status(201).json({
      success: true,
      message: 'QoS policy created successfully',
      data: policy
    });
  })
);

/**
 * GET /qos/policies
 * Protected - list QoS policies
 */
router.get('/qos/policies',
  generalLimiter,
  verifyToken,
  asyncHandler(async (req, res) => {
    // Simulate fetching policies
    const policies = [
      { id: 1, name: 'Premium', bandwidth_limit: 100, priority: 'high' },
      { id: 2, name: 'Standard', bandwidth_limit: 50, priority: 'medium' }
    ];

    res.json({
      success: true,
      data: policies
    });
  })
);

// ============================================================================
// DOCKER ROUTES (Admin Only)
// ============================================================================

/**
 * GET /docker/containers
 * Admin only - list Docker containers
 */
router.get('/docker/containers',
  dockerLimiter,         // Strict rate limiting for Docker operations
  verifyToken,
  isAdmin,
  asyncHandler(async (req, res) => {
    // Simulate fetching containers
    const containers = [
      {
        id: 'abc123',
        name: 'openvpn-server',
        status: 'running',
        image: 'kylemanna/openvpn'
      }
    ];

    res.json({
      success: true,
      data: containers
    });
  })
);

/**
 * POST /docker/containers/:id/restart
 * Admin only - restart container
 */
router.post('/docker/containers/:id/restart',
  dockerLimiter,
  verifyToken,
  isAdmin,
  asyncHandler(async (req, res) => {
    const containerId = req.params.id;

    // Simulate container restart
    res.json({
      success: true,
      message: `Container ${containerId} restarted successfully`
    });
  })
);

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * GET /public/info
 * Public route with optional authentication
 */
router.get('/public/info',
  generalLimiter,
  optionalAuth,          // Token optional but used if present
  asyncHandler(async (req, res) => {
    const response = {
      success: true,
      data: {
        service: 'OpenVPN Distribution System',
        version: '1.0.0'
      }
    };

    // Add user info if authenticated
    if (req.user) {
      response.data.authenticated = true;
      response.data.username = req.user.username;
    }

    res.json(response);
  })
);

// ============================================================================
// ERROR DEMONSTRATION ROUTES
// ============================================================================

/**
 * GET /test/custom-error
 * Demonstrates custom AppError
 */
router.get('/test/custom-error',
  asyncHandler(async (req, res) => {
    throw new AppError(
      'This is a custom operational error',
      400,
      'CUSTOM_ERROR'
    );
  })
);

/**
 * GET /test/async-error
 * Demonstrates async error handling
 */
router.get('/test/async-error',
  asyncHandler(async (req, res) => {
    // Simulate async database operation
    await new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('Database connection failed')), 100);
    });
  })
);

/**
 * GET /test/validation-error
 * Demonstrates validation error
 */
router.post('/test/validation',
  registerSchema,
  validate,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: 'Validation passed'
    });
  })
);

module.exports = router;
