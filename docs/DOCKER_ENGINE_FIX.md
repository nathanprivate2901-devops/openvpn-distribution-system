# Docker Engine Accessibility Fix

## Current Issue

The Docker engine pipe is not accessible, showing this error:
```
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified
```

## Immediate Solution

### Option 1: Restart Docker Desktop (Recommended)

1. **Locate Docker Desktop** in system tray (bottom-right of screen)
2. **Right-click** the Docker whale icon
3. **Click** "Quit Docker Desktop"
4. **Wait** 15-20 seconds for complete shutdown
5. **Start** Docker Desktop again from Start Menu
6. **Wait** for "Docker Desktop is running" message
7. **Test** with: Open PowerShell and run `docker ps`

### Option 2: Restart via PowerShell (As Administrator)

1. **Open PowerShell as Administrator**
2. Run these commands:

```powershell
# Stop Docker Desktop
Stop-Process -Name "Docker Desktop" -Force

# Wait
Start-Sleep -Seconds 10

# Start Docker Desktop
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# Wait for startup
Start-Sleep -Seconds 30

# Test
docker ps
```

### Option 3: Restart Computer (Most Reliable)

If above options don't work, restart your computer. Docker Desktop will auto-start on login.

## After Docker is Accessible

Once `docker ps` works without errors, proceed with these steps:

### 1. Verify Containers Status

```powershell
docker ps -a
```

Expected output should show:
- openvpn-backend
- openvpn-mysql
- openvpn-server
- openvpn-frontend (if applicable)

### 2. Start All Containers

```bash
cd c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam
docker-compose up -d
```

Wait 30 seconds, then verify:

```bash
docker ps
```

All containers should show "Up" status.

### 3. Check Container Health

```bash
# Backend should show (healthy)
docker ps | grep backend

# MySQL should show (healthy)
docker ps | grep mysql

# OpenVPN server should be running
docker ps | grep openvpn-server
```

### 4. Restart Profile Proxy Service

The proxy service might have stopped. Restart it:

**Using CMD:**
```cmd
cd c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam
start-proxy.cmd
```

**Or double-click** `start-proxy.cmd` from File Explorer

**Verify proxy is working:**
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","container":"openvpn-server"}
```

### 5. Test User Exists Check

```bash
curl "http://localhost:3001/user/exists?username=admin"
# Expected: {"exists":true}
```

If it returns `{"exists":false}`, the proxy can't reach the OpenVPN container. Ensure:
- OpenVPN container is running: `docker ps | grep openvpn-server`
- Container name matches: Should be `openvpn-server`

### 6. Copy Updated Service to Backend

```bash
docker cp "c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam\src\services\openvpnProfileService.js" openvpn-backend:/app/src/services/openvpnProfileService.js
```

### 7. Restart Backend

```bash
docker-compose restart backend

# Wait 10 seconds
Start-Sleep -Seconds 10

# Verify healthy
docker ps | grep backend
```

### 8. Test Profile Download

```bash
# 1. Get auth token
$token = (curl.exe -s -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@example.com","password":"admin123"}' | ConvertFrom-Json).data.token

# 2. Check profile info
curl.exe -s http://localhost:3000/api/vpn/profile/info `
  -H "Authorization: Bearer $token"

# 3. Download profile
curl.exe http://localhost:3000/api/vpn/profile/download `
  -H "Authorization: Bearer $token" `
  -o admin_profile.ovpn

# 4. Verify
type admin_profile.ovpn
```

## Why This Happens

This issue occurs because:

1. **Docker Desktop WSL2 backend** uses a named pipe for communication
2. **Git Bash** and some terminals can't access Windows named pipes properly
3. **Docker Desktop** may not have fully initialized the engine after startup
4. **Windows permissions** might be blocking pipe access

## Permanent Solutions

### Solution 1: Always Use PowerShell or CMD

Don't use Git Bash for Docker commands. Use:
- PowerShell (recommended)
- Command Prompt (CMD)
- Windows Terminal

### Solution 2: Use Docker Desktop CLI Integration

In Docker Desktop settings:
1. Go to **Settings** → **General**
2. Enable **"Use Docker Compose V2"**
3. Restart Docker Desktop

### Solution 3: Add Docker to Windows PATH (If Missing)

```powershell
# Check if docker is in PATH
Get-Command docker

# If not found, add to PATH:
[Environment]::SetEnvironmentVariable(
    "Path",
    "$env:Path;C:\Program Files\Docker\Docker\resources\bin",
    "User"
)
```

Close and reopen terminal.

## Verification Checklist

- [ ] Docker Desktop shows "Docker Desktop is running" in system tray
- [ ] `docker ps` works without errors
- [ ] All containers are running: `docker ps` shows 3-4 containers
- [ ] Backend is healthy: `docker ps | grep backend` shows "(healthy)"
- [ ] Proxy service is running on port 3001
- [ ] Proxy health check works: `curl http://localhost:3001/health`
- [ ] User exists check returns true: `curl http://localhost:3001/user/exists?username=admin`
- [ ] Backend profile info endpoint works
- [ ] Profile download works

## Common Errors

### "Permission denied while trying to connect to Docker daemon socket"

**Solution:** Run PowerShell/CMD as Administrator

### "Cannot connect to Docker daemon"

**Solutions:**
1. Restart Docker Desktop
2. Check Docker Desktop is running (system tray icon)
3. Run `docker context ls` and ensure desktop-linux is active

### "Container name openvpn-server not found"

**Solutions:**
1. Check actual container name: `docker ps --filter name=openvpn`
2. Update `.env` file: `OPENVPN_CONTAINER_NAME=<actual-name>`
3. Restart proxy service

## Next Steps After Fix

Once everything is working:

1. Test profile download with multiple users
2. Set up proxy as Windows service (PM2 or NSSM)
3. Add frontend button for profile download
4. Monitor logs for any errors
5. Document any additional issues

## Support

If issues persist after trying all solutions:

1. **Check Docker Desktop logs:**
   - Click Docker Desktop system tray icon
   - Click "Troubleshoot"
   - Click "Get support"
   - View diagnostic logs

2. **Check system requirements:**
   - Windows 10 version 1903 or higher
   - WSL 2 enabled
   - Virtualization enabled in BIOS

3. **Reinstall Docker Desktop** (last resort)

---

**Created:** 2025-10-15
**Status:** Troubleshooting Docker engine accessibility
**Reference:** QUICK_START_PROFILE_DOWNLOAD.md
