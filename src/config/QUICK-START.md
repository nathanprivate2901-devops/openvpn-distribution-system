# Configuration Quick Start Guide

This guide will help you quickly set up and use the configuration modules.

## Setup (First Time)

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Edit .env File
Open `.env` and update these critical values:

```bash
# Required: Generate strong JWT secret
JWT_SECRET=run_this_command_openssl_rand_base64_64

# Required: Database credentials
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_actual_password
DB_NAME=openvpn_system

# Required: Email credentials
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_email_password
```

### 3. Generate JWT Secret
```bash
# Run this command to generate a secure JWT secret
openssl rand -base64 64
# Copy the output to JWT_SECRET in .env
```

### 4. Test Configuration
```bash
node src/config/test-config.js
```

## Usage Examples

### Using Environment Config

```javascript
// Import configuration
const config = require('./config/environment');

// Access configuration values
console.log(config.port);                    // 3000
console.log(config.nodeEnv);                 // 'development'
console.log(config.database.host);           // 'localhost'
console.log(config.smtp.host);               // 'smtp.gmail.com'
console.log(config.openvpn.server);          // '10.8.0.0'
console.log(config.rateLimit.maxRequests);   // 100

// Environment helpers
if (config.isProduction()) {
  // Production-only code
}

if (config.isDevelopment()) {
  // Development-only code
}
```

### Using Database Pool

#### Method 1: Direct Pool Usage (Backward Compatible)
```javascript
const pool = require('./config/database');

// Execute query
const [rows] = await pool.execute(
  'SELECT * FROM users WHERE email = ?',
  [email]
);

console.log(rows);
```

#### Method 2: Using Query Helper (Recommended)
```javascript
const { query } = require('./config/database');

// Simple query
const users = await query('SELECT * FROM users');

// Parameterized query
const user = await query(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);
```

#### Method 3: Using Transactions
```javascript
const { transaction } = require('./config/database');

await transaction(async (connection) => {
  // All queries in this block are part of the transaction
  await connection.execute(
    'INSERT INTO users (email, password) VALUES (?, ?)',
    [email, hashedPassword]
  );

  await connection.execute(
    'INSERT INTO profiles (user_id, name) VALUES (?, ?)',
    [userId, name]
  );

  // If any query fails, entire transaction is rolled back
});
```

### Health Checks

```javascript
const { testConnection, getPoolStats } = require('./config/database');

// Test database connection
try {
  await testConnection();
  console.log('Database is healthy');
} catch (error) {
  console.error('Database is down:', error.message);
}

// Get pool statistics
const stats = getPoolStats();
console.log(`Active connections: ${stats.activeConnections}`);
console.log(`Idle connections: ${stats.idleConnections}`);
```

## Common Patterns

### Express.js Route Handler
```javascript
const { query } = require('./config/database');
const config = require('./config/environment');

app.get('/api/users/:id', async (req, res) => {
  try {
    const users = await query(
      'SELECT id, email, created_at FROM users WHERE id = ?',
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Express.js Health Check Endpoint
```javascript
const { testConnection, getPoolStats } = require('./config/database');
const config = require('./config/environment');

app.get('/health', async (req, res) => {
  try {
    await testConnection();
    const stats = getPoolStats();

    res.json({
      status: 'healthy',
      environment: config.nodeEnv,
      database: {
        connected: true,
        activeConnections: stats.activeConnections,
        idleConnections: stats.idleConnections
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

### User Registration with Transaction
```javascript
const { transaction } = require('./config/database');
const bcrypt = require('bcrypt');

async function registerUser(email, password, name) {
  const hashedPassword = await bcrypt.hash(password, 10);

  return await transaction(async (connection) => {
    // Insert user
    const [userResult] = await connection.execute(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, hashedPassword]
    );

    const userId = userResult.insertId;

    // Insert profile
    await connection.execute(
      'INSERT INTO profiles (user_id, name) VALUES (?, ?)',
      [userId, name]
    );

    return userId;
  });
}
```

## Troubleshooting

### Issue: Environment Variables Not Loading

**Symptom:** Configuration shows defaults instead of your values

**Solution:**
1. Ensure `.env` file exists in project root
2. Check file is named exactly `.env` (not `.env.txt`)
3. Restart your application
4. Check for syntax errors in `.env` file (no quotes needed)

### Issue: Database Connection Failed

**Symptom:** "Database connection test failed"

**Solution:**
1. Check MySQL is running: `mysql -u root -p`
2. Verify credentials in `.env` are correct
3. Ensure database exists: `CREATE DATABASE openvpn_system;`
4. Check firewall isn't blocking port 3306
5. Try connecting with mysql CLI to verify credentials

### Issue: JWT Secret Warning

**Symptom:** "JWT_SECRET should be at least 32 characters"

**Solution:**
```bash
# Generate a strong secret
openssl rand -base64 64

# Copy output to .env
JWT_SECRET=paste_generated_secret_here
```

### Issue: SMTP Connection Failed

**Symptom:** Email sending fails

**Solution:**
1. Verify SMTP credentials
2. For Gmail: Enable "App Passwords" if using 2FA
3. Check SMTP port (usually 587 for TLS, 465 for SSL)
4. Test with a different SMTP provider
5. Check firewall isn't blocking SMTP ports

## Environment Variables Cheat Sheet

### Must Configure
- `JWT_SECRET` - JWT signing secret (min 32 chars)
- `DB_PASSWORD` - Database password
- `SMTP_HOST` - Email server
- `SMTP_USER` - Email username
- `SMTP_PASSWORD` - Email password

### Important to Configure
- `NODE_ENV` - Set to 'production' in production
- `PORT` - Server port (default: 3000)
- `DB_NAME` - Database name
- `OPENVPN_SERVER` - VPN server address

### Optional (Has Defaults)
- `DB_CONNECTION_LIMIT` - Max connections (default: 10)
- `RATE_LIMIT_MAX_REQUESTS` - Rate limit (default: 100)
- `JWT_EXPIRES_IN` - Token expiry (default: 24h)
- `BCRYPT_SALT_ROUNDS` - bcrypt rounds (default: 10)

## Best Practices

1. **Never commit `.env` file**
   - Always in `.gitignore`
   - Use `.env.example` for documentation

2. **Use strong secrets in production**
   - JWT_SECRET: min 32 characters
   - Database passwords: strong passwords
   - Generate with: `openssl rand -base64 64`

3. **Environment-specific settings**
   - Development: relaxed validation
   - Production: strict validation
   - Set `NODE_ENV=production` in production

4. **Connection pooling**
   - Default 10 connections is usually enough
   - Increase for high-traffic applications
   - Monitor with `getPoolStats()`

5. **Error handling**
   - Always use try-catch with database queries
   - Check connection health regularly
   - Implement proper logging

6. **Security**
   - Use parameterized queries (already implemented)
   - Validate input before database queries
   - Keep dependencies updated
   - Use HTTPS in production

## Need Help?

1. Check `README.md` for detailed documentation
2. Run test script: `node src/config/test-config.js`
3. Check logs for error details
4. Verify `.env` file configuration
5. Test database connection manually

## Next Steps

After configuration is working:
1. Set up database schema: `mysql -u root -p < database-setup.sql`
2. Create models in `src/models/`
3. Create controllers in `src/controllers/`
4. Create routes in `src/routes/`
5. Start building your application!
