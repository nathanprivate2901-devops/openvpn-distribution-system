# Middleware Quick Reference Card

## Import Statements

```javascript
// Authentication
const { verifyToken, isAdmin, optionalAuth } = require('../middleware/authMiddleware');

// Error Handling
const { errorHandler, notFound, asyncHandler, AppError } = require('../middleware/errorHandler');

// Rate Limiting
const {
  generalLimiter,
  authLimiter,
  createLimiter,
  readLimiter,
  adminLimiter,
  dockerLimiter
} = require('../middleware/rateLimiter');

// Validation
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  qosPolicySchema,
  validate
} = require('../middleware/validator');
```

## Common Patterns

### Public Route (No Auth)
```javascript
router.post('/register',
  authLimiter,
  registerSchema,
  validate,
  asyncHandler(controller.register)
);
```

### Protected Route (Auth Required)
```javascript
router.get('/profile',
  generalLimiter,
  verifyToken,
  asyncHandler(controller.getProfile)
);
```

### Admin Only Route
```javascript
router.get('/admin/stats',
  verifyToken,
  isAdmin,
  asyncHandler(controller.getStats)
);
```

### Protected + Validation
```javascript
router.put('/profile',
  generalLimiter,
  verifyToken,
  updateProfileSchema,
  validate,
  asyncHandler(controller.updateProfile)
);
```

### Resource Creation with Rate Limit
```javascript
router.post('/qos/policies',
  createLimiter,
  verifyToken,
  isAdmin,
  qosPolicySchema,
  validate,
  asyncHandler(controller.createPolicy)
);
```

## Error Handling

### Throw Custom Error
```javascript
if (!user) {
  throw new AppError('User not found', 404, 'USER_NOT_FOUND');
}
```

### Async Route Handler
```javascript
router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.findAll();
  res.json({ success: true, data: users });
}));
```

## Accessing User Data

After `verifyToken` middleware:

```javascript
const userId = req.user.id;
const userEmail = req.user.email;
const userRole = req.user.role;
const username = req.user.username;
```

## Validation Schemas Cheat Sheet

| Schema | Fields | Rules |
|--------|--------|-------|
| registerSchema | email, password, username, full_name | Password: 8+ chars, upper, lower, number |
| loginSchema | email, password | Required fields |
| updateProfileSchema | username, full_name, email | Optional fields |
| changePasswordSchema | oldPassword, newPassword | New password strength check |
| qosPolicySchema | name, bandwidth_limit, priority | Bandwidth: 1-10000, Priority: low/medium/high |
| userIdParamSchema | id (param) | Integer > 0 |
| paginationSchema | page, limit (query) | Page: >0, Limit: 1-100 |

## Rate Limiters Comparison

| Limiter | Window | Max Requests | Use Case |
|---------|--------|--------------|----------|
| generalLimiter | 15 min | 100 | General API routes |
| authLimiter | 15 min | 5 | Login, register |
| createLimiter | 1 hour | 10 | Resource creation |
| readLimiter | 15 min | 200 | GET requests |
| adminLimiter | 15 min | 300 | Admin operations |
| dockerLimiter | 5 min | 20 | Docker operations |

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| TOKEN_EXPIRED | 401 | JWT token expired |
| TOKEN_INVALID | 401 | Invalid JWT token |
| VALIDATION_ERROR | 400 | Input validation failed |
| USER_NOT_FOUND | 404 | User doesn't exist |
| DUPLICATE_ENTRY | 409 | Database duplicate key |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email",
      "value": "bad-email"
    }
  ]
}
```

## Environment Variables (Required)

```env
JWT_SECRET=your-secret-key-here
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX_REQUESTS=5
```

## Middleware Order (Important!)

```javascript
app.use(express.json());                    // 1. Body parsing
app.use('/api', generalLimiter);           // 2. Rate limiting
app.use('/api/auth', authRoutes);          // 3. Routes
app.use(notFound);                         // 4. 404 handler
app.use(errorHandler);                     // 5. Error handler (LAST!)
```

## Testing Snippets

### Test Authentication
```javascript
it('should reject unauthorized requests', async () => {
  const res = await request(app)
    .get('/api/users/profile')
    .expect(401);
});
```

### Test with Token
```javascript
it('should accept valid token', async () => {
  const res = await request(app)
    .get('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
});
```

### Test Validation
```javascript
it('should validate input', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'invalid' })
    .expect(400);

  expect(res.body.code).toBe('VALIDATION_ERROR');
});
```

## Quick Debugging

### Check logs
```bash
tail -f logs/combined.log
tail -f logs/error.log
```

### Test JWT token
```bash
curl http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test rate limiting
```bash
for i in {1..10}; do
  curl http://localhost:3000/api/auth/login
done
```

## Pro Tips

1. Always use `asyncHandler` for async routes
2. Apply `verifyToken` before `isAdmin`
3. Put validation middleware before controller
4. Use `authLimiter` for sensitive endpoints
5. Throw `AppError` for operational errors
6. Check `req.user` exists after `verifyToken`
7. Use `optionalAuth` for mixed public/private endpoints
8. Log important security events
