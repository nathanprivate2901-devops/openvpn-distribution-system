# Utility Functions Documentation

This directory contains core utility functions for the OpenVPN Distribution System.

## Table of Contents

1. [Logger](#logger)
2. [Token Generator](#token-generator)
3. [Email Service](#email-service)

---

## Logger

**File:** `/mnt/e/MYCOMPANY/TNam/src/utils/logger.js`

Winston-based logging utility with file and console transports.

### Features

- **Console Transport**: Colorized output for development (disabled in production)
- **File Transport**:
  - `logs/combined.log` - All logs
  - `logs/error.log` - Error-level logs only
  - `logs/exceptions.log` - Uncaught exceptions
  - `logs/rejections.log` - Unhandled promise rejections
- **Log Rotation**: 10MB max file size, 5 backup files
- **Timestamps**: YYYY-MM-DD HH:mm:ss format
- **Environment-based levels**:
  - Development: `debug`
  - Production: `info`

### Usage

```javascript
const logger = require('./utils/logger');

// Log levels (in order of severity)
logger.error('Critical error occurred', { userId: 123, error: err.message });
logger.warn('Warning message', { details: 'Something unusual' });
logger.info('Information message', { action: 'user_login' });
logger.debug('Debug information', { variable: value });

// For HTTP request logging with Morgan
app.use(morgan('combined', { stream: logger.stream }));
```

### Log Format

```
2025-10-14 15:03:45 [info]: User logged in {"userId":123,"email":"user@example.com"}
```

---

## Token Generator

**File:** `/mnt/e/MYCOMPANY/TNam/src/utils/tokenGenerator.js`

Cryptographically secure token generation using Node.js `crypto` module.

### Functions

#### `generateVerificationToken()`

Generates a secure 64-character hex token for email verification.

```javascript
const { generateVerificationToken } = require('./utils/tokenGenerator');

const token = generateVerificationToken();
// Returns: "a3f7b2c8d9e4f1a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9"
```

#### `generatePasswordResetToken()`

Generates a secure 64-character hex token for password reset.

```javascript
const { generatePasswordResetToken } = require('./utils/tokenGenerator');

const resetToken = generatePasswordResetToken();
```

#### `generateApiKey(length)`

Generates a secure API key with customizable length.

```javascript
const { generateApiKey } = require('./utils/tokenGenerator');

const apiKey = generateApiKey(48); // 96-character hex string (default: 48 bytes)
const shortKey = generateApiKey(16); // 32-character hex string
```

#### `generateRandomToken(length)`

Generates a secure random token for general purposes.

```javascript
const { generateRandomToken } = require('./utils/tokenGenerator');

const sessionId = generateRandomToken(16); // 32-character hex string (default)
const shortCode = generateRandomToken(8); // 16-character hex string
```

### Security Notes

- Uses `crypto.randomBytes()` for cryptographically secure random generation
- All functions throw errors if token generation fails
- Errors are automatically logged via Winston logger

---

## Email Service

**File:** `/mnt/e/MYCOMPANY/TNam/src/utils/emailService.js`

Nodemailer-based email service with professional HTML templates.

### Configuration

Required environment variables in `.env`:

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=noreply@example.com
SMTP_SECURE=false
SMTP_REJECT_UNAUTHORIZED=true

APP_NAME=OpenVPN Distribution System
APP_URL=http://localhost:3000
```

### Functions

#### `sendVerificationEmail(email, token)`

Sends email verification link to new users.

```javascript
const { sendVerificationEmail } = require('./utils/emailService');

const success = await sendVerificationEmail('user@example.com', verificationToken);

if (success) {
  console.log('Verification email sent');
} else {
  console.log('Failed to send email');
}
```

**Email Template:**
- Green-themed welcome email
- Clickable verification button
- Text link fallback
- 24-hour expiration notice

---

#### `sendConfigGeneratedEmail(email, configName)`

Notifies user when OpenVPN configuration is ready.

```javascript
const { sendConfigGeneratedEmail } = require('./utils/emailService');

await sendConfigGeneratedEmail('user@example.com', 'user_vpn_config.ovpn');
```

**Email Template:**
- Blue-themed notification
- Configuration name display
- Dashboard link button
- Setup instructions

---

#### `sendPasswordChangedEmail(email)`

Security notification when password is changed.

```javascript
const { sendPasswordChangedEmail } = require('./utils/emailService');

await sendPasswordChangedEmail('user@example.com');
```

**Email Template:**
- Orange-themed security alert
- Timestamp of change
- Warning if unauthorized
- Support contact link

---

#### `sendPasswordResetEmail(email, token)`

Sends password reset link.

```javascript
const { sendPasswordResetEmail } = require('./utils/emailService');

await sendPasswordResetEmail('user@example.com', resetToken);
```

**Email Template:**
- Red-themed urgent notification
- Password reset button
- Text link fallback
- 1-hour expiration notice

---

#### `sendTestEmail(email)`

Tests email configuration.

```javascript
const { sendTestEmail } = require('./utils/emailService');

const success = await sendTestEmail('admin@example.com');

if (success) {
  console.log('SMTP configuration is working correctly');
} else {
  console.log('SMTP configuration failed');
}
```

---

### Email Template Features

All emails include:
- **Responsive HTML Design**: Mobile-friendly layouts
- **Plain Text Fallback**: For clients that don't support HTML
- **Professional Styling**: Consistent brand colors and typography
- **Accessibility**: Proper semantic HTML structure
- **Security Best Practices**: No embedded scripts or external resources

### Error Handling

All email functions:
- Return `true` on success, `false` on failure
- Never throw errors (fail gracefully)
- Log all errors via Winston logger
- Continue application flow if SMTP is not configured

### SMTP Provider Examples

#### Gmail

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Generate at: myaccount.google.com/apppasswords
```

#### SendGrid

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

#### Mailgun

```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASSWORD=your-mailgun-smtp-password
```

#### AWS SES

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
```

---

## Usage Examples

### Complete Authentication Flow

```javascript
const logger = require('./utils/logger');
const { generateVerificationToken } = require('./utils/tokenGenerator');
const { sendVerificationEmail } = require('./utils/emailService');

// User registration
async function registerUser(email, password) {
  try {
    // 1. Generate verification token
    const token = generateVerificationToken();

    // 2. Save user and token to database
    await saveUser({ email, password, verificationToken: token });

    // 3. Send verification email
    const emailSent = await sendVerificationEmail(email, token);

    if (emailSent) {
      logger.info('User registered successfully', { email });
      return { success: true, message: 'Verification email sent' };
    } else {
      logger.warn('User registered but email failed', { email });
      return { success: true, message: 'Registration complete, email pending' };
    }
  } catch (error) {
    logger.error('Registration failed', { email, error: error.message });
    throw error;
  }
}
```

### Password Reset Flow

```javascript
const { generatePasswordResetToken } = require('./utils/tokenGenerator');
const { sendPasswordResetEmail, sendPasswordChangedEmail } = require('./utils/emailService');

// Request password reset
async function requestPasswordReset(email) {
  const token = generatePasswordResetToken();

  // Save token with expiration (1 hour)
  await saveResetToken(email, token, Date.now() + 3600000);

  await sendPasswordResetEmail(email, token);
}

// Complete password reset
async function resetPassword(token, newPassword) {
  const user = await validateResetToken(token);

  if (user) {
    await updatePassword(user.id, newPassword);
    await sendPasswordChangedEmail(user.email);
    return true;
  }

  return false;
}
```

### OpenVPN Config Generation

```javascript
const { sendConfigGeneratedEmail } = require('./utils/emailService');
const logger = require('./utils/logger');

async function generateConfig(userId, email) {
  try {
    // Generate OpenVPN configuration
    const configName = `user_${userId}_vpn.ovpn`;
    const config = await createOpenVPNConfig(userId);

    // Save to database
    await saveConfig(userId, configName, config);

    // Notify user
    await sendConfigGeneratedEmail(email, configName);

    logger.info('Config generated', { userId, configName });

    return { success: true, configName };
  } catch (error) {
    logger.error('Config generation failed', { userId, error: error.message });
    throw error;
  }
}
```

---

## Testing Utilities

### Test Logger

```javascript
const logger = require('./src/utils/logger');

logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', { stack: 'error stack trace' });

// Check logs directory
// tail -f logs/combined.log
// tail -f logs/error.log
```

### Test Token Generator

```javascript
const tokens = require('./src/utils/tokenGenerator');

console.log('Verification Token:', tokens.generateVerificationToken());
console.log('Reset Token:', tokens.generatePasswordResetToken());
console.log('API Key:', tokens.generateApiKey());
console.log('Random Token:', tokens.generateRandomToken(8));
```

### Test Email Service

```javascript
const { sendTestEmail } = require('./src/utils/emailService');

// Test your SMTP configuration
(async () => {
  const success = await sendTestEmail('your-email@example.com');
  console.log('Email test:', success ? 'PASSED' : 'FAILED');
})();
```

---

## Directory Structure

```
src/
└── utils/
    ├── README.md              # This file
    ├── logger.js              # Winston logging utility
    ├── tokenGenerator.js      # Secure token generation
    └── emailService.js        # Email service with templates

logs/                          # Created automatically
├── combined.log              # All logs
├── error.log                 # Error logs only
├── exceptions.log            # Uncaught exceptions
└── rejections.log            # Unhandled promise rejections
```

---

## Performance Considerations

### Logger
- **File I/O**: Asynchronous write operations
- **Log Rotation**: Automatic cleanup prevents disk space issues
- **Production Mode**: Console transport disabled for better performance

### Token Generator
- **Speed**: Generates 32-byte tokens in < 1ms
- **Security**: Cryptographically secure randomness
- **No External Dependencies**: Uses native `crypto` module

### Email Service
- **Lazy Initialization**: Transporter created only when needed
- **Connection Pooling**: Reuses SMTP connections
- **Graceful Degradation**: Application continues if email fails
- **Async Operations**: Non-blocking email sending

---

## Security Best Practices

1. **Token Storage**: Always hash tokens before storing in database
2. **Token Expiration**: Implement time-based expiration for all tokens
3. **SMTP Credentials**: Never commit `.env` file to version control
4. **TLS/SSL**: Use secure SMTP connections in production
5. **Rate Limiting**: Limit email sending to prevent abuse
6. **Email Validation**: Validate email addresses before sending
7. **Error Messages**: Don't expose internal details in error messages
8. **Logging**: Never log sensitive data (passwords, tokens, etc.)

---

## Troubleshooting

### Logger Issues

**Problem**: Logs not appearing
```bash
# Check directory permissions
ls -la logs/

# Create logs directory if missing
mkdir -p logs
```

**Problem**: Log files growing too large
```bash
# Winston automatically rotates logs, but you can manually clean:
rm logs/*.log
```

### Token Generator Issues

**Problem**: Tokens not random enough
- Ensure Node.js version >= 18
- Check `crypto` module is available: `node -e "console.log(require('crypto').randomBytes)"`

### Email Service Issues

**Problem**: Emails not sending
```bash
# 1. Check environment variables
echo $SMTP_HOST
echo $SMTP_USER

# 2. Test SMTP connection manually
telnet smtp.example.com 587

# 3. Check application logs
tail -f logs/combined.log | grep -i email
```

**Problem**: Gmail authentication failed
- Enable "Less secure app access" OR
- Generate App Password at: https://myaccount.google.com/apppasswords
- Enable 2FA first if using App Passwords

**Problem**: Emails going to spam
- Configure SPF, DKIM, and DMARC records for your domain
- Use a verified sender address
- Avoid spam trigger words in subject lines
- Ensure valid HTML structure in templates

---

## Maintenance

### Log Cleanup

```bash
# Clean old logs (older than 7 days)
find logs/ -name "*.log" -mtime +7 -delete

# Archive logs
tar -czf logs-$(date +%Y%m%d).tar.gz logs/*.log
```

### Dependency Updates

```bash
# Check for updates
npm outdated winston nodemailer

# Update dependencies
npm update winston nodemailer
```

---

## Contributing

When modifying utilities:

1. **Maintain Backward Compatibility**: Don't break existing function signatures
2. **Add Tests**: Include unit tests for new functionality
3. **Update Documentation**: Keep this README in sync with code changes
4. **Follow Conventions**: Use existing code style and patterns
5. **Log Everything**: Add appropriate logging for debugging

---

## License

Part of the OpenVPN Distribution System.
