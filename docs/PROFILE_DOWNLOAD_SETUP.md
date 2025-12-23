# VPN Profile Download Setup Guide

This guide explains how to enable real-time VPN profile downloads from OpenVPN Access Server through the distribution system dashboard.

## Overview

The profile download system consists of two components:

1. **Profile Proxy Service** - Runs on the HOST machine with Docker access
2. **Backend API** - Communicates with the proxy service to serve profiles to users

## Architecture

```
User Browser
    ↓
Backend Container (port 3000)
    ↓
Profile Proxy Service (HOST - port 3001)
    ↓
OpenVPN Access Server Container
```

## Why a Proxy Service?

The backend container cannot directly access the Docker socket on Windows due to permission restrictions. The proxy service solves this by running on the host machine where Docker CLI has full access.

## Setup Instructions

### 1. Start the Profile Proxy Service

On the HOST machine, run:

```bash
cd c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam
node scripts/profile-proxy.js
```

You should see:

```
============================================================
OpenVPN Profile Generation Proxy Service
============================================================
Status: Running
Port: 3001
Container: openvpn-server
Time: 2025-10-15T17:52:07.541Z
============================================================

Available Endpoints:
  GET  /health
  GET  /user/exists?username=<username>
  POST /profile/userlogin
  POST /profile/autologin
============================================================
```

### 2. Verify Docker Access

Test that the proxy can communicate with Docker:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"ok","container":"openvpn-server"}
```

### 3. Test User Existence Check

```bash
curl "http://localhost:3001/user/exists?username=admin"
```

Expected response:
```json
{"exists":true}
```

### 4. Start/Restart Backend Container

If the backend is not running or needs to use the updated profile service:

```bash
cd c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam
docker-compose up -d backend
```

### 5. Verify Backend Can Reach Proxy

The backend uses `host.docker.internal` to connect to services on the host machine. This is automatically configured for Docker Desktop on Windows.

## Available API Endpoints

Once both services are running, users can access:

### User Endpoints (Authenticated)

**GET `/api/vpn/profile/info`**
- Check if user can download their profile
- Returns profile availability and metadata

**GET `/api/vpn/profile/download`**
- Download user's VPN profile (.ovpn file)
- Requires authenticated user with verified email
- Returns user-locked profile requiring password

### Admin Endpoints

**GET `/api/vpn/profile/autologin/:username`**
- Download autologin profile for any user
- No password required in VPN client
- Admin only

**POST `/api/vpn/profile/generate/:userId`**
- Generate profile for specific user ID
- Admin only

## Environment Variables

### Backend Container

Add these to `.env` if you need to customize:

```env
# Profile proxy service connection
PROFILE_PROXY_HOST=host.docker.internal
PROFILE_PROXY_PORT=3001
```

### Profile Proxy Service

```env
# Port to listen on
PROFILE_PROXY_PORT=3001

# OpenVPN container name
OPENVPN_CONTAINER_NAME=openvpn-server
```

## Testing Profile Download

### Using curl:

```bash
# 1. Login to get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.data.token')

# 2. Check profile info
curl -s http://localhost:3000/api/vpn/profile/info \
  -H "Authorization: Bearer $TOKEN" | jq .

# 3. Download profile
curl http://localhost:3000/api/vpn/profile/download \
  -H "Authorization: Bearer $TOKEN" \
  -o admin_profile.ovpn
```

### Expected Response for Profile Info:

```json
{
  "success": true,
  "data": {
    "username": "admin",
    "email": "admin@example.com",
    "emailVerified": 1,
    "vpnAccountExists": true,
    "canDownload": true,
    "profileType": "userlogin",
    "requiresPassword": true
  }
}
```

### Expected Profile Download:

```bash
# Check downloaded file
head -20 admin_profile.ovpn

# Should contain:
# client
# dev tun
# proto udp
# remote <server-ip> 1194
# ... (valid OpenVPN configuration)
```

## Troubleshooting

### Profile Proxy Service Won't Start

**Error**: `EADDRINUSE: address already in use :::3001`

**Solution**: Kill the existing process:
```bash
# Find PID
netstat -ano | findstr ":3001"

# Kill process
taskkill //F //PID <PID>
```

### Docker Not Accessible

**Error**: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`

**Solution**:
1. Ensure Docker Desktop is running
2. Restart Docker Desktop
3. Try running from PowerShell or CMD instead of Git Bash

### Backend Can't Reach Proxy

**Error in logs**: `Profile proxy unreachable: ECONNREFUSED`

**Solutions**:
1. Verify proxy service is running (`curl http://localhost:3001/health`)
2. Check Windows Firewall isn't blocking port 3001
3. Ensure Docker Desktop has "Expose daemon on tcp://localhost:2375" disabled (we use named pipe)

### User Shows "vpnAccountExists: false"

**Causes**:
1. User not synced to OpenVPN AS
2. Username in database doesn't match OpenVPN username

**Solution**: Run user sync:
```bash
node scripts/sync-users.js
```

## Running Proxy as a Service (Production)

### Using PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start proxy service
pm2 start scripts/profile-proxy.js --name vpn-profile-proxy

# Enable startup on boot
pm2 startup
pm2 save
```

### Using Windows Task Scheduler:

1. Open Task Scheduler
2. Create Basic Task
3. Trigger: "When the computer starts"
4. Action: "Start a program"
5. Program: `C:\Program Files\nodejs\node.exe`
6. Arguments: `scripts\profile-proxy.js`
7. Start in: `c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam`

## Security Considerations

1. **Profile Proxy Port**: Consider restricting access to localhost only
2. **Authentication**: The backend handles JWT authentication before allowing downloads
3. **Docker Socket**: Proxy has full Docker access - secure the proxy service
4. **HTTPS**: In production, use HTTPS for both backend and proxy
5. **Firewall**: Ensure only backend can access proxy port 3001

## Files Modified/Created

- `scripts/profile-proxy.js` - HTTP proxy service for profile generation
- `src/services/openvpnProfileService.js` - Updated to use proxy via HTTP
- `src/controllers/vpnProfileController.js` - Profile download endpoints
- `src/routes/openvpnRoutes.js` - Added profile routes
- `Dockerfile` - Added Docker CLI installation (not strictly needed with proxy)

## Next Steps

1. Integrate profile download button in frontend dashboard
2. Add profile download tracking to database
3. Implement profile revocation/regeneration
4. Add email notification when profile is ready
5. Consider rate limiting profile generation

## Support

For issues or questions:
1. Check backend logs: `docker logs openvpn-backend`
2. Check proxy logs: View terminal where proxy is running
3. Test proxy directly: `curl http://localhost:3001/health`
4. Verify OpenVPN container: `docker ps | grep openvpn`
