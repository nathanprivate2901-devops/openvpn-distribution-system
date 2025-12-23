# Docker Deployment Guide

Complete guide for deploying the OpenVPN Distribution System with Docker, including both backend and frontend services.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Services](#services)
- [Environment Configuration](#environment-configuration)
- [Building and Running](#building-and-running)
- [Accessing Services](#accessing-services)
- [Health Checks](#health-checks)
- [Logs and Monitoring](#logs-and-monitoring)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The application consists of three main services orchestrated by Docker Compose:

1. **MySQL Database** - Persistent data storage
2. **Node.js Backend** - REST API server (Port 3000)
3. **Next.js Frontend** - Web application (Port 3001)

All services run in isolated containers on a shared Docker network for secure communication.

## Prerequisites

- Docker Engine 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose 2.0+ (included with Docker Desktop)
- 2GB+ available RAM
- 5GB+ available disk space

Verify installation:
```bash
docker --version
docker-compose --version
```

## Quick Start

### 1. Clone and Configure

```bash
# Navigate to project directory
cd /mnt/e/MYCOMPANY/TNam

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor
```

**Required Environment Variables:**
```bash
JWT_SECRET=your-strong-secret-here-min-32-chars
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### 2. Build and Start Services

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 3. Access the Application

- **Frontend (Web UI):** http://localhost:3001
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health
- **Default Login:** admin@example.com / admin123

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Host                          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         openvpn-network (Bridge Network)           │ │
│  │                                                     │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │ │
│  │  │   MySQL      │  │   Backend    │  │ Frontend │ │ │
│  │  │   :3306      │◄─┤   :3000      │◄─┤  :3001   │ │ │
│  │  │  (internal)  │  │  (exposed)   │  │(exposed) │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │ │
│  │         ▲                   ▲              ▲       │ │
│  │         │                   │              │       │ │
│  │    mysql_data          ./logs         (no vol)    │ │
│  │     (volume)           (bind)                      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Host Ports:                                            │
│  - 3000 → Backend API                                   │
│  - 3001 → Frontend Web UI                               │
└─────────────────────────────────────────────────────────┘
```

## Services

### MySQL Database Service

**Container:** `openvpn-mysql`
**Image:** `mysql:8.0`
**Internal Port:** 3306 (NOT exposed to host for security)
**Volume:** `mysql_data` (persistent storage)

**Features:**
- Automated schema initialization from `database-setup.sql`
- Health checks with 30s start period
- Optimized for 200 concurrent connections
- Character set: utf8mb4 with Unicode collation

**Health Check:**
```bash
docker exec openvpn-mysql mysqladmin ping -h localhost -u root -p<password>
```

### Backend API Service

**Container:** `openvpn-backend`
**Image:** Custom (built from root Dockerfile)
**Port:** 3000 (exposed to host)
**Depends On:** MySQL (waits for healthy status)

**Features:**
- Multi-stage build for optimized image size
- Non-root user execution (nodejs:1001)
- Health endpoint: `/health`
- Automatic restart on failure
- Docker socket access for container management (admin only)

**Health Check:**
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-14T12:00:00.000Z",
  "uptime": 123.45,
  "database": "connected"
}
```

### Frontend Web Service

**Container:** `openvpn-frontend`
**Image:** Custom (built from frontend/Dockerfile)
**Port:** 3001 (exposed to host)
**Depends On:** Backend (waits for healthy status)

**Features:**
- Next.js standalone build for optimal performance
- Server-side rendering (SSR) enabled
- API requests proxied to backend service
- Non-root user execution (nextjs:1001)
- Automatic restart on failure

**Health Check:**
```bash
curl http://localhost:3001/
```

## Environment Configuration

### Backend Environment Variables

**Required:**
```bash
JWT_SECRET=<strong-secret-minimum-32-characters>
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

**Database (Auto-configured for Docker):**
```bash
DB_HOST=mysql  # Service name, not localhost
DB_PORT=3306
DB_NAME=openvpn_system
DB_USER=openvpn_user
DB_PASSWORD=openvpn_secure_password_123
DB_ROOT_PASSWORD=root_secure_password_456
```

**Optional:**
```bash
NODE_ENV=production
PORT=3000
FRONTEND_PORT=3001
OPENVPN_SERVER=vpn.example.com
CORS_ORIGIN=http://localhost:3001
```

### Frontend Environment Variables

**Automatically Set by Docker Compose:**
```bash
NODE_ENV=production
PORT=3001
NEXT_PUBLIC_API_URL=http://backend:3000  # Internal service name
```

**For Local Development (frontend/.env.local):**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000  # Host access
```

## Building and Running

### Start All Services

```bash
# Start in background (detached mode)
docker-compose up -d

# Start with logs visible
docker-compose up

# Start specific service
docker-compose up -d backend
docker-compose up -d frontend
```

### Build/Rebuild Images

```bash
# Rebuild all images
docker-compose build

# Rebuild without cache
docker-compose build --no-cache

# Rebuild specific service
docker-compose build backend
docker-compose build frontend
```

### Stop Services

```bash
# Stop all services
docker-compose stop

# Stop specific service
docker-compose stop frontend

# Stop and remove containers (preserves volumes)
docker-compose down

# Stop, remove containers, and delete volumes (DANGER: data loss)
docker-compose down -v
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend

# Restart with rebuild
docker-compose up -d --build
```

## Accessing Services

### Frontend Web Interface

**URL:** http://localhost:3001

**Default Credentials:**
- Email: admin@example.com
- Password: admin123

**Important:** Change the default admin password immediately after first login!

### Backend API

**Base URL:** http://localhost:3000

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Login Example:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

**Using Token:**
```bash
TOKEN="your-jwt-token-here"

curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer $TOKEN"
```

### Database Access

**Internal Access (from backend container):**
```bash
docker exec -it openvpn-backend sh
mysql -h mysql -u openvpn_user -p openvpn_system
```

**Direct Access (from host):**
```bash
docker exec -it openvpn-mysql mysql -u root -p
```

Enter password: `root_secure_password_456` (or your configured value)

## Health Checks

All services include health checks that Docker monitors automatically.

### Check Service Health

```bash
# View health status
docker-compose ps

# Detailed health info
docker inspect openvpn-backend | jq '.[0].State.Health'
docker inspect openvpn-frontend | jq '.[0].State.Health'
docker inspect openvpn-mysql | jq '.[0].State.Health'
```

### Health Check Details

**MySQL:**
- Interval: 10s
- Timeout: 5s
- Retries: 5
- Start Period: 30s

**Backend:**
- Interval: 30s
- Timeout: 10s
- Retries: 3
- Start Period: 40s

**Frontend:**
- Interval: 30s
- Timeout: 10s
- Retries: 3
- Start Period: 60s

## Logs and Monitoring

### View Logs

```bash
# All services (live tail)
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql

# Last 100 lines
docker-compose logs --tail=100 backend

# Since specific time
docker-compose logs --since="2024-01-01T00:00:00" backend
```

### Backend Application Logs

**Location:** `./logs/` (mounted volume)

```bash
# View combined logs
tail -f logs/combined.log

# View error logs only
tail -f logs/error.log

# Search logs
grep "ERROR" logs/combined.log
```

### Resource Usage

```bash
# Container stats (CPU, memory, network)
docker stats

# Specific container
docker stats openvpn-backend openvpn-frontend
```

### Disk Usage

```bash
# Docker system overview
docker system df

# Detailed volume info
docker volume ls
docker volume inspect openvpn-mysql-data
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] **Strong JWT Secret:** Generate with `openssl rand -base64 64`
- [ ] **Change Default Passwords:** Admin password, database passwords
- [ ] **Configure SMTP:** Valid email service credentials
- [ ] **Set NODE_ENV=production**
- [ ] **Configure CORS:** Restrict allowed origins
- [ ] **Enable HTTPS:** Use reverse proxy (nginx/Traefik)
- [ ] **Set Up Backups:** Automated database backups
- [ ] **Configure Monitoring:** Health checks, alerts
- [ ] **Review Security:** Docker socket access, volume mounts
- [ ] **Update .env:** Production-specific values

### Environment Variables for Production

```bash
# .env (production)
NODE_ENV=production
PORT=3000
FRONTEND_PORT=3001

# Strong security
JWT_SECRET=$(openssl rand -base64 64)
DB_PASSWORD=$(openssl rand -base64 32)
DB_ROOT_PASSWORD=$(openssl rand -base64 32)

# Production SMTP
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<your-sendgrid-api-key>

# Restrict CORS
CORS_ORIGIN=https://yourdomain.com

# Production URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com
```

### Reverse Proxy (Nginx Example)

```nginx
# /etc/nginx/sites-available/openvpn-system

# Frontend
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }
}
```

Add SSL with Certbot:
```bash
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

### Database Backup

**Automated Backup Script:**

```bash
#!/bin/bash
# backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backup/mysql
mkdir -p $BACKUP_DIR

docker exec openvpn-mysql mysqldump \
  -u root \
  -p${DB_ROOT_PASSWORD} \
  --all-databases \
  --single-transaction \
  --quick \
  --lock-tables=false \
  > $BACKUP_DIR/backup_$DATE.sql

# Compress
gzip $BACKUP_DIR/backup_$DATE.sql

# Delete backups older than 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/backup_$DATE.sql.gz"
```

**Schedule with Cron:**
```bash
# Daily at 2 AM
0 2 * * * /path/to/backup-database.sh
```

### Monitoring and Alerts

**Health Check Monitoring:**

```bash
#!/bin/bash
# health-check.sh

# Check backend
if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "Backend is unhealthy!" | mail -s "Alert: Backend Down" admin@example.com
fi

# Check frontend
if ! curl -f http://localhost:3001/ > /dev/null 2>&1; then
    echo "Frontend is unhealthy!" | mail -s "Alert: Frontend Down" admin@example.com
fi

# Check database
if ! docker exec openvpn-mysql mysqladmin ping -h localhost -u root -p${DB_ROOT_PASSWORD} > /dev/null 2>&1; then
    echo "Database is unhealthy!" | mail -s "Alert: Database Down" admin@example.com
fi
```

**Schedule with Cron:**
```bash
# Every 5 minutes
*/5 * * * * /path/to/health-check.sh
```

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
docker-compose logs backend
docker-compose logs frontend
```

**Common issues:**
- Missing JWT_SECRET environment variable
- Database not ready (backend starts too early)
- Port already in use
- Insufficient resources

**Solutions:**
```bash
# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d

# Check port conflicts
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :3306

# Increase wait time
# Edit docker-compose.yml healthcheck start_period
```

### Database Connection Errors

**Symptoms:**
- Backend logs show "ECONNREFUSED"
- Health check fails

**Solutions:**
```bash
# Verify MySQL is running
docker-compose ps mysql

# Check MySQL logs
docker-compose logs mysql

# Verify credentials
docker exec -it openvpn-mysql mysql -u openvpn_user -p

# Reset database
docker-compose down
docker volume rm openvpn-mysql-data
docker-compose up -d
```

### Frontend Can't Reach Backend

**Symptoms:**
- Frontend shows "Network Error"
- API calls fail

**Check network connectivity:**
```bash
# From frontend container
docker exec -it openvpn-frontend sh
curl http://backend:3000/health

# From host
curl http://localhost:3000/health
```

**Verify environment variables:**
```bash
docker exec openvpn-frontend printenv | grep API
```

**Solutions:**
- Ensure NEXT_PUBLIC_API_URL is set correctly
- Verify backend is healthy: `docker-compose ps`
- Check Docker network: `docker network inspect openvpn-network`

### Container Keeps Restarting

**Check health status:**
```bash
docker-compose ps
docker inspect openvpn-backend | jq '.[0].State'
```

**View recent logs:**
```bash
docker-compose logs --tail=50 backend
```

**Common causes:**
- Application crash on startup
- Failed health checks
- Missing dependencies
- Environment variable errors

### Out of Memory

**Check resource usage:**
```bash
docker stats
```

**Solutions:**
```bash
# Increase Docker memory limit (Docker Desktop)
# Settings → Resources → Memory → 4GB+

# Optimize MySQL buffer pool
# Edit docker-compose.yml:
# --innodb-buffer-pool-size=256M (reduce if needed)

# Clean up unused resources
docker system prune -a
```

### Permission Denied Errors

**Docker socket access:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Restart session
newgrp docker

# Verify
docker ps
```

**Volume permissions:**
```bash
# Fix logs directory
sudo chown -R $USER:$USER ./logs
chmod 755 ./logs
```

### Reset Everything

**Complete cleanup and restart:**
```bash
# Stop all services
docker-compose down

# Remove all containers, networks, images
docker-compose down --rmi all --volumes --remove-orphans

# Remove orphaned volumes
docker volume prune -f

# Rebuild and start fresh
docker-compose build --no-cache
docker-compose up -d

# Verify
docker-compose ps
docker-compose logs -f
```

## Useful Commands Reference

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop services
docker-compose stop

# Start services
docker-compose start

# Restart services
docker-compose restart

# Remove containers (keep volumes)
docker-compose down

# Remove everything including volumes
docker-compose down -v

# Execute command in container
docker exec -it openvpn-backend sh
docker exec -it openvpn-frontend sh

# View container details
docker inspect openvpn-backend

# Monitor resources
docker stats

# Clean up system
docker system prune -a
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [MySQL Docker Official Image](https://hub.docker.com/_/mysql)

---

**Need Help?**
- Check logs: `docker-compose logs -f`
- View health: `docker-compose ps`
- Inspect container: `docker inspect openvpn-backend`
- Submit issue: https://github.com/anthropics/claude-code/issues
