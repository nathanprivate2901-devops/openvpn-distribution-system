# OpenVPN Distribution System

A comprehensive full-stack system for managing and distributing OpenVPN configurations with advanced user management, device tracking, QoS policies, LAN network routing, and Docker container orchestration.

## Features

### Core Features
- 🔐 User registration and authentication with JWT
- ✉️ Email verification and password reset system
- 👥 Role-based access control (User/Admin)
- 📦 OpenVPN configuration file generation and distribution
- 🎯 QoS (Quality of Service) policy management and assignment
- 🔒 Rate limiting and comprehensive security hardening
- 🌐 RESTful API architecture
- 🐳 Full Docker and Docker Compose support

### Advanced Features
- 📱 Device management and tracking (multiple devices per user)
- 🌐 LAN network routing configuration
- 🐳 Docker container management via API
- 📊 Real-time monitoring and statistics
- 🔄 User synchronization system
- 🎨 Modern Next.js 14 frontend with TypeScript
- 📈 Built-in testing suite

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MySQL >= 8.0
- SMTP server for email delivery
- OpenVPN server (separate installation)
- Docker and Docker Compose (for containerized deployment)

## Quick Start

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd openvpn-distribution-system
```

2. Set up environment variables:
```bash
# Copy the example env file
cp .env.example .env
# Edit .env with your configuration
```

3. Start the services:
```bash
# Development environment
docker-compose -f docker-compose.dev.yml up -d

# Production environment
docker-compose up -d
```

4. Access the application:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Admin credentials: admin / admin123 (change immediately!)

### Manual Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd openvpn-distribution-system
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=openvpn_system

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_email_password
EMAIL_FROM=noreply@yourdomain.com

# Application URLs
FRONTEND_URL=http://localhost:3001
API_URL=http://localhost:3000/api

# OpenVPN Configuration
OPENVPN_SERVER=your.vpn.server.com
OPENVPN_PORT=1194
OPENVPN_PROTOCOL=udp

# Docker Configuration
DOCKER_SOCKET_PATH=/var/run/docker.sock

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

4. Set up the database:
```bash
# Run the database setup script
mysql -u root -p < migrations/database-setup.sql
```

5. Start the backend server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

6. Start the frontend (in a separate terminal):
```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
openvpn-distribution-system/
├── src/                          # Backend source code
│   ├── index.js                  # Main application entry
│   ├── config/                   # Configuration files
│   ├── controllers/              # Business logic controllers
│   ├── routes/                   # API route definitions
│   ├── models/                   # Database models & queries
│   ├── middleware/               # Express middleware
│   └── utils/                    # Utility functions
├── frontend/                     # Next.js 14 frontend application
│   ├── app/                      # App router pages
│   ├── components/               # Reusable React components
│   ├── lib/                      # Frontend utilities
│   ├── store/                    # State management (Zustand)
│   └── types/                    # TypeScript type definitions
├── tests/                        # Test suites
│   └── sync/                     # Synchronization tests
├── migrations/                   # Database migration scripts
├── scripts/                      # Utility scripts
├── docs/                         # Documentation files
├── docker/                       # Docker-related files
│   └── openvpn-pam/             # OpenVPN PAM authentication
├── logs/                         # Application logs
├── docker-compose.yml            # Production Docker Compose
├── docker-compose.dev.yml        # Development Docker Compose
├── Dockerfile                    # Backend Docker image
├── package.json                  # Backend dependencies
└── README.md                     # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify-email` - Verify email with token
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### User Routes (Requires Authentication)
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/change-password` - Change user password
- `GET /api/users/vpn-config` - Download VPN configuration

### Device Management
- `GET /api/devices` - Get user's devices
- `POST /api/devices` - Register a new device
- `PUT /api/devices/:id` - Update device information
- `DELETE /api/devices/:id` - Remove device

### Admin Routes (Requires Admin Role)
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user by ID
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/devices` - Get all devices across system

### OpenVPN Routes (Requires Authentication)
- `POST /api/vpn/generate-config` - Generate new VPN config
- `GET /api/vpn/config/:id` - Get specific config file
- `DELETE /api/vpn/config/:id` - Revoke config file
- `GET /api/vpn/download/:userId` - Download user's VPN profile

### QoS Routes (Admin Only)
- `GET /api/qos/policies` - Get all QoS policies
- `POST /api/qos/policies` - Create QoS policy
- `PUT /api/qos/policies/:id` - Update QoS policy
- `DELETE /api/qos/policies/:id` - Delete QoS policy
- `POST /api/qos/assign` - Assign QoS to user
- `GET /api/qos/users/:userId` - Get user's QoS assignment

### LAN Network Routes
- `GET /api/lan-networks` - Get user's LAN networks
- `POST /api/lan-networks` - Create LAN network
- `PUT /api/lan-networks/:id` - Update LAN network
- `DELETE /api/lan-networks/:id` - Delete LAN network

### Docker Management (Admin Only)
- `GET /api/docker/containers` - List all containers
- `GET /api/docker/containers/:id` - Get container details
- `POST /api/docker/containers/:id/start` - Start container
- `POST /api/docker/containers/:id/stop` - Stop container
- `POST /api/docker/containers/:id/restart` - Restart container

## Docker Deployment

### Using Docker Compose (Recommended)

The project includes both development and production Docker Compose configurations:

**Development:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Production:**
```bash
docker-compose up -d
```

### Manual Docker Build

Build and run with Docker manually:

```bash
# Build backend image
docker build -t openvpn-backend .

# Build frontend image
cd frontend
docker build -t openvpn-frontend .

# Run backend container
docker run -d \
  --name openvpn-backend \
  -p 3000:3000 \
  --env-file .env \
  openvpn-backend

# Run frontend container
docker run -d \
  --name openvpn-frontend \
  -p 3001:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:3000 \
  openvpn-frontend
```

### Docker Compose Configuration

Example `docker-compose.yml`:

```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - mysql
    volumes:
      - ./logs:/app/logs

  frontend:
    build: ./frontend
    ports:
      - "3001:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    depends_on:
      - backend

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "3306:3306"

volumes:
  mysql_data:
```

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:sync          # Synchronization tests
npm run test:integration   # Integration tests
npm run test:unit          # Unit tests

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Security Considerations

1. **Change default credentials immediately** - Default admin password must be changed
2. **Use strong JWT secret keys** - Generate cryptographically secure secrets
3. **Enable HTTPS in production** - Use SSL/TLS certificates
4. **Configure firewall rules** - Restrict access to necessary ports only
5. **Regularly update dependencies** - Keep all packages up to date
6. **Use environment variables** - Never commit sensitive data
7. **Implement proper logging** - Monitor for security events
8. **Rate limiting** - Configured to prevent abuse
9. **Input validation** - All user inputs are sanitized
10. **SQL injection protection** - Parameterized queries throughout
11. **XSS prevention** - Content Security Policy headers
12. **CSRF protection** - Token-based validation

### Security Features Implemented
- ✅ Helmet.js security headers
- ✅ CORS configuration
- ✅ Rate limiting on all endpoints
- ✅ Input sanitization and validation
- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ Role-based access control
- ✅ SQL injection prevention
- ✅ XSS protection

## Technology Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MySQL 8.0
- **Authentication:** JWT (jsonwebtoken)
- **Security:** Helmet, CORS, bcrypt
- **Validation:** express-validator
- **Email:** Nodemailer
- **Docker Management:** Dockerode
- **Task Scheduling:** node-cron

### Frontend
- **Framework:** Next.js 14
- **Language:** TypeScript
- **UI Library:** React 18
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Forms:** React Hook Form + Zod
- **API Client:** Axios + TanStack Query
- **UI Components:** Radix UI
- **Icons:** Lucide React
- **Charts:** Recharts

### DevOps
- **Containerization:** Docker & Docker Compose
- **Testing:** Mocha, Chai
- **Process Management:** PM2
- **Logging:** Morgan

## Documentation

Comprehensive documentation is available in the `docs/` folder:

- **[Quick Start Guide](docs/QUICKSTART.md)** - Get started quickly
- **[Docker Deployment](docs/DOCKER-DEPLOYMENT.md)** - Docker setup guide
- **[API Documentation](docs/DOCKER_API.md)** - Complete API reference
- **[Security Guide](docs/SECURITY_QUICK_REFERENCE.md)** - Security best practices
- **[Testing Guide](docs/TESTING-QUICK-START.md)** - Testing strategy
- **[LAN Networks](docs/LAN_NETWORKS_USER_GUIDE.md)** - LAN routing setup
- **[Device Management](docs/DEVICE_MANAGEMENT_COMPLETE.md)** - Device tracking

## Available Scripts

### Backend
```bash
npm start              # Start production server
npm run dev            # Start development server with nodemon
npm test               # Run test suite
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report
npm run lint           # Lint code
npm run format         # Format code with prettier
```

### Frontend
```bash
npm run dev            # Start development server
npm run build          # Build for production
npm start              # Start production server
npm run lint           # Lint code
npm run type-check     # TypeScript type checking
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

**Database Connection Failed:**
- Verify MySQL is running
- Check database credentials in `.env`
- Ensure database exists and migrations are run

**Docker Container Won't Start:**
- Check logs: `docker logs openvpn-backend`
- Verify environment variables
- Ensure ports are not in use

**Frontend Can't Connect to Backend:**
- Verify backend is running on correct port
- Check CORS configuration
- Ensure `NEXT_PUBLIC_API_URL` is set correctly

**VPN Config Download Fails:**
- Check OpenVPN server configuration
- Verify user has necessary permissions
- Check logs for specific errors

## Performance Optimization

- **Frontend:** Static generation with Next.js for optimal performance
- **Backend:** Connection pooling for database
- **Caching:** Query results cached where appropriate
- **Rate Limiting:** Prevents API abuse
- **Docker:** Multi-stage builds for smaller images

## Project Status

✅ **Production Ready** - All core features implemented and tested

### Recent Updates
- ✅ Full device management system
- ✅ LAN network routing configuration
- ✅ Docker container orchestration
- ✅ Comprehensive security hardening
- ✅ Modern Next.js 14 frontend with TypeScript
- ✅ Complete test coverage
- ✅ Production-ready Docker deployment

## Project Structure

```
openvpn-distribution-system/
├── src/                          # Backend source code
│   ├── index.js                  # Main application entry
│   ├── config/                   # Configuration files
│   ├── controllers/              # Business logic controllers
│   ├── routes/                   # API route definitions
│   ├── models/                   # Database models & queries
│   ├── middleware/               # Express middleware
│   └── utils/                    # Utility functions
├── frontend/                     # Next.js 14 frontend application
│   ├── app/                      # App router pages
│   ├── components/               # Reusable React components
│   ├── lib/                      # Frontend utilities
│   ├── store/                    # State management (Zustand)
│   └── types/                    # TypeScript type definitions
├── tests/                        # Test suites
│   └── sync/                     # Synchronization tests
├── migrations/                   # Database migration scripts
├── scripts/                      # Utility scripts
├── docs/                         # Documentation files
├── docker/                       # Docker-related files
│   └── openvpn-pam/             # OpenVPN PAM authentication
├── logs/                         # Application logs
├── docker-compose.yml            # Production Docker Compose
├── docker-compose.dev.yml        # Development Docker Compose
├── Dockerfile                    # Backend Docker image
├── package.json                  # Backend dependencies
└── README.md                     # This file
```

## License

ISC

## Authors

- Nathan Private - Initial work and maintenance

## Acknowledgments

- OpenVPN community for excellent VPN software
- Express.js and Next.js teams for robust frameworks
- All contributors who have helped improve this project

## Support

For issues, questions, or feature requests:
- Open an issue in the repository
- Check existing documentation in the `docs/` folder
- Review troubleshooting section above

## Roadmap

### Planned Features
- [ ] Multi-factor authentication (MFA)
- [ ] Advanced analytics dashboard
- [ ] API rate limiting per user
- [ ] Automated backup system
- [ ] Mobile app support
- [ ] Webhook integrations
- [ ] Advanced logging with ELK stack

### Completed Features
- [x] User authentication and authorization
- [x] Device management system
- [x] QoS policy management
- [x] LAN network routing
- [x] Docker container management
- [x] Email verification system
- [x] Password reset functionality
- [x] Modern TypeScript frontend
- [x] Comprehensive security hardening
- [x] Full Docker deployment support

---

**Built with ❤️ for secure VPN distribution management**
