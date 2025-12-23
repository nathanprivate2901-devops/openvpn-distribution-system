# Deployment Checklist - VPN Profile Download Feature

## Current Status
✅ Backend code written
✅ Frontend code written
⏳ Backend deployment pending
⏳ Services need to be started

## Step-by-Step Deployment

### 1. Ensure Docker is Running

```bash
# Check Docker status
docker ps

# If Docker not accessible, restart Docker Desktop:
# - Right-click Docker Desktop icon in system tray
# - Click "Quit Docker Desktop"
# - Wait 10 seconds
# - Start Docker Desktop from Start Menu
# - Wait for "Docker Desktop is running" message
```

### 2. Start All Docker Containers

```bash
cd c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam

# Start all services
docker-compose up -d

# Verify all containers are running
docker ps

# Expected output should show:
# - openvpn-backend (healthy)
# - openvpn-mysql (healthy)
# - openvpn-server
# - openvpn-frontend (if applicable)
```

### 3. Copy Updated Backend Files to Container

```bash
# Copy updated service file
docker cp src/services/openvpnProfileService.js openvpn-backend:/app/src/services/openvpnProfileService.js

# Copy updated controller
docker cp src/controllers/vpnProfileController.js openvpn-backend:/app/src/controllers/vpnProfileController.js

# Copy updated routes
docker cp src/routes/openvpnRoutes.js openvpn-backend:/app/src/routes/openvpnRoutes.js
```

### 4. Restart Backend Container

```bash
# Restart to load new code
docker-compose restart backend

# Wait for healthy status (10-15 seconds)
timeout /t 15

# Verify backend is healthy
docker ps | findstr backend
# Should show: Up X seconds (healthy)
```

### 5. Start Profile Proxy Service

Open a **new PowerShell or CMD window** (NOT Git Bash):

```powershell
cd c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam

# Start proxy service
node scripts/profile-proxy.js

# You should see:
# ============================================================
# OpenVPN Profile Generation Proxy Service
# ============================================================
# Status: Running
# Port: 3001
```

**Keep this window open** - the proxy must run continuously.

### 6. Test Backend Endpoints

In another terminal:

```bash
# Test proxy health
curl http://localhost:3001/health
# Expected: {"status":"ok","container":"openvpn-server"}

# Test backend health
curl http://localhost:3000/health
# Expected: JSON with status "OK"

# Login to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"admin123\"}"

# Save the token from response, then test profile info
curl http://localhost:3000/api/vpn/profile/info \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Expected: JSON with username, emailVerified, vpnAccountExists, canDownload
```

### 7. Start Frontend Development Server

In another terminal:

```bash
cd c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam\frontend

# Install dependencies (if needed)
npm install

# Start development server
npm run dev

# Frontend will start on http://localhost:3000 (or next available port)
```

### 8. Test in Browser

1. Open browser to frontend URL (e.g., `http://localhost:3000`)
2. Login with credentials:
   - Email: `admin@example.com`
   - Password: `admin123`
3. Navigate to "VPN Configurations" page
4. You should see:
   - **OpenVPN Access Server Profile** card at top
   - Status badges showing username and account status
   - **Download VPN Profile** button

5. Click "Download VPN Profile" button
6. File should download as `admin_profile.ovpn`
7. Success toast should appear

### 9. Verify Downloaded Profile

```bash
# Open the downloaded file
notepad admin_profile.ovpn

# Should contain:
# - "client" at the top
# - "dev tun"
# - "remote <server> 1194"
# - Certificate blocks: <ca>, <cert>, <key>
```

## Troubleshooting

### Issue: "Not found" error in frontend

**Possible causes:**
1. Backend hasn't restarted with new code
2. Routes not loaded
3. Wrong API path

**Solution:**
```bash
# Check backend logs
docker logs openvpn-backend --tail 50

# Look for route registration:
# Should see: "  - GET    /api/vpn/profile/info"

# If not found, restart backend:
docker-compose restart backend
```

### Issue: "Profile proxy unreachable"

**Causes:**
1. Proxy service not running
2. Running from Git Bash (doesn't support Docker pipe)
3. Wrong port

**Solutions:**
```bash
# Check if proxy is running
netstat -ano | findstr ":3001"

# If not running, start from PowerShell/CMD (not Git Bash):
node scripts/profile-proxy.js

# Verify proxy works:
curl http://localhost:3001/health
```

### Issue: "vpnAccountExists: false"

**Causes:**
1. User not synced to OpenVPN Access Server
2. Username mismatch

**Solution:**
```bash
# Run user sync from host machine
node scripts/sync-users.js

# Verify sync worked:
curl "http://localhost:3001/user/exists?username=admin"
# Should return: {"exists":true}
```

### Issue: Frontend shows old version

**Solution:**
```bash
# Clear Next.js cache and rebuild
cd frontend
rm -rf .next
npm run dev
```

## Service Status Checklist

Before testing, verify:

- [ ] Docker Desktop is running
- [ ] All containers are up: `docker ps` shows 3-4 containers
- [ ] Backend is healthy: `docker ps | grep backend` shows "(healthy)"
- [ ] MySQL is healthy: `docker ps | grep mysql` shows "(healthy)"
- [ ] OpenVPN server is running: `docker ps | grep openvpn-server`
- [ ] Profile proxy is running: `curl http://localhost:3001/health` works
- [ ] Backend API is accessible: `curl http://localhost:3000/health` works
- [ ] Frontend dev server is running: Browser shows login page

## Quick Test Script

Save as `test-profile-download.sh`:

```bash
#!/bin/bash

echo "Testing VPN Profile Download System..."
echo ""

# Test 1: Proxy
echo "1. Testing proxy service..."
curl -s http://localhost:3001/health
echo ""

# Test 2: Backend
echo "2. Testing backend..."
curl -s http://localhost:3000/health | head -5
echo ""

# Test 3: Login
echo "3. Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi
echo "✅ Got token"

# Test 4: Profile info
echo "4. Testing profile info endpoint..."
curl -s http://localhost:3000/api/vpn/profile/info \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo ""
echo "All tests complete!"
```

## Production Deployment Notes

When deploying to production:

1. **Build frontend**:
   ```bash
   cd frontend
   npm run build
   npm run start
   ```

2. **Set environment variables**:
   ```bash
   NODE_ENV=production
   NEXT_PUBLIC_API_BASE_URL=https://your-domain.com/api
   ```

3. **Run proxy as service** (using PM2):
   ```bash
   pm2 start scripts/profile-proxy.js --name vpn-profile-proxy
   pm2 startup
   pm2 save
   ```

4. **Set up reverse proxy** (nginx/Apache) for SSL

5. **Configure firewall**:
   - Allow port 3000 (backend)
   - Allow port 3001 (proxy - localhost only)
   - Frontend port (if separate)

---

**Last Updated**: 2025-10-15
**Status**: Ready for deployment
**Estimated Time**: 10-15 minutes
