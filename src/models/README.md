# Database Models Documentation

This directory contains all database models for the OpenVPN Distribution System. All models use parameterized queries to prevent SQL injection attacks and follow consistent patterns for CRUD operations.

## Architecture

- **Database**: MySQL 8.0+
- **Connection Pool**: `mysql2/promise`
- **Query Pattern**: Parameterized statements
- **Error Handling**: Try-catch with Winston logging
- **Transactions**: Supported via connection pool

## Models Overview

### 1. User Model (`User.js`)

Handles user account management including authentication, profile updates, and soft deletion.

**Methods:**

```javascript
// Create new user
User.create(userData)
// userData: { email, password, name, role }

// Find by email
User.findByEmail(email)

// Find by ID
User.findById(id)

// Update profile
User.updateProfile(id, data)
// data: { name, email, email_verified }

// Update password
User.updatePassword(id, hashedPassword)

// Soft delete (marks deleted_at)
User.softDelete(id)

// Hard delete (permanent)
User.hardDelete(id)

// Paginated list with filters
User.findAll(page, limit, filters)
// filters: { role, email_verified, search }
```

**Database Fields:**
- `id` (INT, PK, AUTO_INCREMENT)
- `email` (VARCHAR, UNIQUE, NOT NULL)
- `password` (VARCHAR, NOT NULL) - bcrypt hashed
- `name` (VARCHAR, NOT NULL)
- `role` (ENUM: 'user', 'admin')
- `email_verified` (BOOLEAN)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `deleted_at` (TIMESTAMP, nullable) - soft delete

**Security Features:**
- Passwords stored as bcrypt hashes
- Email validation
- Role-based access control
- Soft delete support

---

### 2. VerificationToken Model (`VerificationToken.js`)

Manages email verification and password reset tokens with expiration.

**Methods:**

```javascript
// Create new token
VerificationToken.create(userId, token, expiresAt)

// Find by token (includes user data)
VerificationToken.findByToken(token)

// Delete by token
VerificationToken.deleteByToken(token)

// Delete expired tokens (cleanup)
VerificationToken.deleteExpired()

// Delete all tokens for a user
VerificationToken.deleteByUserId(userId)

// Find all valid tokens for user
VerificationToken.findByUserId(userId)

// Check if token is valid
VerificationToken.isValid(token)
```

**Database Fields:**
- `id` (INT, PK, AUTO_INCREMENT)
- `user_id` (INT, FK to users)
- `token` (VARCHAR, UNIQUE)
- `expires_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

**Token Lifecycle:**
1. Generated on user registration or password reset
2. Sent via email to user
3. Validated on verification/reset
4. Deleted after use or expiration
5. Cleanup via cron job or admin action

---

### 3. ConfigFile Model (`ConfigFile.js`)

Manages OpenVPN configuration files with download tracking and revocation.

**Methods:**

```javascript
// Create new config
ConfigFile.create(userId, qosPolicyId, filename, content)

// Find all configs for user
ConfigFile.findByUserId(userId)

// Find by ID (includes user and QoS data)
ConfigFile.findById(id)

// Mark as downloaded
ConfigFile.markDownloaded(id)

// Revoke config (soft delete)
ConfigFile.revoke(id)

// Delete permanently
ConfigFile.deleteById(id)

// Find active (non-revoked) configs
ConfigFile.findActiveByUserId(userId)

// Get statistics
ConfigFile.getStats()

// Delete all configs for user
ConfigFile.deleteByUserId(userId)

// Paginated list
ConfigFile.findAll(page, limit)
```

**Database Fields:**
- `id` (INT, PK, AUTO_INCREMENT)
- `user_id` (INT, FK to users)
- `qos_policy_id` (INT, FK to qos_policies, nullable)
- `filename` (VARCHAR)
- `content` (TEXT) - full OpenVPN config
- `downloaded_at` (TIMESTAMP, nullable)
- `revoked_at` (TIMESTAMP, nullable) - soft delete
- `created_at` (TIMESTAMP)

**Config Lifecycle:**
1. Generated with QoS policy embedded
2. Stored in database
3. Email notification sent
4. User downloads (tracked)
5. Can be revoked (soft delete)
6. Can be permanently deleted

---

### 4. QosPolicy Model (`QosPolicy.js`)

Manages Quality of Service policies for bandwidth control and prioritization.

**Methods:**

```javascript
// Create new policy
QosPolicy.create(policyData)
// policyData: { name, bandwidth_limit, priority, description }

// Find all policies
QosPolicy.findAll()

// Find by ID
QosPolicy.findById(id)

// Update policy
QosPolicy.update(id, data)
// data: { name, bandwidth_limit, priority, description }

// Delete policy (checks for user assignments)
QosPolicy.delete(id)

// Assign policy to user
QosPolicy.assignToUser(userId, policyId)

// Remove policy from user
QosPolicy.removeFromUser(userId)

// Find policy assigned to user
QosPolicy.findByUserId(userId)

// Get users with specific policy
QosPolicy.getUsersByPolicy(policyId)

// Get statistics
QosPolicy.getStats()

// Find by priority level
QosPolicy.findByPriority(priority)
```

**Database Fields:**
- `id` (INT, PK, AUTO_INCREMENT)
- `name` (VARCHAR, UNIQUE)
- `bandwidth_limit` (VARCHAR) - e.g., "10Mbps", "100Mbps"
- `priority` (ENUM: 'low', 'medium', 'high')
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Junction Table (user_qos):**
- `id` (INT, PK, AUTO_INCREMENT)
- `user_id` (INT, FK to users)
- `qos_policy_id` (INT, FK to qos_policies)
- `assigned_at` (TIMESTAMP)

**Policy Features:**
- One policy per user (enforced by assignToUser)
- Cannot delete if assigned to users
- Priority levels for traffic management
- Embedded in OpenVPN configs

---

## Usage Examples

### Creating a New User

```javascript
const { User } = require('./models');
const bcrypt = require('bcrypt');

async function registerUser(email, password, name) {
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    password: hashedPassword,
    name,
    role: 'user'
  });

  return user;
}
```

### Generating and Storing Config

```javascript
const { ConfigFile, QosPolicy } = require('./models');

async function generateConfig(userId) {
  // Get user's QoS policy
  const qosPolicy = await QosPolicy.findByUserId(userId);

  // Generate OpenVPN config content
  const configContent = generateOpenVPNConfig(qosPolicy);

  // Store config
  const config = await ConfigFile.create(
    userId,
    qosPolicy?.id,
    `user_${userId}_${Date.now()}.ovpn`,
    configContent
  );

  return config;
}
```

### Assigning QoS Policy

```javascript
const { QosPolicy } = require('./models');

async function assignPremiumPlan(userId) {
  // Find premium policy
  const policies = await QosPolicy.findByPriority('high');
  const premiumPolicy = policies.find(p => p.name === 'Premium');

  // Assign to user (removes any existing policy)
  await QosPolicy.assignToUser(userId, premiumPolicy.id);

  return premiumPolicy;
}
```

### Email Verification Flow

```javascript
const { User, VerificationToken } = require('./models');
const crypto = require('crypto');

async function sendVerificationEmail(userId) {
  // Generate token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Store token
  await VerificationToken.create(userId, token, expiresAt);

  // Send email with token
  // ... email sending logic
}

async function verifyEmail(token) {
  // Find token
  const tokenData = await VerificationToken.findByToken(token);

  if (!tokenData) {
    throw new Error('Invalid or expired token');
  }

  // Update user
  await User.updateProfile(tokenData.user_id, { email_verified: true });

  // Delete token
  await VerificationToken.deleteByToken(token);

  return true;
}
```

## Database Connection

All models use the connection pool from `/src/config/database.js`:

```javascript
const pool = require('../config/database');

// Execute query
const [rows] = await pool.execute(query, params);
```

**Connection Pool Configuration:**
- Connection limit: 10
- Wait for connections: true
- Keep-alive enabled
- Automatic reconnection
- Error handling and logging

## Error Handling

All model methods follow this pattern:

```javascript
static async methodName(params) {
  try {
    // Database operations
    const [result] = await pool.execute(query, values);

    logger.info('Operation successful');
    return result;
  } catch (error) {
    logger.error('Operation failed:', error);
    throw error; // Re-throw for controller handling
  }
}
```

Controllers should catch and handle these errors appropriately.

## Security Best Practices

1. **SQL Injection Prevention**
   - All queries use parameterized statements
   - Never concatenate user input into SQL

2. **Password Security**
   - Passwords hashed with bcrypt (10+ rounds)
   - Plain passwords never stored or logged

3. **Soft Deletes**
   - Users and configs support soft deletion
   - Prevents accidental data loss
   - Maintains referential integrity

4. **Input Validation**
   - Validate data before model methods
   - Use validator middleware in routes
   - Sanitize user input

5. **Access Control**
   - Role-based permissions in User model
   - Check authorization before operations
   - Audit log for sensitive actions

## Database Maintenance

### Cleanup Tasks

```javascript
// Clean expired tokens (run daily via cron)
const deleted = await VerificationToken.deleteExpired();
console.log(`Deleted ${deleted} expired tokens`);

// Get system statistics
const userStats = await User.findAll(1, 10, { role: 'admin' });
const configStats = await ConfigFile.getStats();
const qosStats = await QosPolicy.getStats();
```

### Backup Recommendations

1. Daily automated backups
2. Backup before schema changes
3. Test restore procedures
4. Store backups securely off-site

### Performance Optimization

1. Indexes created on frequently queried columns
2. Connection pooling for concurrent requests
3. Pagination for large result sets
4. Caching for frequently accessed data (e.g., QoS policies)

## Testing

Each model should have unit tests covering:
- CRUD operations
- Error handling
- Edge cases (null values, duplicates)
- Foreign key constraints
- Soft delete behavior

Example test structure:

```javascript
describe('User Model', () => {
  describe('create()', () => {
    it('should create a new user', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
        role: 'user'
      });

      expect(user).toHaveProperty('id');
      expect(user.email).toBe('test@example.com');
    });

    it('should reject duplicate email', async () => {
      await expect(User.create({ /* same email */ }))
        .rejects.toThrow();
    });
  });
});
```

## Migration Strategy

When modifying database schema:

1. Create migration SQL file
2. Test in development environment
3. Backup production database
4. Apply migration during maintenance window
5. Update models to match schema
6. Deploy updated code
7. Verify data integrity

## Support

For questions or issues with the models:
- Check logs in `/logs/combined.log` and `/logs/error.log`
- Review database connection pool stats
- Verify MySQL server status
- Check foreign key constraints

---

**Last Updated:** 2025-10-14
**Database Version:** MySQL 8.0+
**Node.js Version:** 18+
