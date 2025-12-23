# Configuration Modules

This directory contains the core configuration modules for the OpenVPN Distribution System.

## Files

### environment.js
Centralizes all environment variable management with validation and defaults.

**Key Features:**
- Loads environment variables from `.env` file using dotenv
- Provides defaults for all configuration values
- Validates required variables (especially in production)
- Exports helper functions for environment detection

**Configuration Sections:**
- Server configuration (PORT, NODE_ENV)
- JWT configuration (JWT_SECRET, JWT_EXPIRES_IN)
- Database configuration (MySQL connection settings)
- SMTP configuration (email service settings)
- OpenVPN configuration (server, port, protocol)
- Rate limiting configuration
- Application URLs
- Additional settings (bcrypt, logging, CORS)

**Usage:**
```javascript
const config = require('./config/environment');

console.log(config.port); // 3000
console.log(config.database.host); // localhost
console.log(config.smtp.host); // smtp.gmail.com

// Environment helpers
if (config.isProduction()) {
  // Production-specific logic
}
```

**Validation:**
The module automatically validates configuration on load:
- Checks for required variables (JWT_SECRET, DB_*, SMTP_*)
- Validates JWT_SECRET strength in production (min 32 chars)
- Validates numeric ranges (ports, connection limits)
- Exits process in production if validation fails

### database.js
Creates and manages MySQL connection pool using mysql2/promise.

**Key Features:**
- Connection pooling with configurable limits (default: 10 connections)
- Automatic connection management and error handling
- Connection health checks and monitoring
- Transaction support with automatic rollback
- Graceful shutdown on process termination
- Pool statistics for monitoring

**Configuration:**
Imports all database settings from `environment.js`:
- Connection limit: 10 connections
- Wait for connections: true
- Queue limit: unlimited (0)
- Keep-alive: enabled
- Connection timeout: 10 seconds
- Query timeout: 60 seconds
- Charset: utf8mb4
- Timezone: UTC

**Usage:**

Basic query:
```javascript
const pool = require('./config/database');

// Using pool directly
const [rows] = await pool.execute(
  'SELECT * FROM users WHERE email = ?',
  [email]
);

// Using query helper
const { query } = require('./config/database');
const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
```

Transaction:
```javascript
const { transaction } = require('./config/database');

await transaction(async (connection) => {
  await connection.execute(
    'INSERT INTO users (email, password) VALUES (?, ?)',
    [email, hashedPassword]
  );

  await connection.execute(
    'INSERT INTO profiles (user_id, name) VALUES (?, ?)',
    [userId, name]
  );
});
```

Health check:
```javascript
const { testConnection } = require('./config/database');

try {
  await testConnection();
  console.log('Database is healthy');
} catch (error) {
  console.error('Database health check failed:', error);
}
```

Pool statistics:
```javascript
const { getPoolStats } = require('./config/database');

const stats = getPoolStats();
console.log(`Active: ${stats.activeConnections}`);
console.log(`Idle: ${stats.idleConnections}`);
console.log(`Total: ${stats.totalConnections}`);
```

**Error Handling:**
The module handles common database errors:
- `PROTOCOL_CONNECTION_LOST`: Connection closed, will auto-reconnect
- `ER_CON_COUNT_ERROR`: Too many connections
- `ECONNREFUSED`: Database server unavailable
- `ETIMEDOUT`: Connection timeout

**Graceful Shutdown:**
The module automatically sets up handlers for:
- `SIGTERM`: Graceful termination
- `SIGINT`: Ctrl+C interrupt
- `SIGUSR2`: Used by nodemon for restarts

## Environment Variables

All environment variables should be defined in the `.env` file. See `.env.example` for a complete list.

### Required Variables (All Environments)
- `JWT_SECRET`: JWT signing secret (min 32 chars in production)
- `DB_HOST`: Database host
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name

### Required Variables (Production Only)
- `SMTP_HOST`: Email server hostname
- `SMTP_USER`: SMTP username
- `SMTP_PASSWORD`: SMTP password

### Optional Variables (With Defaults)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (default: development)
- `DB_PORT`: Database port (default: 3306)
- `DB_CONNECTION_LIMIT`: Max connections (default: 10)
- `SMTP_PORT`: SMTP port (default: 587)
- `OPENVPN_PORT`: OpenVPN port (default: 1194)
- `RATE_LIMIT_WINDOW_MS`: Rate limit window (default: 900000 = 15 min)
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 100)

## Security Best Practices

1. **Never commit `.env` file to version control**
   - `.env` is in `.gitignore`
   - Use `.env.example` as a template

2. **Use strong JWT_SECRET in production**
   - Minimum 32 characters
   - Generate with: `openssl rand -base64 64`

3. **Use environment-specific configurations**
   - Development: relaxed validation
   - Production: strict validation, exits on errors

4. **Secure database credentials**
   - Use strong passwords
   - Consider using secrets management (AWS Secrets Manager, etc.)

5. **Connection pooling**
   - Default limit of 10 connections is suitable for most cases
   - Increase `DB_CONNECTION_LIMIT` for high-traffic applications

## Testing Configuration

To test the configuration modules:

```javascript
// Test environment loading
const config = require('./config/environment');
console.log('Config loaded:', config.nodeEnv);

// Test database connection
const { testConnection } = require('./config/database');
testConnection()
  .then(() => console.log('Database OK'))
  .catch((err) => console.error('Database Error:', err));
```

## Monitoring

### Database Pool Monitoring
```javascript
const { getPoolStats } = require('./config/database');

setInterval(() => {
  const stats = getPoolStats();
  console.log('Pool Stats:', stats);
}, 30000); // Every 30 seconds
```

### Health Check Endpoint
```javascript
app.get('/health', async (req, res) => {
  try {
    await testConnection();
    const stats = getPoolStats();

    res.json({
      status: 'healthy',
      database: {
        connected: true,
        pool: stats
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

## Troubleshooting

### Common Issues

**Issue: "Missing required environment variables"**
- Solution: Copy `.env.example` to `.env` and fill in all required values

**Issue: "Database connection test failed"**
- Check MySQL server is running
- Verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
- Check network connectivity to database server
- Verify user has permissions for the database

**Issue: "JWT_SECRET must be at least 32 characters"**
- Generate a strong secret: `openssl rand -base64 64`
- Update JWT_SECRET in `.env` file

**Issue: "Too many connections"**
- Increase `DB_CONNECTION_LIMIT`
- Check for connection leaks in your code
- Ensure connections are properly released

**Issue: "Connection timeout"**
- Check network connectivity
- Increase timeout values in `database.js`
- Verify firewall rules

## Migration from Existing Code

If you have existing code that uses the old configuration structure:

**Old:**
```javascript
const pool = require('../config/database');
pool.execute('SELECT * FROM users');
```

**New (still works):**
```javascript
const pool = require('../config/database');
pool.execute('SELECT * FROM users');
```

**New (recommended):**
```javascript
const { query } = require('../config/database');
const users = await query('SELECT * FROM users');
```

## Additional Resources

- [mysql2 Documentation](https://github.com/sidorares/node-mysql2)
- [dotenv Documentation](https://github.com/motdotla/dotenv)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
