# Security Quick Reference Guide

## Last Updated: January 2026

## Overview

This guide documents the comprehensive security measures implemented in the OpenVPN Distribution System, including authentication hardening, input validation, rate limiting, and Docker security controls.

## For Developers: What Changed?

### Summary
Multiple security layers have been implemented to protect against common vulnerabilities:
- Authentication timing attack prevention
- Rate limiting with IP + email combination
- Generic error messages to prevent enumeration
- Input sanitization across all endpoints
- SQL injection prevention
- XSS protection with CSP headers
- Docker socket access controls

---

## 1. Rate Limiting Behavior

**What Changed:**
Rate limiting now uses IP + email combination instead of just email for better protection against distributed attacks.

**Impact on Your Code:**
✅ No code changes needed - this is transparent to your application logic.

**What It Prevents:**
- Attackers can't bypass rate limits by using different email addresses
- Distributed brute force attacks are mitigated
- Per-IP + per-email limits protect against credential stuffing

**Configuration:**
```env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100   # Max requests per window
```

---

## 2. Generic Error Messages (Enumeration Protection)

**What Changed:**
Authentication endpoints now return generic messages instead of specific error details to prevent user enumeration attacks.

### Registration Endpoint (`POST /api/auth/register`)

**Before:**
```json
{
  "success": false,
  "message": "Email already registered"
}
```

**Now:**
```json
{
  "success": true,
  "message": "If this email is not already registered, you will receive a verification email shortly."
}
```

### Resend Verification (`POST /api/auth/resend-verification`)

**Before:**
```json
{
  "success": false,
  "message": "User not found"
}
```

**Now:**
```json
{
  "success": true,
  "message": "If an account exists with this email, a verification link will be sent."
}
```

**Impact on Your Frontend:**
⚠️ Update your UI to handle these generic messages appropriately.

**Example Frontend Update:**
```javascript
// Before
if (response.success === false && response.message.includes('already registered')) {
  // Show "email taken" error
}

// After - Update to:
if (response.success === true) {
  // Show generic success message regardless
  showMessage('Please check your email for further instructions.');
}
```

---

## 3. Login Still Works The Same

**What Changed:**
Backend now always performs password comparison (timing attack prevention).

**Impact on Your Code:**
✅ No changes needed - API contract unchanged.

**What It Prevents:**
Attackers can't use response time to determine if emails exist.

---

## 4. Environment Variables Now Enforced

**What Changed:**
Application will not start in production without proper JWT_SECRET.

**Required Actions:**

1. **Generate a strong JWT secret:**
   ```bash
   openssl rand -base64 64
   ```

2. **Add to your `.env` file:**
   ```bash
   JWT_SECRET=<paste the generated secret here>
   NODE_ENV=production
   ```

3. **Test locally first:**
   ```bash
   # This will work (development)
   NODE_ENV=development npm start

   # This will fail without JWT_SECRET (production)
   NODE_ENV=production npm start
   ```

**Error You'll See If Missing:**
```
CRITICAL SECURITY ERROR: JWT_SECRET must be set to a strong, unique value in production.
Generate a secure secret using: openssl rand -base64 64
```

---

## 5. Password Hashing Strength Increased

**What Changed:**
- Registration: bcrypt rounds increased from 10 to 12
- Password change: Now properly hashes passwords (critical fix!)

**Impact on Your Code:**
✅ No changes needed - still using bcrypt, just stronger.

**Performance Note:**
Password operations may take ~50-100ms longer (still acceptable).

---

## 6. All Passwords Now Properly Hashed

**What Changed:**
Password change endpoint now hashes passwords before storage (was storing plain text!).

**Impact on Your Code:**
✅ No changes needed - endpoint works the same way.

**Critical Fix:**
This was a critical vulnerability. Any passwords changed before this fix were stored in plain text. Consider:
- Forcing password reset for all users who changed passwords recently
- Checking database for any plain text passwords

---

## Quick Security Checklist

### For Development:
- [ ] Update frontend to handle generic auth messages
- [ ] Test registration with existing email
- [ ] Test login with wrong credentials
- [ ] Test password change functionality
- [ ] Verify rate limiting works (try multiple login attempts)
- [ ] Test input sanitization on all forms
- [ ] Verify CORS configuration is correct

### For Production Deployment:
- [ ] Generate strong JWT_SECRET (minimum 32 characters)
  ```bash
  openssl rand -base64 64
  ```
- [ ] Update `.env` file with all required security variables
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS with valid SSL/TLS certificate
- [ ] Configure firewall rules (only expose necessary ports)
- [ ] Set up security headers (Helmet.js configured)
- [ ] Configure SMTP with app-specific password
- [ ] Implement Docker socket proxy for production
- [ ] Enable audit logging and monitoring
- [ ] Set up rate limiting alerts
- [ ] Regular security updates schedule
- [ ] Database backup strategy in place

### Docker Security:
- [ ] Review and update Docker volume mount whitelist
- [ ] Implement Docker socket proxy (recommended for production)
- [ ] Restrict Docker API access to admin users only
- [ ] Monitor Docker container creation/modification events
- [ ] Regular image vulnerability scanning
- [ ] Keep Docker daemon updated

### Database Security:
- [ ] Use strong database passwords
- [ ] Restrict database access to application only
- [ ] Enable MySQL slow query log
- [ ] Regular database backups
- [ ] Parameterized queries throughout (already implemented)

---

## Security Features Implemented

### Authentication & Authorization
- ✅ JWT token-based authentication
- ✅ bcrypt password hashing (12 rounds)
- ✅ Role-based access control (User/Admin)
- ✅ Email verification required
- ✅ Password reset with secure tokens
- ✅ Session timeout enforcement

### Input Validation & Sanitization
- ✅ express-validator on all endpoints
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection (Content Security Policy)
- ✅ HTML entity encoding
- ✅ File upload validation (if applicable)
- ✅ Request payload size limits

### Rate Limiting & DDoS Protection
- ✅ Global rate limiting (100 requests per 15 minutes)
- ✅ Auth endpoint stricter limits (5 attempts per 15 minutes)
- ✅ IP + email combination tracking
- ✅ Configurable rate limit windows

### Security Headers (Helmet.js)
- ✅ Content-Security-Policy
- ✅ X-Frame-Options (DENY)
- ✅ X-Content-Type-Options (nosniff)
- ✅ Strict-Transport-Security
- ✅ X-XSS-Protection

### CORS Configuration
- ✅ Restricted to configured origins
- ✅ Credentials allowed for authenticated requests
- ✅ Preflight request handling

### Docker Security
- ✅ Privileged container creation disabled
- ✅ Volume mount path whitelist
- ✅ Resource limits enforced
- ✅ Admin-only access to Docker API
- ✅ Audit logging for all operations

### Logging & Monitoring
- ✅ Morgan HTTP request logging
- ✅ Security event logging
- ✅ Error logging with stack traces
- ✅ Docker operation audit trail

---

## API Contract Changes

### Changed Endpoints:

#### 1. `POST /api/auth/register`
- **Status Code Change:** 400 → 200 (for existing emails)
- **Response Change:** Now returns success even if email exists
- **Behavior:** Still creates user if email is new

#### 2. `POST /api/auth/resend-verification`
- **Status Code Change:** 404 → 200 (for non-existent users)
- **Response Change:** Generic success message
- **Behavior:** Only sends email if user exists

#### 3. `POST /api/auth/login`
- **No API changes** - works exactly the same
- **Internal:** Now performs constant-time operations

#### 4. `PUT /api/users/password`
- **No API changes** - works exactly the same
- **Internal:** Now properly hashes passwords (critical fix)

---

## Testing Your Integration

### Test Rate Limiting:
```bash
#!/bin/bash
# Try 6 login attempts from same IP with different emails
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test${i}@example.com\",\"password\":\"wrong\"}"
  echo ""
done

# Expected: Last attempt should return 429 (Too Many Requests)
```

### Test Generic Messages:
```bash
# Register with existing email
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Test123!","username":"test"}'

# Expected: Generic success message (not "email already registered")
```

### Test Password Change:
```bash
# 1. Login
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"OldPass123!"}' \
  | jq -r '.data.token')

# 2. Change password
curl -X PUT http://localhost:3000/api/users/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword":"OldPass123!","newPassword":"NewPass123!"}'

# 3. Login with new password
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"NewPass123!"}'

# Expected: All should succeed
```

---

## Frontend Update Examples

### React Example:

```javascript
// Before
const handleRegister = async (email, password, username) => {
  const response = await api.post('/auth/register', { email, password, username });

  if (response.data.success === false) {
    if (response.data.message.includes('already registered')) {
      setError('This email is already registered');
    }
  } else {
    setSuccess('Registration successful! Check your email.');
  }
};

// After
const handleRegister = async (email, password, username) => {
  const response = await api.post('/auth/register', { email, password, username });

  // Always show generic success message
  if (response.data.success) {
    setSuccess('Please check your email for verification instructions.');
  } else {
    setError('Registration failed. Please try again.');
  }
};
```

### Vue.js Example:

```javascript
// Before
async resendVerification(email) {
  try {
    const response = await this.$http.post('/auth/resend-verification', { email });
    this.showSuccess('Verification email sent!');
  } catch (error) {
    if (error.response.data.message === 'User not found') {
      this.showError('No account found with this email');
    }
  }
}

// After
async resendVerification(email) {
  try {
    const response = await this.$http.post('/auth/resend-verification', { email });
    // Generic message for security
    this.showSuccess('If an account exists, you will receive a verification email.');
  } catch (error) {
    this.showError('An error occurred. Please try again.');
  }
}
```

---

## Common Questions

**Q: Why are error messages now generic?**
A: Prevents attackers from discovering which emails are registered in the system (email enumeration attack).

**Q: Will rate limiting affect legitimate users?**
A: No - users get 5 login attempts per 15 minutes per IP, which is reasonable. Failed attempts don't count if login succeeds.

**Q: Do I need to reset all user passwords?**
A: Recommended for users who changed passwords before this fix (they may have been stored in plain text).

**Q: What if I forget to set JWT_SECRET in production?**
A: Application will refuse to start with a clear error message. This is intentional to prevent insecure deployments.

**Q: Will these changes break my existing frontend?**
A: Minimal impact - only need to update handling of registration and resend verification responses to use generic messages.

**Q: How do I know if rate limiting is working?**
A: Check logs for "Rate limit exceeded" messages, or test by making 6+ failed login attempts.

---

## Files Modified

1. `/mnt/e/MYCOMPANY/TNam/src/middleware/rateLimiter.js` - Rate limiter bypass fix
2. `/mnt/e/MYCOMPANY/TNam/src/controllers/authController.js` - Email enumeration and timing attack fixes
3. `/mnt/e/MYCOMPANY/TNam/src/config/environment.js` - JWT secret validation
4. `/mnt/e/MYCOMPANY/TNam/src/controllers/userController.js` - Password hashing fix

---

## Need Help?

- **Detailed documentation:** See `SECURITY_FIXES.md`
- **Inline comments:** All security fixes have detailed comments in code
- **Logs:** Check `logs/combined.log` and `logs/error.log`
- **Testing:** Use the test scripts provided above

---

**Last Updated:** 2025-10-14
**Security Version:** 1.0.0
