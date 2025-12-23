# OpenVPN Distribution System

A secure backend system for distributing OpenVPN configuration files with user authentication, email verification, admin controls, and QoS policy management.

## Features

- User registration and authentication with JWT
- Email verification system
- Role-based access control (User/Admin)
- OpenVPN configuration file generation and distribution
- QoS (Quality of Service) policy management
- Rate limiting and security hardening
- RESTful API architecture
- Docker support

## Prerequisites

- Node.js >= 18.0.0
- MySQL >= 8.0
- SMTP server for email delivery
- OpenVPN server (separate installation)

## Installation

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
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3000/api

# OpenVPN Configuration
OPENVPN_SERVER=your.vpn.server.com
OPENVPN_PORT=1194
OPENVPN_PROTOCOL=udp

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

4. Set up the database:
```sql
CREATE DATABASE openvpn_system;
USE openvpn_system;

-- Users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Verification tokens table
CREATE TABLE verification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Config files table
CREATE TABLE config_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  downloaded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- QoS policies table
CREATE TABLE qos_policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  max_bandwidth_mbps INT NOT NULL,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- User QoS assignments table
CREATE TABLE user_qos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  qos_policy_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (qos_policy_id) REFERENCES qos_policies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_qos (user_id)
);

-- Create default admin user (password: admin123 - CHANGE THIS!)
INSERT INTO users (username, email, password, role, is_verified)
VALUES ('admin', 'admin@example.com', '$2a$10$X5wKvZ5zQP.yH0YC3zqkHORgVJOv8kqBxnZ5KqYqBN4vKLxZqGNJy', 'admin', TRUE);
```

5. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify-email` - Verify email with token
- `POST /api/auth/resend-verification` - Resend verification email

### User Routes (Requires Authentication)
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/vpn-config` - Download VPN configuration

### Admin Routes (Requires Admin Role)
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user by ID
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/stats` - Get system statistics

### OpenVPN Routes (Requires Authentication)
- `POST /api/vpn/generate-config` - Generate new VPN config
- `GET /api/vpn/config/:id` - Get specific config file
- `DELETE /api/vpn/config/:id` - Revoke config file

### QoS Routes (Admin Only)
- `GET /api/qos/policies` - Get all QoS policies
- `POST /api/qos/policies` - Create QoS policy
- `PUT /api/qos/policies/:id` - Update QoS policy
- `DELETE /api/qos/policies/:id` - Delete QoS policy
- `POST /api/qos/assign` - Assign QoS to user

## Docker Deployment

Build and run with Docker:

```bash
# Build image
docker build -t openvpn-distribution .

# Run container
docker run -d \
  --name openvpn-backend \
  -p 3000:3000 \
  --env-file .env \
  openvpn-distribution
```

Or use Docker Compose (create `docker-compose.yml`):

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - mysql

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: openvpn_system
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

## Security Considerations

1. Change default admin password immediately
2. Use strong JWT secret keys
3. Enable HTTPS in production
4. Configure firewall rules
5. Regularly update dependencies
6. Use environment variables for sensitive data
7. Implement proper logging and monitoring

## Project Structure

```
backend/
├── src/
│   ├── index.js              # Main application entry
│   ├── config/               # Configuration files
│   ├── controllers/          # Business logic
│   ├── routes/               # API routes
│   ├── models/               # Database layer
│   ├── middleware/           # Express middleware
│   └── utils/                # Utility functions
├── Dockerfile
├── .dockerignore
├── package.json
└── README.md
```

## License

ISC

## Support

For issues and questions, please open an issue in the repository.
