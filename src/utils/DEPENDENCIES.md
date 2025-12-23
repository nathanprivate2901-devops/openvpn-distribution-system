# Utility Functions - Required Dependencies

## NPM Packages

The utility functions require the following npm packages:

### Winston (Logger)

```bash
npm install winston
```

**Version:** `^3.11.0` or later

**Purpose:** Professional logging with file transports, log rotation, and multiple log levels.

**Documentation:** https://github.com/winstonjs/winston

### Nodemailer (Email Service)

```bash
npm install nodemailer
```

**Version:** `^6.9.0` or later

**Purpose:** Email sending with SMTP support and HTML templates.

**Documentation:** https://nodemailer.com/

### Crypto (Token Generator)

**Built-in Node.js module** - No installation required

**Purpose:** Cryptographically secure random number generation.

### Dotenv (Environment Variables)

```bash
npm install dotenv
```

**Version:** `^16.3.0` or later

**Purpose:** Load environment variables from `.env` file.

**Documentation:** https://github.com/motdotla/dotenv

---

## Installation Commands

### Install all dependencies at once:

```bash
npm install winston nodemailer dotenv
```

### Development dependencies (optional):

```bash
npm install --save-dev @types/node @types/nodemailer
```

---

## Package.json Example

Add these to your `package.json`:

```json
{
  "name": "openvpn-distribution-system",
  "version": "1.0.0",
  "description": "OpenVPN Configuration Distribution System",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test:utils": "node src/utils/test-utils.js",
    "logs": "tail -f logs/combined.log"
  },
  "dependencies": {
    "winston": "^3.11.0",
    "nodemailer": "^6.9.0",
    "dotenv": "^16.3.0",
    "express": "^4.18.2",
    "mysql2": "^3.6.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "@types/node": "^20.10.0",
    "@types/nodemailer": "^6.4.14"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

---

## Verify Installation

After installing, verify the packages are available:

```bash
# Check winston
node -e "console.log(require('winston').version)"

# Check nodemailer
node -e "console.log(require('nodemailer').createTransport ? 'OK' : 'FAIL')"

# Check crypto (built-in)
node -e "console.log(require('crypto').randomBytes ? 'OK' : 'FAIL')"

# Check dotenv
node -e "require('dotenv').config(); console.log('OK')"
```

---

## Quick Start

1. **Install dependencies:**

```bash
npm install
```

2. **Copy environment template:**

```bash
cp .env.example .env
```

3. **Update .env with your values:**

```bash
# Edit .env file
nano .env
# or
vim .env
```

4. **Test utilities:**

```bash
# Test all utilities (basic tests)
node src/utils/test-utils.js

# Test with email sending
node src/utils/test-utils.js your-email@example.com
```

5. **Check logs:**

```bash
# View all logs
tail -f logs/combined.log

# View errors only
tail -f logs/error.log
```

---

## Version Compatibility

### Node.js

- **Minimum:** Node.js 18.0.0
- **Recommended:** Node.js 20.x LTS
- **Maximum tested:** Node.js 21.x

### npm

- **Minimum:** npm 9.0.0
- **Recommended:** npm 10.x

---

## Optional Dependencies

### For Development

```bash
# Hot reload during development
npm install --save-dev nodemon

# TypeScript support
npm install --save-dev typescript @types/node @types/express @types/nodemailer

# Linting
npm install --save-dev eslint prettier

# Testing
npm install --save-dev jest supertest
```

---

## Production Considerations

### 1. Install only production dependencies:

```bash
npm install --production
```

### 2. Lock dependency versions:

```bash
npm ci  # Use this in production instead of npm install
```

### 3. Security audit:

```bash
npm audit
npm audit fix
```

### 4. Keep dependencies updated:

```bash
npm outdated
npm update
```

---

## Common Issues

### Issue: Winston not creating log files

**Solution:**

```bash
# Create logs directory with correct permissions
mkdir -p logs
chmod 755 logs
```

### Issue: Nodemailer SMTP authentication failed

**Solutions:**

- Check SMTP credentials in `.env`
- For Gmail: Enable "App Passwords" (requires 2FA)
- Check firewall isn't blocking SMTP port
- Try different SMTP port (587 or 465)

### Issue: Module not found errors

**Solution:**

```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue: Permission denied errors

**Solution:**

```bash
# Fix npm permissions (Linux/Mac)
sudo chown -R $(whoami) ~/.npm
```

---

## Containerized Deployment

### Dockerfile snippet for utilities:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy utility files
COPY src/utils ./src/utils
COPY .env.example ./.env.example

# Create logs directory
RUN mkdir -p logs && chmod 755 logs

# Test utilities during build
RUN node src/utils/test-utils.js || true

CMD ["node", "src/index.js"]
```

### Docker Compose environment:

```yaml
services:
  backend:
    build: .
    environment:
      - NODE_ENV=production
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASSWORD=${SMTP_PASSWORD}
    volumes:
      - ./logs:/app/logs
```

---

## Troubleshooting Dependencies

### Check installed versions:

```bash
npm list winston nodemailer dotenv
```

### Update specific package:

```bash
npm update winston
npm update nodemailer
```

### Reinstall specific package:

```bash
npm uninstall winston
npm install winston
```

### Check for security vulnerabilities:

```bash
npm audit
npm audit fix --force  # Use with caution
```

---

## Links

- **Winston:** https://www.npmjs.com/package/winston
- **Nodemailer:** https://www.npmjs.com/package/nodemailer
- **Dotenv:** https://www.npmjs.com/package/dotenv
- **Node.js Crypto:** https://nodejs.org/api/crypto.html

---

## Support

If you encounter dependency issues:

1. Check the GitHub issues for the specific package
2. Verify your Node.js version: `node --version`
3. Clear npm cache: `npm cache clean --force`
4. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
5. Check logs: `tail -f logs/error.log`
