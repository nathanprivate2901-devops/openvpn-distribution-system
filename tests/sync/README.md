# OpenVPN User Sync Test Suite

## Overview

Comprehensive test suite for the OpenVPN user synchronization system.

## Test Files

### 1. `userSync.test.js`
**Integration tests** for the complete sync lifecycle.

Tests:
- ✅ User creation and auto-sync
- ✅ Email verification trigger
- ✅ Manual sync operations (single, full, dry-run)
- ✅ User properties synchronization
- ✅ Scheduler operations
- ✅ User deletion and cleanup
- ✅ Security and permissions
- ✅ Error handling
- ✅ Sync statistics

### 2. `syncScheduler.test.js`
**Unit tests** for the scheduler service.

Tests:
- ✅ Scheduler start/stop
- ✅ Interval management
- ✅ Manual sync triggers
- ✅ Concurrent sync prevention
- ✅ History tracking
- ✅ Statistics calculation
- ✅ Error handling
- ✅ Next sync calculation

## Prerequisites

### Required Services
- MySQL database running
- OpenVPN Access Server container running
- Backend server running

### Required Packages
```bash
npm install --save-dev mocha chai supertest sinon
```

## Running Tests

### Run All Sync Tests
```bash
npm test tests/sync/
```

### Run Specific Test File
```bash
# Integration tests
npm test tests/sync/userSync.test.js

# Unit tests
npm test tests/sync/syncScheduler.test.js
```

### Run with Coverage
```bash
npm test -- --coverage tests/sync/
```

### Run in Watch Mode
```bash
npm test -- --watch tests/sync/
```

## Test Environment Setup

### 1. Environment Variables
Create `.env.test`:
```env
NODE_ENV=test
DB_HOST=localhost
DB_NAME=openvpn_system_test
OPENVPN_CONTAINER_NAME=openvpn-server
SYNC_INTERVAL_MINUTES=15
```

### 2. Test Database
```bash
# Create test database
mysql -u root -p -e "CREATE DATABASE openvpn_system_test;"

# Import schema
mysql -u root -p openvpn_system_test < database-setup.sql
```

### 3. Docker Services
```bash
# Ensure services are running
docker-compose up -d mysql openvpn-server

# Verify OpenVPN is accessible
docker exec openvpn-server sacli ConfigQuery
```

## Test Structure

### Integration Tests (`userSync.test.js`)

```
OpenVPN User Synchronization
├── 1. User Creation and Auto-Sync
│   ├── Create user in MySQL
│   ├── Verify no sync for unverified user
│   ├── Verify email
│   └── Verify auto-sync to OpenVPN
├── 2. Manual Sync Operations
│   ├── Get sync status
│   ├── Sync single user
│   ├── Full sync (dry run)
│   └── Full sync (real)
├── 3. User Properties Sync
│   ├── Email sync
│   ├── Name sync
│   ├── Role sync
│   └── Admin privileges
├── 4. Scheduler Operations
│   ├── Get status
│   ├── Stop/start
│   ├── Update interval
│   └── Validation
├── 5. User Deletion and Cleanup
│   ├── Soft delete
│   ├── Auto-remove from OpenVPN
│   └── Manual removal
├── 6. Security and Permissions
│   ├── Authentication required
│   ├── Admin-only access
│   └── Self-protection
├── 7. Error Handling
│   ├── Non-existent users
│   ├── Invalid formats
│   └── Docker connectivity
└── 8. Sync Statistics
    ├── History tracking
    ├── Sync percentage
    ├── Missing users
    └── Orphaned users
```

### Unit Tests (`syncScheduler.test.js`)

```
Sync Scheduler Service
├── Scheduler Control
├── Interval Management
├── Manual Sync
├── Status and History
├── Error Handling
├── Next Sync Calculation
└── Statistics
```

## Test Data

### Test User Template
```javascript
{
  username: `testuser_${timestamp}`,
  email: `testuser_${timestamp}@test.com`,
  password: 'TestPassword123!',
  name: 'Test User',
  role: 'user',
  email_verified: 0
}
```

### Admin Credentials
```javascript
{
  email: 'admin@example.com',
  password: 'admin123'
}
```

## Assertions

### Common Assertions
```javascript
// Successful API response
expect(res.status).to.equal(200);
expect(res.body).to.have.property('success', true);

// User exists in OpenVPN
const exists = await openvpnUserExists(username);
expect(exists).to.be.true;

// User properties synced
const props = await execSacli(`--user "${username}" UserPropGet`);
expect(props.prop_email).to.equal(email);

// Scheduler running
const status = syncScheduler.getStatus();
expect(status.running).to.be.true;

// History tracked
expect(status.history).to.be.an('array');
expect(status.history.length).to.be.at.least(1);
```

## Mocking and Stubbing

### Stub OpenVPN Operations
```javascript
const sinon = require('sinon');
const openvpnUserSync = require('../../src/services/openvpnUserSync');

const stub = sinon.stub(openvpnUserSync, 'syncUsers')
  .resolves({
    created: [],
    updated: ['admin'],
    deleted: [],
    errors: []
  });

// Restore after test
stub.restore();
```

### Mock Docker Exec
```javascript
const execStub = sinon.stub(child_process, 'exec')
  .yields(null, JSON.stringify({ result: 'success' }), '');
```

## Debugging Tests

### Enable Verbose Logging
```bash
DEBUG=* npm test tests/sync/userSync.test.js
```

### Run Single Test
```javascript
it.only('should sync user to OpenVPN', async function() {
  // Test code
});
```

### Skip Test
```javascript
it.skip('should handle edge case', async function() {
  // Test code
});
```

### Increase Timeout
```javascript
describe('Slow Tests', function() {
  this.timeout(60000); // 60 seconds

  it('should wait for sync', async function() {
    // Long-running test
  });
});
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: Sync Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: openvpn_system_test

      openvpn:
        image: openvpn/openvpn-as:latest

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - run: npm install
      - run: npm test tests/sync/
```

## Troubleshooting

### OpenVPN Container Not Found
```bash
# Check container name
docker ps | grep openvpn

# Update .env.test
OPENVPN_CONTAINER_NAME=actual-container-name
```

### Permission Denied on Docker Socket
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Or run with sudo (not recommended)
sudo npm test
```

### MySQL Connection Failed
```bash
# Check MySQL is running
docker-compose ps mysql

# Verify connection
mysql -h localhost -u root -p -e "SELECT 1;"
```

### Tests Hanging
- Increase timeout in test file
- Check for unclosed database connections
- Verify all promises are awaited
- Check Docker containers are responsive

### Assertions Failing
- Verify test database is clean
- Check OpenVPN container state
- Ensure admin user exists
- Verify environment variables

## Best Practices

### Before Each Test
1. ✅ Clean up test data
2. ✅ Verify services are running
3. ✅ Reset scheduler state

### After Each Test
1. ✅ Remove test users from MySQL
2. ✅ Remove test users from OpenVPN
3. ✅ Restore stubs/mocks

### Test Isolation
- Each test should be independent
- Don't rely on test execution order
- Clean up resources in `after` hooks

### Naming Conventions
- Describe what is being tested
- Use "should" statements
- Be specific and descriptive

## Coverage Goals

- **Line Coverage**: > 80%
- **Branch Coverage**: > 75%
- **Function Coverage**: > 90%

## Related Documentation

- [USER_SYNC_GUIDE.md](../../USER_SYNC_GUIDE.md) - Sync implementation guide
- [OPENVPN_SETUP.md](../../OPENVPN_SETUP.md) - Setup instructions
- [CLAUDE.md](../../CLAUDE.md) - Project architecture

## Support

For issues with tests:
1. Check [Troubleshooting](#troubleshooting) section
2. Review test logs for specific errors
3. Verify all prerequisites are met
4. Check Docker containers are healthy
