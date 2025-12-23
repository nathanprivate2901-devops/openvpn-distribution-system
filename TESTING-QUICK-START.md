# Testing Quick Start Guide

A condensed guide to get you testing quickly.

## Setup (First Time Only)

```bash
# 1. Install dependencies
npm install

# 2. Create test database
mysql -u root -p
CREATE DATABASE openvpn_system_test;
USE openvpn_system_test;
SOURCE database-setup.sql;
exit;

# 3. Configure environment
cp .env.test .env.test.local
# Edit credentials if needed
```

## Running Tests

```bash
# All tests with coverage
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode (development)
npm run test:watch

# Specific test file
npx jest tests/unit/models/User.test.js
```

## Quick Test Template

### Unit Test

```javascript
const MyModule = require('../../../src/path/to/MyModule');
const fixtures = require('../../fixtures/myFixtures');

jest.mock('../../../src/config/database');
const { query } = require('../../../src/config/database');

describe('MyModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('myFunction', () => {
    it('should do something expected', async () => {
      // Arrange
      const input = fixtures.validInput;
      query.mockResolvedValueOnce({ result: 'success' });

      // Act
      const result = await MyModule.myFunction(input);

      // Assert
      expect(result).toBe('success');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.any(Array)
      );
    });
  });
});
```

### Integration Test

```javascript
const request = require('supertest');
const { createTestApp } = require('../helpers/testServer');
const dbHelper = require('../helpers/dbHelper');

describe('API Endpoint', () => {
  let app;

  beforeAll(async () => {
    app = createTestApp();
    await dbHelper.connect();
  });

  afterAll(async () => {
    await dbHelper.disconnect();
  });

  beforeEach(async () => {
    await dbHelper.clearAllTables();
  });

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
