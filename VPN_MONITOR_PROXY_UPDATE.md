# VPN Monitor - Profile Proxy Integration

## Summary
Updated the VPN Monitor service to use the **profile-proxy** instead of direct Docker socket access for retrieving VPN connection status. This eliminates permission issues and provides a more secure, isolated communication method.

## Changes Made

### 1. **scripts/profile-proxy.js**
Added new endpoint for VPN status monitoring:

```javascript
GET /sacli/vpnstatus
```

**Response**: Returns the current VPN connection status including connected clients, their IPs, and connection details.

**Updated Available Endpoints:**
- `GET /health` - Health check
- `GET /user/exists?username=<username>` - Check if user exists
- `GET /sacli/userpropget` - Get all user properties
- `GET /sacli/vpnstatus` - **NEW** Get VPN connection status
- `POST /profile/userlogin` - Generate userlogin profile
- `POST /profile/autologin` - Generate autologin profile
- `POST /sacli/user/:username/setpassword` - Set user password
- `POST /sacli/user/:username/prop` - Set user property
- `POST /sacli/user/:username/delall` - Delete user

### 2. **src/services/vpnMonitor.js**
Replaced Docker socket execution with HTTP requests to profile-proxy:

**Before:**
```javascript
async getVPNStatus() {
  const { stdout } = await execAsync('docker exec openvpn-server sacli VPNStatus');
  const status = JSON.parse(stdout);
  return status;
}
```

**After:**
```javascript
async getVPNStatus() {
  const response = await axios.get(`${this.proxyUrl}/sacli/vpnstatus`, {
    timeout: 10000
  });
  return response.data;
}
```

**Configuration:**
- Added `proxyUrl` property: `process.env.PROFILE_PROXY_URL || 'http://host.docker.internal:3001'`
- Removed `child_process` and `execAsync` dependencies
- Added `axios` for HTTP requests

### 3. **package.json**
Added `axios` dependency to backend:

```json
"dependencies": {
  "axios": "^1.6.8",
  ...
}
```

### 4. **docker-compose.yml**
Added environment variable for profile proxy URL:

```yaml
environment:
  # Profile Proxy Configuration
  PROFILE_PROXY_URL: ${PROFILE_PROXY_URL:-http://host.docker.internal:3001}
```

## Benefits

### ✅ Security
- No Docker socket access required from backend container
- Reduced attack surface - backend can't manipulate containers
- Isolated communication via HTTP API

### ✅ Permission Issues Resolved
- No more "permission denied" errors when accessing Docker socket
- Profile proxy runs on host with full Docker access
- Backend makes simple HTTP requests

### ✅ Better Architecture
- Clear separation of concerns
- Profile proxy acts as gateway to OpenVPN operations
- Backend focuses on business logic, not infrastructure

### ✅ Easier Debugging
- HTTP requests are easier to monitor and log
- Can test endpoints with curl/Postman
- Clear error messages from proxy

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                         Host Machine                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  profile-proxy.js (Port 3001)                          │ │
│  │  • Runs on host with Docker access                     │ │
│  │  • Exposes HTTP API for sacli commands                 │ │
│  │  • GET /sacli/vpnstatus → docker exec sacli VPNStatus  │ │
│  └─────────────────┬──────────────────────────────────────┘ │
│                    │                                         │
│                    │ HTTP Request                            │
│                    │                                         │
│  ┌─────────────────▼──────────────────────────────────────┐ │
│  │  Docker Container: openvpn-backend                     │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  vpnMonitor.js                                   │ │ │
│  │  │  • axios.get(proxyUrl/sacli/vpnstatus)           │ │ │
│  │  │  • Parse connected clients                       │ │ │
│  │  │  • Update device records in database             │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Docker Container: openvpn-server                      │ │
│  │  • OpenVPN Access Server                               │ │
│  │  • sacli commands executed by proxy                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

**Backend (.env or docker-compose.yml):**
```bash
PROFILE_PROXY_URL=http://host.docker.internal:3001
```

**Profile Proxy (.env or start-proxy.cmd):**
```bash
PROFILE_PROXY_PORT=3001
OPENVPN_CONTAINER_NAME=openvpn-server
```

## Usage

### 1. Start Profile Proxy (Host Machine)
```powershell
# Start the proxy on host
node scripts/profile-proxy.js

# Or use the start script
.\start-proxy.cmd
```

### 2. Start Backend (Docker)
```powershell
docker-compose up -d backend
```

The VPN monitor will now automatically:
- Query VPN status via profile-proxy every 60 seconds
- Detect connected clients
- Create/update device records
- Mark inactive devices

### 3. Test the Connection
```powershell
# Test proxy health
Invoke-WebRequest http://localhost:3001/health

# Test VPN status endpoint
Invoke-WebRequest http://localhost:3001/sacli/vpnstatus
```

## Monitoring

### Backend Logs
```powershell
docker-compose logs -f backend | Select-String "VPN"
```

Look for:
- ✅ `Checking VPN connections...` - Monitor running
- ✅ `Found X active VPN connection(s)` - Clients detected
- ✅ `Created new device for user...` - Device tracked
- ❌ `Error getting VPN status from proxy` - Connection issue

### Profile Proxy Logs
```
2025-11-01T15:30:00.000Z - GET /sacli/vpnstatus
```

## Troubleshooting

### Issue: "Error getting VPN status from proxy"

**Solutions:**
1. Ensure profile-proxy is running: `node scripts/profile-proxy.js`
2. Check proxy is accessible: `curl http://localhost:3001/health`
3. Verify Docker containers can reach host: `host.docker.internal`
4. Check firewall isn't blocking port 3001

### Issue: Backend can't reach proxy

**Check:**
```powershell
# From inside backend container
docker exec openvpn-backend wget -O- http://host.docker.internal:3001/health
```

**Fix:**
- Ensure `host.docker.internal` works (Docker Desktop required)
- Or use host IP: `PROFILE_PROXY_URL=http://192.168.1.x:3001`

## Testing

### Test VPN Status Retrieval
```powershell
# 1. Start profile proxy
node scripts/profile-proxy.js

# 2. Connect to VPN with OpenVPN client

# 3. Test proxy endpoint directly
Invoke-WebRequest http://localhost:3001/sacli/vpnstatus | ConvertFrom-Json

# 4. Check backend logs
docker-compose logs backend | Select-String "VPN"
```

### Expected Output
```
Found 1 active VPN connection(s)
Created new device for user john@example.com from IP 192.168.1.100
```

## Migration Notes

- **No database changes required** - devices table unchanged
- **No frontend changes needed** - device display works as before  
- **Profile proxy must be running** - start it before backend
- **Backward compatible** - fallback to proxy URL if configured

## Next Steps

1. **Start profile-proxy** on host machine
2. **Rebuild backend** with new code
3. **Test connection** by connecting to VPN
4. **Monitor logs** to verify device tracking

---

**Implementation Date**: November 1, 2025  
**Status**: ✅ Complete - Ready to rebuild
