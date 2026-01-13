# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **OpenVPN Distribution System** - a Node.js/Express backend for managing OpenVPN configuration distribution with user authentication, QoS policies, Docker container management, and administrative controls.

**Tech Stack:**
- Node.js 18+ with Express.js
- MySQL 8.0
- JWT authentication
- Docker & Docker Compose
- Winston logging
- bcrypt, helmet, CORS, rate limiting

## Development Commands

### Server Management
```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

### Docker Operations
```bash
# Start all services (recommended)
docker-compose up -d

# View backend logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

### Database Setup
```bash
# Initialize database schema
mysql -u root -p < database-setup.sql

# The schema includes: users, verification_tokens, config_files, qos_policies, user_qos tables
```

### Testing the API
```bash
# Health check
curl http://localhost:3000/health

# Admin login (default credentials: admin@example.com / admin123)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# System stats (requires admin token)
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Architecture

### Layer Structure
The codebase follows a standard MVC pattern with clear separation:

**Entry Points** (`src/routes/`)
- Define HTTP endpoints and parameter validation
- Route requests to appropriate controllers
- Routes: authRoutes, userRoutes, adminRoutes, openvpnRoutes, qosRoutes, dockerRoutes

**Business Logic** (`src/controllers/`)
- Handle request processing and orchestration
- Coordinate between models and services
- Controllers: authController, userController, adminController, openvpnController, qosController, dockerController

**Data Access** (`src/models/`)
- Direct database interactions using MySQL connection pool
- Models: User, VerificationToken, ConfigFile, QosPolicy
- All queries use parameterized statements to prevent SQL injection

**Middleware** (`src/middleware/`)
- authMiddleware.js: JWT verification and role-based access
- errorHandler.js: Centralized error handling
- rateLimiter.js: Configurable rate limiting
- validator.js: Request validation schemas

**Utilities** (`src/utils/`)
- logger.js: Winston-based logging (combined.log, error.log)
- tokenGenerator.js: Secure token generation
- emailService.js: Nodemailer email sending

### Configuration Files
- `src/config/database.js`: MySQL connection pool configuration
- `src/config/environment.js`: Environment variable management
- `.env`: Environment variables (never commit this file)
- `.env.example`: Template for required environment variables

## Key Features Implementation

### Authentication Flow
1. User registers → Email verification token sent
2. User verifies email → Account activated
3. User logs in → JWT token returned
4. Token included in Authorization header for protected routes

### OpenVPN Config Generation
- Configs generated per user with embedded QoS policies
- Download history tracked in config_files table
- Configs can be revoked (soft delete)
- Email notifications sent on generation

### Docker Container Management
- Full lifecycle control: create, start, stop, restart, remove
- Real-time logs and stats retrieval
- OpenVPN-specific container filtering
- Image pull functionality
- Admin-only operations

### QoS Policy System
- Policies define bandwidth limits and priority levels
- Many-to-many relationship between users and policies (user_qos table)
- Policies embedded in OpenVPN configurations
- Priority levels: low, medium, high

## Security Considerations

- **JWT Secret**: Must be strong and unique (set in JWT_SECRET env var)
- **Default Admin**: Change password immediately after first deployment
- **Password Requirements**: Enforced in validator middleware
- **Rate Limiting**: Configurable via RATE_LIMIT_* env vars
- **SQL Injection**: All queries use parameterized statements
- **XSS Protection**: Helmet.js configured
- **CORS**: Configured for specific origins in production

## Database Schema Notes

### users table
- Soft delete supported (deleted_at column)
- email_verified flag for email verification
- role field: 'user' or 'admin'
- Passwords hashed with bcrypt

### config_files table
- Links to users and qos_policies
- Tracks downloads and revocations
- Stores actual config content

### verification_tokens table
- Time-limited tokens (default 24 hours)
- Cleanup utility available via admin endpoint

## Environment Variables

Required:
- JWT_SECRET, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
- SMTP_HOST, SMTP_USER, SMTP_PASSWORD

Optional (with defaults):
- PORT (3000), NODE_ENV (development)
- OPENVPN_SERVER, OPENVPN_PORT (1194)
- RATE_LIMIT_WINDOW_MS (900000), RATE_LIMIT_MAX_REQUESTS (100)

## Adding New Features

1. **Create Model** (if new database table needed)
   - Add to `src/models/` with parameterized queries
   - Update `database-setup.sql` with schema changes

2. **Create Controller**
   - Add to `src/controllers/` with business logic
   - Use existing models and utilities

3. **Create Routes**
   - Add to `src/routes/` with endpoint definitions
   - Apply appropriate middleware (auth, validation)

4. **Register Routes**
   - Import and mount in `src/index.js`
   - Convention: `/api/{resource}`

5. **Add Validation**
   - Define schemas in `src/middleware/validator.js`
   - Apply to routes needing input validation

## Logging

Winston logger writes to:
- `logs/combined.log`: All logs
- `logs/error.log`: Error-level logs only
- Console: Development environment

To view logs:
```bash
tail -f logs/combined.log
# or for errors only
tail -f logs/error.log
```

## Docker Integration

The system uses Dockerode to manage Docker containers directly. Admin users can:
- Manage any Docker container on the host
- Create OpenVPN containers with specific configurations
- Monitor container health and performance
- Pull images from Docker registries

**Security Warning**: Docker API access provides significant system control. Ensure proper authentication and authorization.

## Production Deployment Notes

1. Use docker-compose for consistent deployment
2. Configure reverse proxy (nginx/Apache) for SSL termination
3. Set NODE_ENV=production
4. Use strong JWT_SECRET
5. Configure proper SMTP credentials
6. Restrict Docker socket access
7. Set up log rotation for Winston logs
8. Regular database backups
9. Monitor application with health check endpoint: `/health`
