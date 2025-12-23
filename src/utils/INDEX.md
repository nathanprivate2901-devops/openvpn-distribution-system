# Utility Functions - Complete Index

## Quick Navigation

| File | Purpose | Size | Lines |
|------|---------|------|-------|
| [logger.js](#loggerjs) | Winston logging utility | 2.3K | 89 |
| [tokenGenerator.js](#tokengeneratorjs) | Secure token generation | 2.4K | 96 |
| [emailService.js](#emailservicejs) | Email service with templates | 19K | 541 |
| [test-utils.js](#test-utilsjs) | Test suite for utilities | 8.8K | 249 |
| [README.md](#readmemd) | Full documentation | 14K | 600+ |
| [QUICK_REFERENCE.md](#quick_referencemd) | Developer quick reference | 5.6K | 250+ |
| [DEPENDENCIES.md](#dependenciesmd) | Dependency guide | 6.2K | 300+ |
| [INTEGRATION_EXAMPLE.js](#integration_examplejs) | Integration examples | 11K | 400+ |

---

## logger.js

**Purpose:** Professional logging with Winston

**Key Features:**
- Console and file transports
- Environment-based log levels
- Automatic log rotation
- Exception/rejection handling

**Usage:**
```javascript
const logger = require('./utils/logger');
logger.info('Message', { context });
```

**Log Files:**
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Promise rejections

---

## tokenGenerator.js

**Purpose:** Cryptographically secure token generation

**Functions:**
- `generateVerificationToken()` - Email verification (64 chars)
- `generatePasswordResetToken()` - Password reset (64 chars)
- `generateApiKey(length)` - API keys (customizable)
- `generateRandomToken(length)` - General purpose (customizable)

**Usage:**
```javascript
const { generateVerificationToken } = require('./utils/tokenGenerator');
const token = generateVerificationToken();
```

**Security:** Uses Node.js crypto.randomBytes()

---

## emailService.js

**Purpose:** Email sending with professional HTML templates

**Functions:**
- `sendVerificationEmail(email, token)` - Account verification
- `sendConfigGeneratedEmail(email, configName)` - Config ready
- `sendPasswordChangedEmail(email)` - Password changed alert
- `sendPasswordResetEmail(email, token)` - Password reset
- `sendTestEmail(email)` - Configuration test

**Usage:**
```javascript
const { sendVerificationEmail } = require('./utils/emailService');
await sendVerificationEmail('user@example.com', token);
```

**Requirements:** SMTP configuration in .env

---

## test-utils.js

**Purpose:** Test suite for all utilities

**Features:**
- Tests logger functionality
- Tests token generation
- Tests email service
- Colorized terminal output
- Detailed error reporting

**Usage:**
```bash
# Basic tests
node src/utils/test-utils.js

# With email testing
node src/utils/test-utils.js your-email@example.com
```

---

## README.md

**Purpose:** Complete documentation

**Contents:**
- API reference for all utilities
- Configuration instructions
- Usage examples
- SMTP provider examples
- Troubleshooting guide
- Security best practices
- Performance considerations

**Sections:**
1. Logger documentation
2. Token Generator documentation
3. Email Service documentation
4. Testing utilities
5. Troubleshooting
6. Security notes

---

## QUICK_REFERENCE.md

**Purpose:** Developer quick reference card

**Contents:**
- Quick syntax examples
- Common patterns
- Environment variables
- Testing commands
- Error handling

**Best for:** Quick lookups during development

---

## DEPENDENCIES.md

**Purpose:** Dependency management guide

**Contents:**
- Required npm packages
- Installation commands
- Version compatibility
- Package.json examples
- Docker configuration
- Troubleshooting

**Required packages:**
- winston (^3.11.0)
- nodemailer (^6.9.0)
- dotenv (^16.3.0)

---

## INTEGRATION_EXAMPLE.js

**Purpose:** Real-world integration examples

**Examples:**
1. User registration flow
2. Email verification flow
3. Password reset flow
4. VPN config generation
5. Password change flow
6. Express route integration
7. Error handling patterns
8. Logging best practices

**Best for:** Copy-paste integration code

---

## File Relationships

```
┌─────────────────────────────────────────────────┐
│                  Your Application                │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────┐
        │                     │          │
        ▼                     ▼          ▼
┌──────────────┐    ┌──────────────┐   ┌──────────────┐
│  logger.js   │    │tokenGen.js   │   │emailService  │
│              │◄───┤              │   │              │
│  Winston     │    │  crypto      │◄──┤  Nodemailer  │
│  Logging     │    │  randomBytes │   │  SMTP        │
└──────────────┘    └──────────────┘   └──────────────┘
        │                                       │
        ▼                                       ▼
┌──────────────┐                       ┌──────────────┐
│logs/         │                       │  SMTP Server │
│combined.log  │                       │  (External)  │
│error.log     │                       └──────────────┘
└──────────────┘
```

---

## Environment Variables

All utilities use these environment variables:

```bash
# Logger
NODE_ENV=production|development

# Email Service
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=username
SMTP_PASSWORD=password
SMTP_FROM=noreply@example.com
SMTP_SECURE=false
APP_NAME=OpenVPN Distribution System
APP_URL=http://localhost:3000
```

---

## Common Workflows

### User Registration
1. Generate token → `tokenGenerator.js`
2. Save to database
3. Send email → `emailService.js`
4. Log action → `logger.js`

### Password Reset
1. Generate reset token → `tokenGenerator.js`
2. Save to database with expiration
3. Send reset email → `emailService.js`
4. Log action → `logger.js`

### VPN Config Generation
1. Generate config content
2. Save to database
3. Send notification → `emailService.js`
4. Log action → `logger.js`

---

## Testing Workflow

```bash
# 1. Install dependencies
npm install winston nodemailer dotenv

# 2. Configure environment
cp .env.example .env
# Edit .env with your SMTP settings

# 3. Run tests
node src/utils/test-utils.js

# 4. Test email (optional)
node src/utils/test-utils.js your-email@example.com

# 5. Monitor logs
tail -f logs/combined.log
```

---

## Development Tips

1. **Start with logger:**
   - Import in main app file
   - Replace all console.log with logger
   - Check logs directory

2. **Test email service:**
   - Use sendTestEmail() first
   - Verify SMTP credentials
   - Check spam folder

3. **Secure token generation:**
   - Always hash tokens before DB storage
   - Set appropriate expiration times
   - Never log actual token values

4. **Error handling:**
   - Wrap in try/catch
   - Log errors with context
   - Return user-friendly messages

---

## Production Checklist

- [ ] Environment variables configured
- [ ] SMTP credentials verified
- [ ] NODE_ENV=production set
- [ ] Log rotation configured
- [ ] Error monitoring in place
- [ ] Email templates tested
- [ ] Token expiration times set
- [ ] Security audit completed
- [ ] Rate limiting implemented
- [ ] Backup logs configured

---

## Support Resources

- **Full Documentation:** [README.md](./README.md)
- **Quick Reference:** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Dependencies:** [DEPENDENCIES.md](./DEPENDENCIES.md)
- **Examples:** [INTEGRATION_EXAMPLE.js](./INTEGRATION_EXAMPLE.js)
- **Test Suite:** [test-utils.js](./test-utils.js)

---

## Version Information

- **Created:** 2025-10-14
- **Node.js:** 18.0.0+
- **Winston:** 3.11.0+
- **Nodemailer:** 6.9.0+
- **Status:** Production Ready

---

## Quick Commands

```bash
# Test utilities
node src/utils/test-utils.js

# View logs
tail -f logs/combined.log
tail -f logs/error.log

# Clean logs
rm logs/*.log

# Check dependencies
npm list winston nodemailer

# Update dependencies
npm update winston nodemailer
```

---

*Last Updated: 2025-10-14*
*Part of OpenVPN Distribution System*
