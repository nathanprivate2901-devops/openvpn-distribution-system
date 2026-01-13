# Testing Quick Start Guide

A condensed guide to get you testing the OpenVPN Distribution System quickly.

## Overview

The project uses **Mocha** and **Chai** for testing with comprehensive test coverage for:
- User authentication and authorization
- Device management
- VPN configuration generation
- QoS policy management
- LAN network routing
- Docker container operations
- User synchronization

## Setup (First Time Only)

```bash
# 1. Install dependencies
npm install

# 2. Create test database
mysql -u root -p
CREATE DATABASE openvpn_system_test;
USE openvpn_system_test;
SOURCE migrations/database-setup.sql;
exit;

# 3. Configure test environment
cp .env.example .env.test
# Edit .env.test with test database credentials
```

## Running Tests

```bash
# Run all tests
npm test

# Run synchronization tests
npm run test:sync

# Run integration tests
npm run test:integration

# Run unit tests
npm run test:unit

# Watch mode (for development)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npx mocha tests/device-test.js --timeout 10000
```

## Quick Test Template

### Unit Test (Mocha + Chai)

```javascript
const { expect } = require('chai');
const sinon = require('sinon');
const MyModule = require('../src/path/to/MyModule');

describe('MyModule', () => {
  let dbStub;

  beforeEach(() => {
    // Setup stubs/mocks
    dbStub = sinon.stub();
  });

  afterEach(() => {
    // Restore stubs
    sinon.restore();
  });

  describe('myFunction', () => {
    it('should do something expected', async () => {
      // Arrange
      const input = { test: 'data' };
      dbStub.resolves({ result: 'success' });

      // Act
      const result = await MyModule.myFunction(input);

      // Assert
      expect(result).to.equal('success');
      expect(dbStub.calledOnce).to.be.true;
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      dbStub.rejects(new Error('Database error'));

      // Act & Assert
      try {
        await MyModule.myFunction({});
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Database error');
      }
    });
  });
});
```

### Integration Test

```javascript
const { expect } = require('chai');
const request = require('supertest');
const app = require('../src/index');

describe('API Endpoint Integration', () => {
  let authToken;

  before(async () => {
    // Setup test data
    // Login and get auth token if needed
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123'
      });
    authToken = response.body.token;
  });

  after(async () => {
    // Cleanup test data
  });

  describe('GET /api/resource', () => {
    it('should return resource list', async () => {
      const response = await request(app)
        .get('/api/resource')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.be.an('array');
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .get('/api/resource')
        .expect(401);
    });
  });
});
```

  it('should handle request successfully', async () => {
    const data = { key: 'value' };

    const response = await request(app)
      .post('/api/endpoint')
      .send(data)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

## Common Patterns

### Mock Database Query

```javascript
query.mockResolvedValueOnce([{ id: 1, name: 'test' }]);
```

### Mock Error

```javascript
query.mockRejectedValueOnce(new Error('Database error'));
```

### Test API with Auth

```javascript
const response = await request(app)
  .get('/api/protected')
  .set('Authorization', `Bearer ${token}`)
  .expect(200);
```

### Use Fixtures

```javascript
const fixtures = require('../../fixtures/users');
const userData = fixtures.validUser;
```

### Random Test Data

```javascript
const email = testUtils.randomEmail();
const username = testUtils.randomUsername();
```

## Custom Matchers

```javascript
expect(token).toBeValidJWT();
expect(email).toBeValidEmail();
expect(value).toBeWithinRange(10, 20);
```

## Coverage Goals

- Models: 90%+
- Controllers: 85%+
- Middleware: 95%+
- Utilities: 90%+
- Overall: 75%+

## File Structure

```
tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
├── fixtures/          # Test data
├── helpers/           # Utilities
└── setup/             # Configuration
```

## Helpful Commands

```bash
# Run specific test
npx jest User.test.js

# Run tests matching pattern
npx jest --testNamePattern="login"

# Update snapshots
npx jest -u

# Clear Jest cache
npx jest --clearCache

# Coverage report
npm test
open coverage/index.html
```

## Debugging

```bash
# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Verbose output
npm run test:verbose

# Single test file
npx jest tests/unit/models/User.test.js --verbose
```

## Before Committing

```bash
# Run linter
npm run lint:fix

# Run all tests
npm test

# Check coverage meets thresholds
# Coverage report will show if below minimum
```

## Key Files

- `jest.config.js` - Jest configuration
- `.env.test` - Test environment variables
- `tests/setup/jest.setup.js` - Global test setup
- `tests/helpers/dbHelper.js` - Database utilities
- `tests/fixtures/` - Test data

## Quick Fixes

### Database issues
```bash
mysql -u root -p openvpn_system_test < database-setup.sql
```

### Port in use
```bash
lsof -ti:3001 | xargs kill -9
```

### Clear node modules
```bash
rm -rf node_modules package-lock.json
npm install
```

## Resources

- Full guide: `tests/README.md`
- Strategy doc: `TESTING-STRATEGY.md`
- Jest docs: https://jestjs.io
- Supertest: https://github.com/visionmedia/supertest

## Need Help?

1. Check `tests/README.md` for detailed info
2. Look at existing test examples
3. Review `TESTING-STRATEGY.md`
4. Create an issue with [test] tag
