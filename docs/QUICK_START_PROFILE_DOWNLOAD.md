# Quick Start: VPN Profile Download

## Current Status

✅ **Completed Implementation:**
- Profile proxy service created (`scripts/profile-proxy.js`)
- Backend service updated to use proxy (`src/services/openvpnProfileService.js`)
- API endpoints added (`src/routes/openvpnRoutes.js`)
- Controller implemented (`src/controllers/vpnProfileController.js`)
- Complete documentation (`PROFILE_DOWNLOAD_SETUP.md`)

⚠️ **Pending: Docker Engine Access**
- Docker Desktop engine needs to be fully started
- Once Docker is accessible, follow steps below

## When Docker is Ready - Quick Steps

### 1. Start Profile Proxy Service

Open a **Command Prompt** (CMD) or **PowerShell** as Administrator:

```cmd
cd c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam
node scripts/profile-proxy.js
```

Or double-click: `start-proxy.cmd`

**Expected output:**
```
============================================================
OpenVPN Profile Generation Proxy Service
============================================================
Status: Running
Port: 3001
Container: openvpn-server
============================================================
```

### 2. Verify Proxy Works

In another terminal:

```bash
# Health check
curl http://localhost:3001/health
# Expected: {"status":"ok","container":"openvpn-server"}

# Check user exists
curl "http://localhost:3001/user/exists?username=admin"
# Expected: {"exists":true}
```

### 3. Copy Updated Service to Backend Container

```bash
docker cp "c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam\src\services\openvpnProfileService.js" openvpn-backend:/app/src/services/openvpnProfileService.js
```

### 4. Restart Backend Container

```bash
cd c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam
docker-compose restart backend
```

Wait ~10 seconds, then verify:

```bash
docker ps | grep backend
# Should show: Up X seconds (healthy)
```

### 5. Test End-to-End

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.data.token')

# 2. Check profile info
curl -s http://localhost:3000/api/vpn/profile/info \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected output:
# {
#   "success": true,
#   "data": {
#     "username": "admin",
#     "email": "admin@example.com",
#     "emailVerified": 1,
#     "vpnAccountExists": true,     <-- Should be true
#     "canDownload": true,            <-- Should be true
#     "profileType": "userlogin",
#     "requiresPassword": true
#   }
# }

# 3. Download profile
curl http://localhost:3000/api/vpn/profile/download \
  -H "Authorization: Bearer $TOKEN" \
  -o admin_profile.ovpn

# 4. Verify download
head -10 admin_profile.ovpn
# Should show valid OpenVPN config starting with "client"
```

## Troubleshooting Docker Engine Issues

If you get "pipe/dockerDesktopLinuxEngine: The system cannot find the file specified":

### Solution 1: Restart Docker Desktop
1. Right-click Docker Desktop system tray icon
2. Click "Quit Docker Desktop"
3. Wait 10 seconds
4. Start Docker Desktop again
5. Wait for it to show "Docker Desktop is running"

### Solution 2: Check Docker Context
```powershell
docker context ls
docker context use desktop-linux
docker ps  # Should work now
```

### Solution 3: Run as Administrator
Some Windows configurations require Docker commands to run as Administrator:
1. Open PowerShell/CMD as Administrator
2. Run the commands again

### Solution 4: WSL2 Backend Issue
If using WSL2 backend:
```powershell
# Restart WSL
wsl --shutdown
# Wait 10 seconds, then start Docker Desktop
```

## Alternative: Run Proxy from WSL (If Available)

If you have WSL2 installed:

```bash
# In WSL terminal
cd /mnt/c/Users/Dread/Downloads/Compressed/openvpn-distribution-system/TNam
node scripts/profile-proxy.js
```

WSL typically has better Docker socket access.

## Files Overview

| File | Purpose | Status |
|------|---------|--------|
| `scripts/profile-proxy.js` | HTTP proxy for profile generation | ✅ Ready |
| `scripts/start-proxy.cmd` | Windows batch script to start proxy | ✅ Ready |
| `src/services/openvpnProfileService.js` | Backend service using proxy | ✅ Ready (needs deployment) |
| `src/controllers/vpnProfileController.js` | API endpoints | ✅ Ready |
| `src/routes/openvpnRoutes.js` | Route definitions | ✅ Ready |
| `PROFILE_DOWNLOAD_SETUP.md` | Complete documentation | ✅ Ready |

## What Happens When It Works

1. **User** logs into dashboard
2. **User** clicks "Download VPN Profile" button
3. **Backend** (port 3000) receives request
4. **Backend** calls Profile Proxy (port 3001)
5. **Proxy** executes `docker exec openvpn-server sacli --user <username> GetUserlogin`
6. **Proxy** returns .ovpn profile content
7. **Backend** sends file to user's browser
8. **User** imports .ovpn file into OpenVPN client
9. **User** connects to VPN using their credentials

## Next Steps After Testing

1. ✅ Verify all users can download profiles
2. Add "Download VPN Profile" button to frontend dashboard
3. Add profile download tracking (log downloads to database)
4. Set up proxy as Windows service (using PM2 or NSSM)
5. Add rate limiting (max 5 downloads per hour per user)
6. Add profile regeneration endpoint
7. Add email notification on profile download

## Support Commands

```bash
# Check if proxy is running
netstat -ano | findstr ":3001"

# Check backend logs
docker logs openvpn-backend --tail 50

# Check backend health
curl http://localhost:3000/health

# List running containers
docker ps

# Restart everything
docker-compose restart
```

## Production Deployment

See `PROFILE_DOWNLOAD_SETUP.md` for:
- Running proxy as a Windows service
- Security considerations
- Firewall configuration
- HTTPS setup
- Monitoring and alerts

---

**Last Updated:** 2025-10-15
**Status:** Awaiting Docker Engine accessibility
**Contact:** Check logs if issues persist
