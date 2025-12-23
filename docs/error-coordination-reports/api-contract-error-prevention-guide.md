# API Contract Error Prevention Guide

**Version:** 1.0
**Last Updated:** October 14, 2025
**Owner:** Error Coordination Team

---

## Table of Contents

1. [Overview](#overview)
2. [Error Pattern Classification](#error-pattern-classification)
3. [Prevention Strategies](#prevention-strategies)
4. [Detection Mechanisms](#detection-mechanisms)
5. [Recovery Procedures](#recovery-procedures)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Monitoring and Alerting](#monitoring-and-alerting)
8. [Best Practices](#best-practices)

---

## Overview

### Purpose

This guide provides comprehensive strategies for preventing, detecting, and recovering from API contract mismatches between frontend and backend systems in the OpenVPN Distribution System.

### Scope

Covers all aspects of API contract management including:
- Field name consistency
- Data type validation
- Request/response structure
- Error handling patterns
- Version management

### Related Incidents

- ERR-2025-10-14-001: Password Change Field Mismatch

---

## Error Pattern Classification

### 1. Field Name Mismatches

**Severity:** High
**Detection Difficulty:** Medium
**Common Causes:**
- Inconsistent naming conventions
- Copy-paste errors
- Lack of shared type definitions
- Manual API client implementation

**Example:**
```typescript
// Frontend sends
{ currentPassword: "...", newPassword: "..." }

// Backend expects
{ oldPassword: "...", newPassword: "..." }
```

**Impact:**
- 100% failure rate for affected operations
- User frustration
- Support ticket volume increase

**Prevention Priority:** Critical

### 2. Data Type Mismatches

**Severity:** High
**Detection Difficulty:** Low
**Common Causes:**
- String vs number confusion
- Boolean vs string ("true" vs true)
- Array vs single value
- Null vs undefined handling

**Example:**
```typescript
// Frontend sends
{ userId: "123" }  // String

// Backend expects
{ userId: 123 }  // Number
```

**Impact:**
- Validation failures
- Database errors
- Type coercion issues

**Prevention Priority:** Critical

### 3. Required vs Optional Field Confusion

**Severity:** Medium
**Detection Difficulty:** Medium
**Common Causes:**
- Unclear API documentation
- Validation rule changes
- Conditional requirements not documented

**Example:**
```typescript
// Frontend assumes optional
{ email: "user@example.com" }

// Backend requires both
{ email: "user@example.com", username: "required" }
```

**Impact:**
- Intermittent failures
- Incomplete data submission
- User confusion

**Prevention Priority:** High

### 4. Nested Object Structure Mismatches

**Severity:** Medium
**Detection Difficulty:** High
**Common Causes:**
- Complex nested structures
- Flattened vs nested data
- Array of objects vs single object

**Example:**
```typescript
// Frontend sends
{ qosPolicy: { id: 1, name: "Premium" } }

// Backend expects
{ qosPolicyId: 1 }
```

**Impact:**
- Data extraction failures
- Null reference errors
- Partial updates

**Prevention Priority:** High

### 5. Array vs Single Value Ambiguity

**Severity:** Medium
**Detection Difficulty:** Medium
**Common Causes:**
- Inconsistent pluralization
- Batch vs single operations
- Evolution of API over time

**Example:**
```typescript
// Frontend sends
{ containerId: "abc123" }

// Backend expects
{ containerIds: ["abc123"] }
```

**Impact:**
- Type errors
- Iteration failures
- Unexpected behavior

**Prevention Priority:** Medium

---

## Prevention Strategies

### Strategy 1: OpenAPI Specification (Schema-First Development)

**Implementation Priority:** Critical
**Effort:** Medium
**Maintenance:** Low

#### Benefits
- Single source of truth for all APIs
- Automatic validation against schema
- Client code generation
- Interactive documentation
- Contract testing support

#### Implementation Steps

**Step 1: Install Tools**
```bash
npm install --save-dev @openapitools/openapi-generator-cli
npm install --save swagger-ui-express
npm install --save-dev swagger-jsdoc
```

**Step 2: Create Base Specification**

```yaml
# docs/api-spec/openapi.yaml
openapi: 3.0.0
info:
  title: OpenVPN Distribution System API
  version: 1.0.0
  description: API for managing OpenVPN configurations with QoS policies
  contact:
    name: API Support
    email: api@example.com

servers:
  - url: http://localhost:3000/api
    description: Development server
  - url: https://api.example.com/api
    description: Production server

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Error:
      type: object
      required:
        - success
        - message
        - code
      properties:
        success:
          type: boolean
          example: false
        message:
          type: string
          example: "Validation failed"
        code:
          type: string
          example: "VALIDATION_ERROR"
        errors:
          type: array
          items:
            $ref: '#/components/schemas/ValidationError'

    ValidationError:
      type: object
      required:
        - field
        - message
      properties:
        field:
          type: string
          example: "oldPassword"
        message:
          type: string
          example: "Current password is required"
        value:
          type: string
          nullable: true

    ChangePasswordRequest:
      type: object
      required:
        - oldPassword
        - newPassword
      properties:
        oldPassword:
          type: string
          format: password
          description: User's current password
          minLength: 8
          example: "OldPass123!"
        newPassword:
          type: string
          format: password
          description: New password to set
          minLength: 8
          pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$'
          example: "NewPass456!"

    ChangePasswordResponse:
      type: object
      required:
        - success
        - message
      properties:
        success:
          type: boolean
          example: true
        message:
          type: string
          example: "Password changed successfully"

paths:
  /users/password:
    put:
      summary: Change user password
      description: Change the authenticated user's password
      tags:
        - Users
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ChangePasswordRequest'
            examples:
              valid:
                summary: Valid password change
                value:
                  oldPassword: "OldPass123!"
                  newPassword: "NewPass456!"
      responses:
        '200':
          description: Password changed successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ChangePasswordResponse'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                success: false
                message: "Validation failed"
                code: "VALIDATION_ERROR"
                errors:
                  - field: "oldPassword"
                    message: "Current password is required"
        '401':
          description: Unauthorized or incorrect current password
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                success: false
                message: "Current password is incorrect"
                code: "INVALID_CREDENTIALS"
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

**Step 3: Integrate Swagger UI**

```javascript
// src/index.js
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const swaggerDocument = YAML.load(path.join(__dirname, '../docs/api-spec/openapi.yaml'));

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "OpenVPN API Documentation"
}));

logger.info('API documentation available at /api-docs');
```

**Step 4: Validate Requests Against Schema**

```javascript
// src/middleware/openApiValidator.js
const OpenAPIValidator = require('express-openapi-validator');
const path = require('path');

const validatorMiddleware = OpenAPIValidator.middleware({
  apiSpec: path.join(__dirname, '../../docs/api-spec/openapi.yaml'),
  validateRequests: true,
  validateResponses: true,
  validateSecurity: {
    handlers: {
      bearerAuth: async (req, scopes, schema) => {
        // JWT validation already handled by authMiddleware
        return true;
      }
    }
  }
});

module.exports = validatorMiddleware;
```

**Step 5: Generate TypeScript Types**

```bash
# package.json
{
  "scripts": {
    "generate:types": "openapi-generator-cli generate -i docs/api-spec/openapi.yaml -g typescript-axios -o frontend/src/generated/api",
    "generate:docs": "openapi-generator-cli generate -i docs/api-spec/openapi.yaml -g html2 -o docs/api-spec/html"
  }
}
```

### Strategy 2: Shared Type Definitions

**Implementation Priority:** Critical
**Effort:** Medium
**Maintenance:** Low

#### Monorepo Structure with Shared Types

```
openvpn-distribution-system/
├── packages/
│   ├── shared-types/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api/
│   │       │   ├── auth.types.ts
│   │       │   ├── user.types.ts
│   │       │   ├── vpn.types.ts
│   │       │   └── qos.types.ts
│   │       └── models/
│   │           ├── user.model.ts
│   │           └── config.model.ts
│   ├── backend/
│   │   └── package.json (depends on @openvpn/shared-types)
│   └── frontend/
│       └── package.json (depends on @openvpn/shared-types)
├── package.json (workspace root)
└── pnpm-workspace.yaml
```

**Shared Types Package:**

```typescript
// packages/shared-types/src/api/user.types.ts

/**
 * Request payload for changing user password
 * @see PUT /api/users/password
 */
export interface ChangePasswordRequest {
  /** User's current password for verification */
  oldPassword: string;
  /** New password to set (min 8 chars, must contain uppercase, lowercase, number) */
  newPassword: string;
}

/**
 * Response for successful password change
 */
export interface ChangePasswordResponse {
  success: true;
  message: string;
}

/**
 * Standard validation error detail
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Standard error response
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  errors?: ValidationError[];
  correlationId?: string;
}

/**
 * API response type union
 */
export type ApiResponse<T> = T | ApiErrorResponse;
```

**Frontend Usage:**

```typescript
// frontend/lib/api.ts
import type { ChangePasswordRequest, ChangePasswordResponse, ApiResponse } from '@openvpn/shared-types';

export const api = {
  user: {
    changePassword: async (
      currentPassword: string,
      newPassword: string
    ): Promise<ApiResponse<ChangePasswordResponse>> => {
      // Type-safe request construction
      const request: ChangePasswordRequest = {
        oldPassword: currentPassword, // Explicit mapping with type safety
        newPassword
      };

      return apiClient.put<ChangePasswordResponse>('/users/password', request);
    }
  }
};
```

**Backend Usage (TypeScript Migration):**

```typescript
// src/controllers/userController.ts
import type { Request, Response } from 'express';
import type { ChangePasswordRequest, ChangePasswordResponse } from '@openvpn/shared-types';

export const changePassword = async (
  req: Request<{}, ChangePasswordResponse, ChangePasswordRequest>,
  res: Response<ChangePasswordResponse>
): Promise<void> => {
  const { oldPassword, newPassword } = req.body; // Type-safe destructuring

  // Implementation...
  res.json({
    success: true,
    message: 'Password changed successfully'
  });
};
```

### Strategy 3: Contract Testing

**Implementation Priority:** Critical
**Effort:** High
**Maintenance:** Medium

#### Consumer-Driven Contract Tests

```typescript
// frontend/tests/contracts/user-api.contract.test.ts
import { Pact } from '@pact-foundation/pact';
import { api } from '@/lib/api';
import type { ChangePasswordRequest } from '@openvpn/shared-types';

describe('User API Contract Tests', () => {
  const provider = new Pact({
    consumer: 'frontend',
    provider: 'backend-api',
    port: 8080,
    log: path.resolve(process.cwd(), 'logs', 'pact.log'),
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: 'info'
  });

  beforeAll(() => provider.setup());
  afterEach(() => provider.verify());
  afterAll(() => provider.finalize());

  describe('PUT /api/users/password', () => {
    it('should accept oldPassword and newPassword fields', async () => {
      // Define expected interaction
      await provider.addInteraction({
        state: 'user is authenticated',
        uponReceiving: 'a request to change password',
        withRequest: {
          method: 'PUT',
          path: '/api/users/password',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token123'
          },
          body: {
            oldPassword: 'OldPass123!',
            newPassword: 'NewPass456!'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            success: true,
            message: 'Password changed successfully'
          }
        }
      });

      // Execute API call
      const response = await api.user.changePassword('OldPass123!', 'NewPass456!');

      expect(response.data.success).toBe(true);
    });

    it('should reject request with missing oldPassword field', async () => {
      await provider.addInteraction({
        state: 'user is authenticated',
        uponReceiving: 'a request with missing oldPassword',
        withRequest: {
          method: 'PUT',
          path: '/api/users/password',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token123'
          },
          body: {
            newPassword: 'NewPass456!'
            // oldPassword intentionally missing
          }
        },
        willRespondWith: {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: [
              {
                field: 'oldPassword',
                message: 'Current password is required'
              }
            ]
          }
        }
      });

      try {
        await api.user.changePassword('', 'NewPass456!');
        fail('Should have thrown error');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});
```

**Backend Contract Verification:**

```javascript
// src/tests/contracts/user-api-provider.test.js
const { Verifier } = require('@pact-foundation/pact');
const path = require('path');
const app = require('../../index');

describe('Backend API Contract Verification', () => {
  let server;
  const PORT = 8080;

  beforeAll((done) => {
    server = app.listen(PORT, () => {
      console.log(`Provider service running on port ${PORT}`);
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should validate against frontend contracts', async () => {
    const opts = {
      provider: 'backend-api',
      providerBaseUrl: `http://localhost:${PORT}`,
      pactUrls: [
        path.resolve(process.cwd(), '../frontend/pacts/frontend-backend-api.json')
      ],
      stateHandlers: {
        'user is authenticated': async () => {
          // Set up authenticated user state
          // Create test user, generate token, etc.
          return Promise.resolve();
        }
      }
    };

    return new Verifier(opts).verifyProvider();
  });
});
```

### Strategy 4: Runtime Validation

**Implementation Priority:** High
**Effort:** Low
**Maintenance:** Low

#### Enhanced Validation with Field Mismatch Detection

```javascript
// src/middleware/smartValidator.js
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

class SmartValidator {
  constructor() {
    // Known field mappings for common mistakes
    this.fieldMappings = {
      oldPassword: ['currentPassword', 'current_password', 'old_password'],
      newPassword: ['password', 'new_password'],
      userId: ['user_id', 'userid', 'uid'],
      policyId: ['policy_id', 'policyid', 'pid'],
      containerId: ['container_id', 'containerid', 'cid']
    };
  }

  validate(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }));

      // Detect potential field mismatches
      const suggestions = this.detectFieldMismatches(formattedErrors, req.body);

      logger.warn('Validation failed', {
        correlationId: req.correlationId,
        path: req.path,
        errors: formattedErrors,
        suggestions: suggestions.length > 0 ? suggestions : undefined
      });

      // Include suggestions in response for better developer experience
      const response = {
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: formattedErrors,
        correlationId: req.correlationId
      };

      if (suggestions.length > 0 && process.env.NODE_ENV === 'development') {
        response.suggestions = suggestions;
      }

      return res.status(400).json(response);
    }

    next();
  }

  detectFieldMismatches(validationErrors, requestBody) {
    const suggestions = [];
    const providedFields = Object.keys(requestBody);

    validationErrors.forEach(error => {
      // Only check for missing required fields
      if (error.message.toLowerCase().includes('required')) {
        const expectedField = error.field;

        // Check if there are similar field names in the request
        const potentialMatches = this.findSimilarFields(expectedField, providedFields);

        if (potentialMatches.length > 0) {
          suggestions.push({
            expectedField,
            providedFields: potentialMatches,
            suggestion: `Did you mean to send '${expectedField}' instead of '${potentialMatches[0]}'?`,
            fix: `Rename field '${potentialMatches[0]}' to '${expectedField}' in your request`
          });
        }
      }
    });

    return suggestions;
  }

  findSimilarFields(expectedField, providedFields) {
    const matches = [];

    // Check known mappings first
    if (this.fieldMappings[expectedField]) {
      const knownAlternatives = this.fieldMappings[expectedField];
      matches.push(...providedFields.filter(f => knownAlternatives.includes(f)));
    }

    // Check for similar field names
    providedFields.forEach(providedField => {
      const similarity = this.calculateSimilarity(expectedField, providedField);
      if (similarity > 0.6 && !matches.includes(providedField)) {
        matches.push(providedField);
      }
    });

    return matches;
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}

const smartValidator = new SmartValidator();

module.exports = {
  validate: smartValidator.validate.bind(smartValidator),
  smartValidator
};
```

---

## Detection Mechanisms

### 1. Static Analysis

#### ESLint Rules for API Consistency

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // Enforce consistent field naming
    'id-match': ['error', '^[a-z][a-zA-Z0-9]*$', {
      properties: true,
      onlyDeclarations: false
    }],

    // Warn on potential field mismatches
    'no-restricted-syntax': [
      'warn',
      {
        selector: 'Property[key.name="currentPassword"]',
        message: 'Use "oldPassword" for password change requests (API contract)'
      },
      {
        selector: 'Property[key.name="user_id"]',
        message: 'Use camelCase "userId" (API contract)'
      }
    ]
  }
};
```

#### TypeScript Strict Mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 2. Runtime Monitoring

#### Request/Response Logging

```javascript
// src/middleware/apiLogger.js
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const apiLogger = (req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);

  const startTime = Date.now();

  // Log request
  logger.info('API Request', {
    correlationId: req.correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    // Don't log password fields
    body: sanitizeBody(req.body),
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Intercept response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;

    logger.info('API Response', {
      correlationId: req.correlationId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      success: data?.success !== false
    });

    return originalJson.call(this, data);
  };

  next();
};

function sanitizeBody(body) {
  if (!body) return body;

  const sanitized = { ...body };
  const sensitiveFields = [
    'password', 'oldPassword', 'newPassword', 'currentPassword',
    'token', 'secret', 'apiKey', 'authorization'
  ];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

module.exports = apiLogger;
```

### 3. Automated Testing in CI/CD

#### Pre-commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Running pre-commit checks..."

# Run linter
npm run lint || exit 1

# Run contract tests
npm run test:contract || exit 1

# Validate OpenAPI spec
swagger-cli validate docs/api-spec/openapi.yaml || exit 1

echo "Pre-commit checks passed!"
```

#### CI Pipeline

```yaml
# .github/workflows/api-validation.yml
name: API Contract Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Validate OpenAPI Spec
        run: npx swagger-cli validate docs/api-spec/openapi.yaml

      - name: Run Contract Tests
        run: npm run test:contract

      - name: Check Type Consistency
        run: npm run type-check

      - name: Generate API Diff
        if: github.event_name == 'pull_request'
        run: |
          npx openapi-diff \
            origin/main:docs/api-spec/openapi.yaml \
            HEAD:docs/api-spec/openapi.yaml \
            --json > api-diff.json

      - name: Comment API Changes
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const diff = JSON.parse(fs.readFileSync('api-diff.json'));

            if (diff.breaking) {
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: '⚠️ **Breaking API Changes Detected**\n\n' +
                      JSON.stringify(diff.breaking, null, 2)
              });
            }
```

---

## Recovery Procedures

### Immediate Response Checklist

When an API contract mismatch is detected in production:

**1. Assess Impact (< 2 minutes)**
- [ ] Identify affected endpoint(s)
- [ ] Estimate number of impacted users
- [ ] Check error rate in monitoring dashboard
- [ ] Verify if workaround exists

**2. Communicate (< 5 minutes)**
- [ ] Notify team via Slack/Teams
- [ ] Create incident in PagerDuty/incident management system
- [ ] Post status update if user-facing

**3. Quick Fix (< 10 minutes)**
- [ ] Identify which side has the mismatch (frontend vs backend)
- [ ] Apply hotfix to the incorrect side
- [ ] Deploy via fast-track process
- [ ] Verify fix in staging

**4. Deploy and Verify (< 15 minutes)**
- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Test affected functionality manually
- [ ] Confirm resolution

**5. Post-Incident (< 24 hours)**
- [ ] Create post-mortem document
- [ ] Schedule post-mortem meeting
- [ ] Implement prevention measures
- [ ] Update runbooks

### Rollback Procedures

**Frontend Rollback:**
```bash
# Roll back frontend to previous version
docker-compose stop frontend
docker tag openvpn-frontend:current openvpn-frontend:broken
docker tag openvpn-frontend:previous openvpn-frontend:current
docker-compose up -d frontend
```

**Backend Rollback:**
```bash
# Roll back backend to previous version
docker-compose stop backend
docker tag openvpn-backend:current openvpn-backend:broken
docker tag openvpn-backend:previous openvpn-backend:current
docker-compose up -d backend
```

### Data Recovery

If API mismatches caused data corruption:

1. **Identify affected records**
   ```sql
   SELECT * FROM audit_log
   WHERE created_at > '2025-10-14 00:00:00'
   AND operation = 'password_change'
   AND status = 'failed';
   ```

2. **Restore from backup if necessary**
   ```bash
   mysql -u root -p openvpn_system < backups/openvpn_system_2025-10-14.sql
   ```

3. **Replay successful operations**
   ```javascript
   // Reprocess failed operations from audit log
   ```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Objective:** Establish basic contract validation

| Task | Owner | Effort | Priority |
|------|-------|--------|----------|
| Create OpenAPI specification for all endpoints | Backend Dev | 8h | P0 |
| Set up Swagger UI documentation | Backend Dev | 2h | P0 |
| Implement smart validator middleware | Backend Dev | 4h | P0 |
| Add correlation IDs to all requests | Backend Dev | 2h | P1 |
| Create shared types package structure | Full Stack Dev | 4h | P0 |
| Migrate password change to use shared types | Full Stack Dev | 2h | P0 |

**Success Metrics:**
- 100% of endpoints documented in OpenAPI
- Smart validator detects field mismatches
- All requests have correlation IDs

### Phase 2: Testing Infrastructure (Week 3-4)

**Objective:** Implement comprehensive contract testing

| Task | Owner | Effort | Priority |
|------|-------|--------|----------|
| Set up Pact contract testing framework | QA/Dev | 8h | P0 |
| Write contract tests for auth endpoints | QA | 4h | P0 |
| Write contract tests for user endpoints | QA | 4h | P0 |
| Write contract tests for VPN endpoints | QA | 4h | P1 |
| Write contract tests for QoS endpoints | QA | 4h | P1 |
| Integrate contract tests into CI/CD | DevOps | 4h | P0 |
| Set up automated API diff generation | DevOps | 2h | P1 |

**Success Metrics:**
- 80% contract test coverage
- All contract tests pass in CI/CD
- API diffs generated for all PRs

### Phase 3: Advanced Monitoring (Week 5-6)

**Objective:** Proactive error detection and alerting

| Task | Owner | Effort | Priority |
|------|-------|--------|----------|
| Implement error pattern detector | Backend Dev | 6h | P1 |
| Set up structured logging with correlation | Backend Dev | 4h | P1 |
| Create metrics collector for validation errors | Backend Dev | 4h | P1 |
| Integrate with Prometheus/Grafana | DevOps | 6h | P1 |
| Set up PagerDuty alerts for pattern detection | DevOps | 2h | P2 |
| Create monitoring dashboard | DevOps | 4h | P2 |

**Success Metrics:**
- Error patterns detected within 30 seconds
- Alerts triggered for repeated mismatches
- Dashboard showing API health metrics

### Phase 4: TypeScript Migration (Week 7-12)

**Objective:** Full type safety across stack

| Task | Owner | Effort | Priority |
|------|-------|--------|----------|
| Migrate backend to TypeScript | Backend Team | 40h | P2 |
| Convert models to TypeScript classes | Backend Dev | 8h | P2 |
| Convert controllers to TypeScript | Backend Dev | 12h | P2 |
| Convert middleware to TypeScript | Backend Dev | 8h | P2 |
| Set up shared types workspace | Full Stack Dev | 4h | P1 |
| Generate API client from OpenAPI | Frontend Dev | 4h | P1 |

**Success Metrics:**
- 100% of backend code in TypeScript
- Zero `any` types in production code
- Automatic type checking in CI/CD

### Phase 5: Documentation and Training (Ongoing)

**Objective:** Team enablement and knowledge sharing

| Task | Owner | Effort | Priority |
|------|-------|--------|----------|
| Create API integration guide | Tech Writer | 8h | P1 |
| Record API best practices video | Team Lead | 2h | P2 |
| Conduct team training session | Team Lead | 2h | P1 |
| Create onboarding checklist | Team Lead | 2h | P1 |
| Write contribution guidelines | Team Lead | 4h | P2 |

**Success Metrics:**
- All developers trained on API contracts
- Documentation rated > 4/5 by team
- Zero API contract issues in next quarter

---

## Monitoring and Alerting

### Key Metrics to Track

#### 1. Validation Error Rate

**Metric:** `validation_errors_per_minute`
**Alert Threshold:** > 10 errors/minute
**Severity:** Warning

**Prometheus Query:**
```promql
rate(validation_errors_total[5m]) > 10
```

**Alert Configuration:**
```yaml
- alert: HighValidationErrorRate
  expr: rate(validation_errors_total[5m]) > 10
  for: 5m
  labels:
    severity: warning
    team: backend
  annotations:
    summary: "High validation error rate detected"
    description: "Validation errors: {{ $value }} errors/min"
```

#### 2. Field Mismatch Detection

**Metric:** `field_mismatch_detected_total`
**Alert Threshold:** > 5 mismatches/hour
**Severity:** Critical

**Log Pattern:**
```
"POTENTIAL FIELD MISMATCH DETECTED"
```

**Alert:** Immediate notification to on-call engineer

#### 3. Contract Test Failures

**Metric:** `contract_tests_failed_total`
**Alert Threshold:** > 0 failures
**Severity:** Critical

**CI/CD Integration:**
- Block deployment if contract tests fail
- Notify PR author and reviewers
- Create incident ticket

#### 4. API Response Time

**Metric:** `api_response_time_p95`
**Alert Threshold:** > 2000ms
**Severity:** Warning

**Correlation:** High validation errors may indicate API issues

### Alerting Channels

**Slack Integration:**
```javascript
// src/utils/slackAlert.js
const axios = require('axios');

async function sendSlackAlert(severity, message, details) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  const color = {
    critical: 'danger',
    warning: 'warning',
    info: 'good'
  }[severity] || 'warning';

  await axios.post(webhookUrl, {
    attachments: [{
      color,
      title: `[${severity.toUpperCase()}] API Contract Issue`,
      text: message,
      fields: Object.entries(details).map(([key, value]) => ({
        title: key,
        value: String(value),
        short: true
      })),
      footer: 'OpenVPN Distribution System',
      ts: Math.floor(Date.now() / 1000)
    }]
  });
}

module.exports = { sendSlackAlert };
```

**PagerDuty Integration:**
```javascript
// src/utils/pagerDutyAlert.js
const axios = require('axios');

async function triggerPagerDutyIncident(severity, message, details) {
  const apiKey = process.env.PAGERDUTY_API_KEY;
  const serviceId = process.env.PAGERDUTY_SERVICE_ID;

  await axios.post('https://api.pagerduty.com/incidents', {
    incident: {
      type: 'incident',
      title: `API Contract Issue: ${message}`,
      service: {
        id: serviceId,
        type: 'service_reference'
      },
      urgency: severity === 'critical' ? 'high' : 'low',
      body: {
        type: 'incident_body',
        details: JSON.stringify(details, null, 2)
      }
    }
  }, {
    headers: {
      'Authorization': `Token token=${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.pagerduty+json;version=2'
    }
  });
}

module.exports = { triggerPagerDutyIncident };
```

---

## Best Practices

### 1. Naming Conventions

**Field Names:**
- Use camelCase for JSON fields: `userId`, `oldPassword`, `maxDownloadSpeed`
- Be consistent across all endpoints
- Avoid abbreviations unless widely understood
- Use full words over shorthand

**Good Examples:**
```json
{
  "userId": 123,
  "oldPassword": "secret",
  "newPassword": "newsecret",
  "emailVerified": true
}
```

**Bad Examples:**
```json
{
  "uid": 123,                    // Abbreviation
  "current_password": "secret",  // Snake case
  "newPass": "newsecret",       // Inconsistent
  "email_verified": true        // Snake case
}
```

### 2. Documentation Standards

**Endpoint Documentation Template:**

```yaml
/api/resource/{id}:
  put:
    summary: Brief one-line description
    description: |
      Detailed description of what this endpoint does.
      Include:
      - Business logic
      - Side effects
      - Permissions required
      - Related endpoints
    tags: [Resource]
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
        description: Resource identifier
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ResourceUpdate'
          examples:
            minimal:
              summary: Minimal required fields
              value:
                field1: "value1"
            complete:
              summary: All fields
              value:
                field1: "value1"
                field2: "value2"
    responses:
      200:
        description: Success response
      400:
        description: Validation error with examples
      401:
        description: Authentication error
      404:
        description: Resource not found
      500:
        description: Server error
```

### 3. Version Management

**API Versioning Strategy:**

- Use URL versioning for major breaking changes: `/api/v1/`, `/api/v2/`
- Maintain backward compatibility for minor changes
- Deprecation period: 6 months minimum
- Clear migration guides for version upgrades

**Version Header:**
```javascript
app.use((req, res, next) => {
  res.setHeader('X-API-Version', '1.0.0');
  next();
});
```

### 4. Error Response Standards

**Standard Error Format:**
```typescript
interface ApiError {
  success: false;
  message: string;              // Human-readable message
  code: string;                 // Machine-readable code
  errors?: ValidationError[];   // Detailed validation errors
  correlationId?: string;       // For tracking
  timestamp?: string;           // ISO 8601 timestamp
  path?: string;               // Request path
  suggestion?: string;         // How to fix (development only)
}
```

**Example:**
```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "oldPassword",
      "message": "Current password is required",
      "value": null
    }
  ],
  "correlationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2025-10-14T10:30:00Z",
  "path": "/api/users/password",
  "suggestion": "Did you mean to send 'oldPassword' instead of 'currentPassword'?"
}
```

### 5. Code Review Checklist

**API Changes Review:**

- [ ] OpenAPI spec updated
- [ ] Contract tests added/updated
- [ ] Shared types updated
- [ ] Frontend API client updated
- [ ] Validation rules documented
- [ ] Error handling implemented
- [ ] Breaking changes documented
- [ ] Migration guide provided (if breaking)
- [ ] Backward compatibility maintained
- [ ] Integration tests pass

### 6. Security Considerations

**Sensitive Data Handling:**

- Never log passwords or tokens
- Sanitize request/response logs
- Use HTTPS in production
- Implement rate limiting
- Validate all input strictly
- Use parameterized queries
- Implement CORS properly

**Example Sanitization:**
```javascript
function sanitizeForLogging(data) {
  const sensitive = ['password', 'oldPassword', 'newPassword', 'token', 'secret', 'apiKey'];
  const sanitized = { ...data };

  sensitive.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}
```

---

## Conclusion

Preventing API contract mismatches requires a multi-layered approach combining:

1. **Formal Contracts:** OpenAPI specifications as single source of truth
2. **Type Safety:** Shared TypeScript types across frontend and backend
3. **Automated Testing:** Contract tests catching issues before deployment
4. **Runtime Validation:** Smart validators detecting mismatches in real-time
5. **Monitoring:** Proactive alerting on error patterns
6. **Documentation:** Clear guidelines and examples
7. **Team Culture:** Regular training and code review practices

By implementing these strategies systematically, we can achieve:
- 95%+ detection rate before production
- < 30 second detection time for issues that slip through
- < 5 minute MTTR for API contract issues
- Improved developer productivity and reduced support burden

---

**Document Maintained By:** Error Coordination Team
**Review Frequency:** Monthly
**Next Review:** November 14, 2025
**Feedback:** Submit improvements via PR or create issue
