# Middleware Components

This directory contains all middleware components for the OpenVPN Distribution System.

## Components Overview

### 1. authMiddleware.js
JWT authentication and authorization middleware.

**Functions:**
- `verifyToken` - Verifies JWT token and attaches user to request
- `isAdmin` - Ensures authenticated user has admin role
- `optionalAuth` - Optional authentication (doesn't require token)

**Usage:**
```javascript
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Protected route (requires authentication)
router.get('/profile', verifyToken, userController.getProfile);

// Admin-only route
router.get('/admin/stats', verifyToken, isAdmin, adminController.getStats);

// Optional authentication
router.get('/public', optionalAuth, controller.handleRequest);
```

### 2. errorHandler.js
Centralized error handling with custom error class.

**Functions:**
- `errorHandler` - Main error handling middleware
- `notFound` - 404 handler for undefined routes
- `asyncHandler` - Wrapper for async route handlers
- `AppError` - Custom error class for operational errors

**Usage:**
```javascript
const { errorHandler, notFound, asyncHandler, AppError } = require('../middleware/errorHandler');

// Wrap async routes
router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.findAll();
  res.json(users);
}));

// Throw custom errors
if (!user) {
  throw new AppError('User not found', 404, 'USER_NOT_FOUND');
}

// In app.js (register at the end)
app.use(notFound);        // Handle 404
app.use(errorHandler);    // Handle all errors
```

### 3. rateLimiter.js
Request rate limiting with multiple configurations.

**Available Limiters:**
- `generalLimiter` - Default rate limit (100 req/15min)
- `authLimiter` - Strict limit for auth endpoints (5 req/15min)
- `createLimiter` - Moderate limit for resource creation (10 req/hour)
- `readLimiter` - Lenient limit for GET requests (200 req/15min)
- `adminLimiter` - Higher limit for admins (300 req/15min)
- `dockerLimiter` - Restrictive for Docker ops (20 req/5min)
- `createRateLimiter` - Factory for custom limiters

**Usage:**
```javascript
const {
  generalLimiter,
  authLimiter,
  adminLimiter
} = require('../middleware/rateLimiter');

// Apply to all routes
app.use('/api', generalLimiter);

// Specific limiters
router.post('/login', authLimiter, authController.login);
router.get('/admin/*', verifyToken, isAdmin, adminLimiter);

// Custom limiter
const customLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  max: 50,                   // 50 requests
  message: 'Custom rate limit message'
});
```

**Environment Variables:**
```env
# General rate limiting
RATE_LIMIT_WINDOW_MS=900000        # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100        # Max requests per window

# Authentication rate limiting
AUTH_RATE_LIMIT_WINDOW_MS=900000   # 15 minutes
AUTH_RATE_LIMIT_MAX_REQUESTS=5     # Max login attempts

# Create operations
CREATE_RATE_LIMIT_WINDOW_MS=3600000  # 1 hour
CREATE_RATE_LIMIT_MAX_REQUESTS=10    # Max creations

# Admin operations
ADMIN_RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
ADMIN_RATE_LIMIT_MAX_REQUESTS=300    # Max admin requests

# Docker operations
DOCKER_RATE_LIMIT_WINDOW_MS=300000   # 5 minutes
DOCKER_RATE_LIMIT_MAX_REQUESTS=20    # Max docker ops
```

### 4. validator.js
Request validation using express-validator.

**Available Schemas:**
- `registerSchema` - User registration validation
- `loginSchema` - Login validation
- `updateProfileSchema` - Profile update validation
- `changePasswordSchema` - Password change validation
- `qosPolicySchema` - QoS policy validation
- `verifyEmailSchema` - Email verification validation
- `resendVerificationSchema` - Resend verification validation
- `assignQosSchema` - QoS assignment validation
- `generateConfigSchema` - Config generation validation
- `userIdParamSchema` - User ID parameter validation
- `policyIdParamSchema` - Policy ID parameter validation
- `configIdParamSchema` - Config ID parameter validation
- `containerIdParamSchema` - Container ID parameter validation
- `paginationSchema` - Pagination query validation
- `searchSchema` - Search query validation
- `dockerCreateSchema` - Docker container creation validation
- `dockerPullSchema` - Docker image pull validation
- `containerLogsSchema` - Container logs query validation
- `updateUserSchema` - Admin user update validation

**Usage:**
```javascript
const {
  registerSchema,
  loginSchema,
  validate
} = require('../middleware/validator');

// Apply validation + validate middleware
router.post('/register',
  registerSchema,   // Validation rules
  validate,         // Check for errors
  authController.register
);

router.post('/login',
  loginSchema,
  validate,
  authController.login
);

// Parameter validation
router.get('/users/:id',
  userIdParamSchema,
  validate,
  userController.getUser
);

// Query validation
router.get('/users',
  paginationSchema,
  searchSchema,
  validate,
  userController.listUsers
);
```

## Complete Route Example

Here's a complete example showing all middleware components working together:

```javascript
const express = require('express');
const router = express.Router();

const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const { generalLimiter, authLimiter } = require('../middleware/rateLimiter');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  validate
} = require('../middleware/validator');

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

// Public routes with auth rate limiting
router.post('/register',
  authLimiter,
  registerSchema,
  validate,
  asyncHandler(authController.register)
);

router.post('/login',
  authLimiter,
  loginSchema,
  validate,
  asyncHandler(authController.login)
);

// Protected routes with general rate limiting
router.get('/profile',
  generalLimiter,
  verifyToken,
  asyncHandler(userController.getProfile)
);

router.put('/profile',
  generalLimiter,
  verifyToken,
  updateProfileSchema,
  validate,
  asyncHandler(userController.updateProfile)
);

// Admin-only routes
router.get('/admin/users',
  verifyToken,
  isAdmin,
  asyncHandler(userController.getAllUsers)
);

module.exports = router;
```

## Application Setup (index.js)

```javascript
const express = require('express');
const app = express();

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general rate limiting to all API routes
app.use('/api', generalLimiter);

// Health check (no rate limiting)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/vpn', require('./routes/openvpnRoutes'));
app.use('/api/qos', require('./routes/qosRoutes'));
app.use('/api/docker', require('./routes/dockerRoutes'));

// Error handling (must be last)
app.use(notFound);        // 404 handler
app.use(errorHandler);    // Global error handler

module.exports = app;
```

## Error Response Format

All errors return a consistent JSON format:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "errors": [
    {
      "field": "fieldName",
      "message": "Field-specific error"
    }
  ]
}
```

## Security Best Practices

1. **Always use asyncHandler** for async route handlers to catch errors
2. **Apply verifyToken** before accessing protected resources
3. **Use appropriate rate limiters** for different endpoint types
4. **Validate all input** using validation schemas
5. **Never expose sensitive info** in error messages (production)
6. **Log security events** (failed logins, admin actions, etc.)

## Testing Middleware

```javascript
// Example test with supertest
const request = require('supertest');
const app = require('../app');

describe('Authentication Middleware', () => {
  it('should reject requests without token', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('No token');
  });

  it('should accept requests with valid token', async () => {
    const token = 'valid-jwt-token';
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
```

## Troubleshooting

### JWT Errors
- **TOKEN_EXPIRED**: Token has expired, user needs to login again
- **TOKEN_INVALID**: Malformed or tampered token
- Check JWT_SECRET is properly set in environment

### Rate Limiting
- Headers include rate limit info: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
- Adjust limits via environment variables
- Different keys for IP vs authenticated users

### Validation Errors
- Check request body/params match expected format
- Review validation schema rules
- Validation errors include field name and specific issue

## Performance Notes

- **Connection Pooling**: Database connections are pooled (see database.js)
- **Rate Limit Storage**: Uses memory store (consider Redis for production scale)
- **Async Handlers**: All async operations are properly wrapped
- **Error Logging**: Winston logger handles all error logging
