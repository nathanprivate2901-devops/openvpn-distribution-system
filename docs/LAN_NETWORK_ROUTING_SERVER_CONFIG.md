# OpenVPN Server Configuration for LAN Network Routing

## Problem

LAN network routes are added to client profiles, but clients still cannot access LAN networks. This is because:

1. **Client-side routes** (in `.ovpn` file) tell the client to send traffic through the VPN tunnel
2. **Server-side routing** must also be configured so the OpenVPN server knows these networks exist and can route traffic properly

## Solution

Configure the OpenVPN Access Server to allow routing to private LAN networks.

---

## Method 1: Admin Web UI Configuration (Recommended)

### Step 1: Access Admin UI

Navigate to: https://localhost:943/admin

Login with your admin credentials.

### Step 2: Configure VPN Settings

1. Go to **Configuration** → **VPN Settings**
2. Scroll to **Routing** section
3. Configure the following:

#### Should client Internet traffic be routed through the VPN?
- Set to: **No** (unless you want full tunneling)

#### Should VPN clients have access to private subnets?
- Set to: **Yes, using NAT**

#### Specify the private subnets
Add all your users' LAN networks (one per line):
```
192.168.1.0/24
10.168.20.0/24
192.168.0.0/24
10.0.0.0/24
```

**Note**: You need to manually add networks here as users create them in the system.

4. Click **Save Settings**
5. Click **Update Running Server**

---

## Method 2: Command Line Configuration

### Configure Routing Settings

```bash
# Enable NAT routing for private networks
docker exec openvpn-server sacli --key "vpn.server.routing.private_access" --value "nat" ConfigPut

# Add private networks (add one at a time)
docker exec openvpn-server sacli --key "vpn.server.routing.private_network.0" --value "10.77.0.0/24" ConfigPut
docker exec openvpn-server sacli --key "vpn.server.routing.private_network.1" --value "192.168.1.0/24" ConfigPut
docker exec openvpn-server sacli --key "vpn.server.routing.private_network.2" --value "10.168.20.0/24" ConfigPut

# Apply configuration
docker exec openvpn-server sacli start
```

### Verify Configuration

```bash
# Check current routing settings
docker exec openvpn-server sacli ConfigQuery | grep "vpn.server.routing"
```

Expected output:
```json
"vpn.server.routing.private_access": "nat",
"vpn.server.routing.private_network.0": "10.77.0.0/24",
"vpn.server.routing.private_network.1": "192.168.1.0/24",
"vpn.server.routing.private_network.2": "10.168.20.0/24",
```

---

## Method 3: Automated PowerShell Script

Save as `configure-lan-routing.ps1`:

```powershell
# Get all enabled LAN networks from database
$query = @"
SELECT DISTINCT network_cidr 
FROM user_lan_networks 
WHERE enabled = 1
ORDER BY network_cidr
"@

$networks = docker-compose exec -T mysql mysql -uroot -p${env:DB_ROOT_PASSWORD} -D vpn_nam -e "$query" -N

# Configure OpenVPN server
Write-Host "Configuring OpenVPN server routing..." -ForegroundColor Green

# Enable NAT
docker exec openvpn-server sacli --key "vpn.server.routing.private_access" --value "nat" ConfigPut

# Add VPN subnet first
docker exec openvpn-server sacli --key "vpn.server.routing.private_network.0" --value "10.77.0.0/24" ConfigPut

# Add each LAN network
$index = 1
foreach ($network in $networks) {
    if ($network -match '^\d+\.\d+\.\d+\.\d+/\d+$') {
        Write-Host "Adding network ${index}: $network"
        docker exec openvpn-server sacli --key "vpn.server.routing.private_network.$index" --value "$network" ConfigPut
        $index++
    }
}

# Apply configuration
Write-Host "Applying configuration..." -ForegroundColor Yellow
docker exec openvpn-server sacli start

Write-Host "Configuration complete!" -ForegroundColor Green
Write-Host "OpenVPN server now routes ${index} networks" -ForegroundColor Cyan
```

Run with:
```powershell
.\configure-lan-routing.ps1
```

---

## Understanding the Routing

### Client-Side (`route` in profile)
```
route 192.168.1.0 255.255.255.0
```
- Tells client: "Send traffic to 192.168.1.0/24 through VPN tunnel"

### Server-Side (`vpn.server.routing.private_network`)
```json
"vpn.server.routing.private_network.1": "192.168.1.0/24"
```
- Tells server: "This network exists and should be routable"
- With NAT mode: Server will route traffic destined for this network

### How It Works Together

1. Client wants to access `192.168.1.100`
2. Client route table says: "Send to VPN tunnel"
3. Packet goes through VPN to server
4. Server sees destination is `192.168.1.0/24`
5. Server routing config allows this network
6. Server routes packet appropriately (NAT or direct)

---

## Verification

### 1. Check OpenVPN Server Config

```powershell
docker exec openvpn-server sacli ConfigQuery | Select-String -Pattern "routing"
```

### 2. Test from Connected Client

```bash
# Check routing table on client
ip route | grep tun

# Or on Windows
route print | findstr "192.168"

# Ping a device on LAN network
ping 192.168.1.1
```

### 3. Check OpenVPN Server Logs

```powershell
docker-compose logs -f openvpn-server | Select-String -Pattern "route"
```

---

## Troubleshooting

### Routes in profile but not working

**Cause**: Server doesn't know about the LAN networks

**Solution**: Add networks to server configuration (Methods above)

### Permission denied errors in backend logs

**Cause**: Backend container cannot execute docker commands

**Solution**: Configure manually via Admin UI or from host machine

### Client still getting VPN IP only

**Cause**: Routing not applied or client needs to reconnect

**Solution**:
1. Ensure server configuration was applied (`sacli start`)
2. Disconnect and reconnect VPN client
3. Check client routing table

---

## Automated Solution (Future Enhancement)

To fully automate this:

1. **Option A**: Create a webhook endpoint that updates OpenVPN config when LAN networks change
2. **Option B**: Run a cron job/scheduled task to sync LAN networks to OpenVPN server
3. **Option C**: Mount docker.sock with proper permissions (security risk)

For now, manual configuration or running the PowerShell script periodically is recommended.

---

## Quick Fix for Current Issue

Run these commands now:

```powershell
# Configure the two networks currently enabled for demousersync
docker exec openvpn-server sacli --key "vpn.server.routing.private_access" --value "nat" ConfigPut
docker exec openvpn-server sacli --key "vpn.server.routing.private_network.0" --value "10.77.0.0/24" ConfigPut
docker exec openvpn-server sacli --key "vpn.server.routing.private_network.1" --value "192.168.1.0/24" ConfigPut
docker exec openvpn-server sacli --key "vpn.server.routing.private_network.2" --value "10.168.20.0/24" ConfigPut
docker exec openvpn-server sacli start
```

Then:
1. Disconnect VPN client
2. Wait 10 seconds
3. Reconnect VPN client
4. Test access to LAN networks

