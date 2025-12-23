# Frontend Access Guide

## ✅ Solution: Port Conflict Resolved

The frontend and profile proxy were both trying to use port 3001. The frontend has been moved to port 3002.

## Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3002 | User interface (login, dashboard, VPN configs) |
| **Backend API** | http://localhost:3000 | REST API endpoints |
| **Profile Proxy** | http://localhost:3001 | VPN profile generation service |

## Quick Start

### 1. Access the Frontend

Open your browser and navigate to:
```
http://localhost:3002
```

### 2. Login

Use these credentials:
- Email: `admin@example.com`
- Password: `admin123`

### 3. Navigate to VPN Configurations

After login, click on **"VPN Configurations"** in the side menu.

### 4. Download VPN Profile

You should see:
- A highlighted card at the top: **"OpenVPN Access Server Profile"**
- Status badges showing your username and account status
- A large **"Download VPN Profile"** button

Click the button to download your `.ovpn` file.

## What You'll See

```
┌────────────────────────────────────────────────────────────┐
│ 🛡️  OpenVPN Access Server Profile                          │
│                                                              │
│ Download your secure VPN profile directly from              │
│ OpenVPN Access Server                                       │
│                                                              │
│ [ℹ️ Username: admin] [✓ Account Active] [🔐 Password Required]│
│                                                              │
│ ┌───────────────────────────────┐                          │
│ │  📥 Download VPN Profile       │   This profile is...    │
│ └───────────────────────────────┘                          │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Issue: "Not found" or 404 error

**Solution**: Frontend wasn't rebuilt with new code. Run:
```bash
cd c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam
docker-compose build frontend
export FRONTEND_PORT=3002
docker-compose up -d frontend
```

### Issue: Profile download fails

**Causes:**
1. Profile proxy not running
2. Backend hasn't been updated
3. User not synced to OpenVPN AS

**Solutions:**

1. **Check proxy is running**:
   ```bash
   curl http://localhost:3001/health
   # Should return: {"status":"ok","container":"openvpn-server"}
   ```

   If not running, start it from PowerShell/CMD:
   ```powershell
   cd c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam
   node scripts/profile-proxy.js
   ```

2. **Update backend**:
   ```bash
   docker cp src/services/openvpnProfileService.js openvpn-backend:/app/src/services/
   docker cp src/controllers/vpnProfileController.js openvpn-backend:/app/src/controllers/
   docker cp src/routes/openvpnRoutes.js openvpn-backend:/app/src/routes/
   docker-compose restart backend
   ```

3. **Sync users**:
   ```bash
   node scripts/sync-users.js
   ```

### Issue: Shows "Account Pending"

This means your user account hasn't been synced to OpenVPN Access Server yet.

**Solution**: Run the sync script:
```bash
node scripts/sync-users.js
```

Wait 10 seconds, then refresh the page.

### Issue: Shows "Email Not Verified"

You need to verify your email address first.

**Check email verification status**:
```bash
# Login to get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.data.token')

# Check user info
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.data.email_verified'
```

If it returns `0`, manually verify in database:
```bash
echo "UPDATE users SET email_verified = 1 WHERE email = 'admin@example.com';" | \
  docker exec -i openvpn-mysql mysql -uopenvpn_user -popenvpn_secure_password_123 openvpn_system
```

## Service Status Check

Run this to check all services:

```bash
echo "=== Docker Containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== Backend Health ==="
curl -s http://localhost:3000/health | jq '.status'

echo ""
echo "=== Proxy Health ==="
curl -s http://localhost:3001/health

echo ""
echo "=== Frontend ==="
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002
```

Expected output:
```
=== Docker Containers ===
NAMES              STATUS                      PORTS
openvpn-frontend   Up X minutes (healthy)      0.0.0.0:3002->3001/tcp
openvpn-backend    Up X minutes (healthy)      0.0.0.0:3000->3000/tcp
openvpn-mysql      Up X minutes (healthy)      0.0.0.0:3306->3306/tcp
openvpn-server     Up X minutes (healthy)      ... multiple ports ...

=== Backend Health ===
"OK"

=== Proxy Health ===
{"status":"ok","container":"openvpn-server"}

=== Frontend ===
200
```

## Port Configuration

If you need to change ports, edit `.env` file:

```env
# Frontend external port
FRONTEND_PORT=3002

# Backend API port
BACKEND_PORT=3000

# Profile proxy port (in scripts/profile-proxy.js)
PROFILE_PROXY_PORT=3001
```

Then restart services:
```bash
docker-compose down
docker-compose up -d
```

## Testing the Integration

### Step-by-Step Test:

1. **Open browser**: http://localhost:3002

2. **Login**: admin@example.com / admin123

3. **Navigate**: Click "VPN Configurations" in sidebar

4. **Verify card appears**: Should see "OpenVPN Access Server Profile" card

5. **Check badges**:
   - Username should show your username
   - "Account Active" should be green
   - "Password Required" should be shown

6. **Click download**: Click "Download VPN Profile" button

7. **File downloads**: File `admin_profile.ovpn` should download

8. **Success toast**: Green toast notification should appear

9. **Verify file**:
   ```bash
   head -20 ~/Downloads/admin_profile.ovpn
   ```
   Should show valid OpenVPN config starting with:
   ```
   client
   dev tun
   proto udp
   remote <server-ip> 1194
   ...
   ```

## API Testing (Without Frontend)

If you want to test the backend API directly:

```bash
# 1. Login
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
  -o test_profile.ovpn

# 4. Verify
ls -lh test_profile.ovpn
head -20 test_profile.ovpn
```

## Important Notes

1. **Profile Proxy Must Run**: The proxy service (`node scripts/profile-proxy.js`) must be running continuously for profile downloads to work.

2. **PowerShell/CMD Only**: The proxy must run from PowerShell or CMD, NOT Git Bash (Docker pipe access issue).

3. **Port 3002**: Frontend is now on port 3002 (not 3001) to avoid conflict with proxy.

4. **Production Build**: The frontend is a production build, so changes require rebuild:
   ```bash
   docker-compose build frontend
   docker-compose up -d frontend
   ```

5. **User Sync**: Users must be synced to OpenVPN AS before they can download profiles.

## Next Steps

After successfully downloading a profile:

1. **Import to OpenVPN Client**: Import the `.ovpn` file into OpenVPN Connect or similar client
2. **Connect**: Use your account password to connect to the VPN
3. **Test Connection**: Verify VPN is working by checking your IP address
4. **Share with Users**: Other users can follow the same process to get their profiles

---

**Frontend URL**: http://localhost:3002
**Date**: 2025-10-15
**Status**: ✅ Ready to use
