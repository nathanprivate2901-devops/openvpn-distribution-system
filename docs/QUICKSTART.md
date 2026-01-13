# Quick Start Guide

Get the OpenVPN Distribution System up and running in minutes!

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MySQL >= 8.0
- Docker and Docker Compose (recommended for deployment)
- SMTP server credentials (for email verification)

## Option 1: Quick Start with Docker Compose (Recommended)

1. Clone the repository and navigate to the directory:
```bash
git clone https://github.com/nathanprivate2901-devops/openvpn-distribution-system.git
cd openvpn-distribution-system
```

2. Copy the environment file and configure it:
```bash
cp .env.example .env
# Edit .env with your settings (database, SMTP, JWT secret, etc.)
```

3. Start everything with Docker Compose:
```bash
# Development environment
docker-compose -f docker-compose.dev.yml up -d

# Production environment
docker-compose up -d
```

4. Check the logs:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

5. Access the application:
   - **Frontend (Web UI):** http://localhost:3001
   - **Backend API:** http://localhost:3000
   - **Health Check:** http://localhost:3000/health

## Option 2: Manual Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
```bash
cp .env.example .env
# Edit .env with your database and SMTP settings
```

### Step 3: Set Up Database
```bash
# Login to MySQL
mysql -u root -p

# Run the setup script from migrations folder
source migrations/database-setup.sql

# Or pipe it directly
mysql -u root -p < migrations/database-setup.sql
```

### Step 4: Start the Backend Server
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Step 5: Start the Frontend (in a separate terminal)
```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:3001 and the backend API at http://localhost:3000

## Default Admin Credentials

**IMPORTANT:** Change these immediately after first login!

- Username: `admin`
- Email: `admin@example.com`
- Password: `admin123`

## Testing the Installation

### 1. Check Health Endpoint
```bash
curl http://localhost:3000/health
```

### 2. Login as Admin
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

### 3. Register a New User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123456"
  }'
```

## API Endpoints Overview

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### User Management
- `GET /api/users/profile` - Get profile
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/change-password` - Change password

### Device Management
- `GET /api/devices` - Get user's devices
- `POST /api/devices` - Register new device
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device

### VPN Configuration
- `POST /api/vpn/generate-config` - Generate VPN config
- `GET /api/vpn/configs` - List configs
- `GET /api/vpn/config/:id` - Download config
- `GET /api/vpn/download/:userId` - Download user's VPN profile

### LAN Networks
- `GET /api/lan-networks` - Get user's LAN networks
- `POST /api/lan-networks` - Create LAN network
- `PUT /api/lan-networks/:id` - Update LAN network
- `DELETE /api/lan-networks/:id` - Delete LAN network

### Admin (Requires Admin Role)
- `GET /api/admin/users` - List all users
- `GET /api/admin/stats` - System statistics
- `PUT /api/admin/users/:id` - Update user
- `GET /api/admin/devices` - Get all devices across system

### QoS Management (Admin)
- `GET /api/qos/policies` - List QoS policies
- `POST /api/qos/policies` - Create QoS policy
- `POST /api/qos/assign` - Assign QoS to user

### Docker Management (Admin)
- `GET /api/docker/containers` - List all containers
- `POST /api/docker/containers/:id/start` - Start container
- `POST /api/docker/containers/:id/stop` - Stop container
- `POST /api/docker/containers/:id/restart` - Restart container
- `POST /api/qos/policies` - Create policy
- `POST /api/qos/assign` - Assign policy to user

## Environment Variables

### Required
- `JWT_SECRET` - Secret key for JWT tokens (minimum 32 characters)
- `DB_PASSWORD` - Database password
- `SMTP_USER` - Email service username
- `SMTP_PASSWORD` - Email service password (use app-specific password for Gmail)

### Optional with Defaults
- `PORT` - Backend server port (default: 3000)
- `FRONTEND_URL` - Frontend URL (default: http://localhost:3001)
- `NODE_ENV` - Environment (development/production)
- `OPENVPN_SERVER` - Your VPN server address
- `OPENVPN_PORT` - VPN server port (default: 1194)
- `DOCKER_SOCKET_PATH` - Docker socket path (default: /var/run/docker.sock)

## Technology Stack

### Backend
- Node.js 18+ with Express.js
- MySQL 8.0 database
- JWT authentication
- Dockerode for container management

### Frontend
- Next.js 14 with TypeScript
- React 18
- Tailwind CSS
- Zustand for state management
- TanStack Query for data fetching

## Next Steps

1. **Change Admin Password Immediately**
   - Login to frontend at http://localhost:3001
   - Navigate to Profile → Change Password

2. **Configure Email Service**
   - Set up SMTP credentials in `.env`
   - For Gmail: Enable 2FA and generate app password
   - Test with user registration

3. **Set Up QoS Policies**
   - Access admin panel
   - Create custom policies
   - Assign policies to users

4. **Configure Device Management**
   - Users can register up to 3 devices by default
   - Admin can adjust device limits per user
   - Track device usage and connections

5. **Configure LAN Network Routing**
   - Users can add their LAN networks
   - System generates routing config automatically
   - Download updated VPN profiles

6. **Set Up SSL/TLS for Production**
   - Use reverse proxy (nginx/Apache)
   - Configure HTTPS with Let's Encrypt
   - Update FRONTEND_URL and API_URL

## Troubleshooting

### Database Connection Issues
```bash
# Check if MySQL is running
docker-compose ps mysql

# View MySQL logs
docker-compose logs mysql
```

### Email Not Sending
- Verify SMTP credentials in `.env`
- Check if less secure apps are enabled (Gmail)
- Consider using app-specific passwords

### Port Already in Use
```bash
# Change PORT in .env
PORT=8080

# Or stop the conflicting service
```

## Stopping the Server

### Docker Compose
```bash
docker-compose down
```

### Manual
Press `Ctrl+C` in the terminal where the server is running

## Support

- Check [README.md](README.md) for detailed documentation
- Review logs in `logs/` directory
- Open an issue on GitHub

## Security Reminders

- Change default admin password
- Use strong JWT_SECRET in production
- Enable HTTPS in production
- Keep dependencies updated
- Regular database backups
