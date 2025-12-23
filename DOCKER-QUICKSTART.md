# Docker Quick Start Guide

Get the entire OpenVPN Distribution System (Backend API + Frontend Web UI) running in 5 minutes!

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum
- 10GB disk space

**What You Get:**
- 🗄️ MySQL 8.0 Database
- 🚀 Node.js Backend API (Port 3000)
- 🎨 Next.js Frontend Web UI (Port 3001)

### Install Docker (Ubuntu/Debian)

```bash
# Update package index
sudo apt-get update

# Install dependencies
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

## Quick Start

### 1. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your settings
nano .env
```

**Important: Update these values in .env:**

- `JWT_SECRET` - Generate with: `openssl rand -base64 64`
- `DB_PASSWORD` - Strong database password
- `DB_ROOT_PASSWORD` - Strong root password
- `SMTP_*` - Your email service credentials
- `OPENVPN_SERVER` - Your VPN server domain/IP

### 2. Start Services

```bash
# Start all services in detached mode
docker compose up -d

# Expected output:
# [+] Running 4/4
#  ✔ Network openvpn-network     Created
#  ✔ Container openvpn-mysql     Started (healthy)
#  ✔ Container openvpn-backend   Started (healthy)
#  ✔ Container openvpn-frontend  Started
```

### 3. Verify Deployment

```bash
# Check container status
docker compose ps

# Expected output:
# NAME                STATUS              PORTS
# openvpn-mysql       Up (healthy)        3306/tcp (internal only)
# openvpn-backend     Up (healthy)        0.0.0.0:3000->3000/tcp
# openvpn-frontend    Up (healthy)        0.0.0.0:3001->3001/tcp

# Check backend logs
docker compose logs -f backend

# Check frontend logs
docker compose logs -f frontend

# Test backend health
curl http://localhost:3000/health
# Expected: {"status":"healthy","timestamp":"...","database":"connected"}

# Test frontend access
curl http://localhost:3001/
# Expected: HTML page content
```

### 4. Access the Application

**🎨 Web Interface (Recommended):**
Open your browser and navigate to: http://localhost:3001

**Default Login Credentials:**
- Email: `admin@example.com`
- Password: `admin123`

**🔧 API Access (For developers):**
```bash
# Login via API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Save the token from response
export TOKEN="your_jwt_token_here"

# Get system stats
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer $TOKEN"
```

⚠️ **CRITICAL:** Change the default admin password immediately after first login!

## Common Operations

### View Logs

```bash
# All services
docker compose logs -f

# Backend only
docker compose logs -f backend

# MySQL only
docker compose logs -f mysql

# Last 100 lines
docker compose logs --tail=100 backend
```

### Restart Services

```bash
# Restart all services
docker compose restart

# Restart backend only
docker compose restart backend

# Restart MySQL only
docker compose restart mysql
```

### Stop Services

```bash
# Stop all services
docker compose stop

# Stop specific service
docker compose stop backend
```

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build

# Remove old images
docker image prune -f
```

### Database Operations

```bash
# Access MySQL shell
docker compose exec mysql mysql -u root -p

# Backup database
docker compose exec mysql mysqldump -u root -p openvpn_db > backup.sql

# Restore database
docker compose exec -T mysql mysql -u root -p openvpn_db < backup.sql

# View database logs
docker compose logs -f mysql
```

### Clean Up

```bash
# Stop and remove containers
docker compose down

# Remove containers and volumes (WARNING: deletes all data!)
docker compose down -v

# Remove everything including images
docker compose down -v --rmi all
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker compose logs backend

# Check MySQL readiness
docker compose exec mysql mysqladmin ping -h localhost -u root -p

# Verify environment variables
docker compose config
```

### Database Connection Issues

```bash
# Check MySQL is healthy
docker compose ps mysql

# Test database connection
docker compose exec mysql mysql -u openvpn_user -p openvpn_db

# Check backend environment
docker compose exec backend env | grep DB_
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Permission Issues

```bash
# Fix logs directory permissions
mkdir -p logs
chmod 755 logs

# Fix Docker socket permissions (for Docker API features)
sudo chmod 666 /var/run/docker.sock
```

### Reset Everything

```bash
# Complete reset (WARNING: destroys all data!)
docker compose down -v
rm -rf logs/*
docker compose up -d --build
```

## Docker Architecture

### Services

1. **mysql** - MySQL 8.0 database
   - Port: 3306 (internal only - not exposed to host)
   - Volume: mysql_data (persistent storage)
   - Health checks enabled
   - Auto-initialization with schema

2. **backend** - Node.js/Express API
   - Port: 3000 (exposed to host)
   - Depends on MySQL
   - Mounted logs directory
   - Docker socket access for container management
   - Health checks enabled
   - RESTful API with JWT authentication

3. **frontend** - Next.js Web Application
   - Port: 3001 (exposed to host)
   - Depends on Backend
   - Server-side rendering (SSR)
   - API proxy to backend service
   - Health checks enabled
   - Modern React UI with TypeScript

### Networks

- **openvpn-network** - Bridge network for service communication

### Volumes

- **mysql_data** - Persistent MySQL data storage
- **./logs** - Application logs (host mounted)

## Production Deployment

### Security Hardening

1. **Change Default Credentials**
```bash
# Update .env with strong passwords
JWT_SECRET=$(openssl rand -base64 64)
DB_PASSWORD=$(openssl rand -base64 32)
DB_ROOT_PASSWORD=$(openssl rand -base64 32)
```

2. **Restrict Docker Socket Access**
```bash
# Create Docker group
sudo groupadd docker
sudo usermod -aG docker $USER

# Secure socket
sudo chmod 660 /var/run/docker.sock
```

3. **Enable Firewall**
```bash
# Allow only necessary ports
sudo ufw allow 3000/tcp
sudo ufw allow 3306/tcp from 172.18.0.0/16
sudo ufw enable
```

4. **Set up SSL/TLS**
```bash
# Use nginx as reverse proxy
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# nginx will handle SSL termination
```

### Monitoring

```bash
# Resource usage
docker stats

# Container health
docker compose ps

# Application metrics
curl http://localhost:3000/api/admin/stats -H "Authorization: Bearer $TOKEN"
```

### Backup Strategy

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/openvpn-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database
docker compose exec -T mysql mysqldump -u root -p"$DB_ROOT_PASSWORD" --all-databases > "$BACKUP_DIR/database.sql"

# Backup environment
cp .env "$BACKUP_DIR/.env"

# Backup logs
cp -r logs "$BACKUP_DIR/logs"

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x backup.sh
```

### Auto-start on Boot

```bash
# Create systemd service
sudo nano /etc/systemd/system/openvpn-system.service
```

```ini
[Unit]
Description=OpenVPN Distribution System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/project
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# Enable service
sudo systemctl enable openvpn-system.service
sudo systemctl start openvpn-system.service
```

## Performance Tuning

### MySQL Optimization

Edit `docker-compose.yml` MySQL command section:

```yaml
command: >
  --default-authentication-plugin=mysql_native_password
  --character-set-server=utf8mb4
  --collation-server=utf8mb4_unicode_ci
  --max-connections=500
  --max-allowed-packet=128M
  --innodb-buffer-pool-size=1G
  --innodb-log-file-size=256M
```

### Node.js Optimization

Add to backend environment in `docker-compose.yml`:

```yaml
NODE_OPTIONS: "--max-old-space-size=2048"
UV_THREADPOOL_SIZE: "8"
```

## Support

- **Documentation:** See README.md and PROJECT-SUMMARY.md
- **Issues:** Check logs with `docker compose logs -f`
- **Health:** Monitor `/health` endpoint
- **Stats:** Check `/api/admin/stats` endpoint

## Quick Reference

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Logs
docker compose logs -f backend

# Restart
docker compose restart backend

# Rebuild
docker compose up -d --build

# Shell access
docker compose exec backend sh

# Database access
docker compose exec mysql mysql -u root -p

# Status
docker compose ps

# Stats
docker stats
```
