# Quick Start Guide

Get the OpenVPN Distribution System up and running in minutes!

## Prerequisites

- Node.js >= 18.0.0
- MySQL >= 8.0
- Docker and Docker Compose (optional)

## Option 1: Quick Start with Docker Compose (Recommended)

1. Clone the repository and navigate to the directory:
```bash
cd openvpn-distribution-system
```

2. Copy the environment file and configure it:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Start everything with Docker Compose:
```bash
docker-compose up -d
```

4. Check the logs:
```bash
docker-compose logs -f backend
```

5. Access the API at `http://localhost:3000`

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

# Run the setup script
source database-setup.sql

# Or pipe it directly
mysql -u root -p < database-setup.sql
```

### Step 4: Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

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
- `GET /api/auth/me` - Get current user

### User Management
- `GET /api/users/profile` - Get profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/dashboard` - Get dashboard

### VPN Configuration
- `POST /api/vpn/generate-config` - Generate VPN config
- `GET /api/vpn/configs` - List configs
- `GET /api/vpn/config/:id` - Download config

### Admin (Requires Admin Role)
- `GET /api/admin/users` - List all users
- `GET /api/admin/stats` - System statistics
- `PUT /api/admin/users/:id` - Update user

### QoS Management (Admin)
- `GET /api/qos/policies` - List QoS policies
- `POST /api/qos/policies` - Create policy
- `POST /api/qos/assign` - Assign policy to user

## Environment Variables

### Required
- `JWT_SECRET` - Secret key for JWT tokens
- `DB_PASSWORD` - Database password
- `SMTP_USER` - Email service username
- `SMTP_PASSWORD` - Email service password

### Optional
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `OPENVPN_SERVER` - Your VPN server address
- `OPENVPN_PORT` - VPN server port (default: 1194)

## Next Steps

1. **Change Admin Password**
   - Login as admin
   - Use `PUT /api/users/password` endpoint

2. **Configure Email Service**
   - Set up SMTP credentials in `.env`
   - Test with user registration

3. **Set Up QoS Policies**
   - Create custom policies via admin panel
   - Assign policies to users

4. **Configure OpenVPN Integration**
   - Update `OPENVPN_SERVER` in `.env`
   - Replace certificate placeholders in config generation

5. **Set Up SSL/TLS**
   - Use reverse proxy (nginx/Apache)
   - Configure HTTPS for production

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
