# Utility Functions - Quick Reference

## Logger

```javascript
const logger = require('./utils/logger');

logger.error('Error message', { context: 'data' });
logger.warn('Warning message');
logger.info('Info message');
logger.debug('Debug message');
```

**Log Files:**
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only

---

## Token Generator

```javascript
const {
  generateVerificationToken,
  generatePasswordResetToken,
  generateApiKey,
  generateRandomToken
} = require('./utils/tokenGenerator');

// Email verification (64 chars)
const verifyToken = generateVerificationToken();

// Password reset (64 chars)
const resetToken = generatePasswordResetToken();

// API key (96 chars default, customizable)
const apiKey = generateApiKey(48);

// Random token (32 chars default, customizable)
const randomToken = generateRandomToken(16);
```

---

## Email Service

```javascript
const {
  sendVerificationEmail,
  sendConfigGeneratedEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendTestEmail
} = require('./utils/emailService');

// All functions return Promise<boolean>

// Send verification email
await sendVerificationEmail('user@example.com', token);

// Send config ready notification
await sendConfigGeneratedEmail('user@example.com', 'config.ovpn');

// Send password changed notification
await sendPasswordChangedEmail('user@example.com');

// Send password reset email
await sendPasswordResetEmail('user@example.com', resetToken);

// Test SMTP configuration
await sendTestEmail('admin@example.com');
```

---

## Environment Variables

```bash
# Logger (optional)
NODE_ENV=production           # production | development

# Email Service (required)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=username
SMTP_PASSWORD=password
SMTP_FROM=noreply@example.com
SMTP_SECURE=false            # true for port 465
SMTP_REJECT_UNAUTHORIZED=true

# Application (optional)
APP_NAME=OpenVPN Distribution System
APP_URL=http://localhost:3000
```

---

## Testing

```bash
# Test all utilities
node src/utils/test-utils.js

# Test with email sending
node src/utils/test-utils.js your-email@example.com

# View logs
tail -f logs/combined.log
tail -f logs/error.log
```

---

## Common Patterns

### User Registration Flow

```javascript
const logger = require('./utils/logger');
const { generateVerificationToken } = require('./utils/tokenGenerator');
const { sendVerificationEmail } = require('./utils/emailService');

async function registerUser(email, password) {
  const token = generateVerificationToken();

  // Save to database
  await db.users.create({ email, password, verificationToken: token });

  // Send email (non-blocking)
  const sent = await sendVerificationEmail(email, token);

  if (sent) {
    logger.info('User registered', { email });
  } else {
    logger.warn('User registered but email failed', { email });
  }

  return { success: true };
}
```

### Password Reset Flow

```javascript
const { generatePasswordResetToken } = require('./utils/tokenGenerator');
const { sendPasswordResetEmail } = require('./utils/emailService');

async function requestReset(email) {
  const token = generatePasswordResetToken();
  const expires = Date.now() + 3600000; // 1 hour

  await db.resetTokens.create({ email, token, expires });
  await sendPasswordResetEmail(email, token);

  return { success: true };
}
```

### Config Generation Flow

```javascript
const { sendConfigGeneratedEmail } = require('./utils/emailService');
const logger = require('./utils/logger');

async function generateConfig(userId, email) {
  const configName = `user_${userId}_vpn.ovpn`;
  const config = createVPNConfig(userId);

  await db.configs.create({ userId, name: configName, content: config });
  await sendConfigGeneratedEmail(email, configName);

  logger.info('Config generated', { userId, configName });

  return { configName };
}
```

---

## Error Handling

All utilities handle errors gracefully:

- **Logger**: Writes to stderr if file writes fail
- **Token Generator**: Throws on crypto failure (rare)
- **Email Service**: Returns `false` on failure, never throws

```javascript
// Token Generator - wrap in try/catch
try {
  const token = generateVerificationToken();
} catch (error) {
  logger.error('Token generation failed', { error: error.message });
  // Handle error
}

// Email Service - check return value
const sent = await sendVerificationEmail(email, token);
if (!sent) {
  logger.warn('Email not sent', { email });
  // Continue anyway or retry
}
```

---

## Performance Notes

- **Logger**: Async writes, non-blocking
- **Token Generator**: < 1ms per token
- **Email Service**: 100-500ms per email (network dependent)

---

## Security Reminders

1. Never log sensitive data (passwords, tokens)
2. Always hash tokens before storing in database
3. Use environment variables for SMTP credentials
4. Implement rate limiting on email endpoints
5. Set token expiration times appropriately
6. Use SMTP_SECURE=true in production

---

## Troubleshooting

### Logs not appearing
```bash
mkdir -p logs
chmod 755 logs
```

### Email not sending
```bash
# Check environment variables
echo $SMTP_HOST

# Test SMTP connection
telnet $SMTP_HOST $SMTP_PORT

# Check logs
tail -f logs/error.log | grep -i email
```

### Gmail issues
- Enable "App Passwords" at: https://myaccount.google.com/apppasswords
- Enable 2FA first
- Use app password instead of regular password

---

## Quick Links

- Full Documentation: [`/src/utils/README.md`](/mnt/e/MYCOMPANY/TNam/src/utils/README.md)
- Test Script: [`/src/utils/test-utils.js`](/mnt/e/MYCOMPANY/TNam/src/utils/test-utils.js)
- Environment Template: [`/.env.example`](/mnt/e/MYCOMPANY/TNam/.env.example)
