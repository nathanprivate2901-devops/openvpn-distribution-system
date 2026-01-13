# LAN Network Routing - Quick Reference

## Installation Status

✅ **COMPLETED** - Feature is fully installed and ready to use!

- Database table `user_lan_networks` created
- 2 sample networks added for admin user
- Backend integrated and running
- API endpoints registered

## Quick PowerShell Commands

### Check Installation
```powershell
# Verify table exists
docker-compose exec -T mysql mysql -u root -proot_secure_password_456 openvpn_system -e "SHOW TABLES LIKE 'user_lan_networks';"

# Check sample data
docker-compose exec -T mysql mysql -u root -proot_secure_password_456 openvpn_system -e "SELECT * FROM user_lan_networks;"

# Check backend health
Invoke-RestMethod -Uri "http://localhost:3000/health"
```

### Test API (After Login)

#### Step 1: Register/Login
```powershell
# Register new user
$body = @{ 
    username = "testuser"
    email = "test@example.com"
    password = "Test123!"
    name = "Test User"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
    -Method Post -Body $body -ContentType "application/json"

# Login
$body = @{ 
    email = "test@example.com"
    password = "Test123!"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
    -Method Post -Body $body -ContentType "application/json"

$token = $response.token
Write-Host "Token: $token"
```

#### Step 2: Get Network Suggestions
```powershell
$suggestions = Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/suggestions" `
    -Method Get -Headers @{ "Authorization" = "Bearer $token" }

$suggestions.data | Format-Table
```

#### Step 3: Add a Network
```powershell
$network = @{ 
    network_cidr = "192.168.1.0/24"
    description = "Home Network"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks" `
    -Method Post -Body $network -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $token" }
```

#### Step 4: List Your Networks
```powershell
$networks = Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks" `
    -Method Get -Headers @{ "Authorization" = "Bearer $token" }

$networks.data.networks | Format-Table id, network_cidr, description, enabled
```

#### Step 5: Generate VPN Config (includes networks automatically)
```powershell
$config = Invoke-RestMethod -Uri "http://localhost:3000/api/vpn/generate-config" `
    -Method Post -Headers @{ "Authorization" = "Bearer $token" }

Write-Host "Config generated: $($config.data.filename)"
```

## Common Network Examples

| CIDR | Description | Subnet Mask |
|------|-------------|-------------|
| 192.168.0.0/24 | Home (192.168.0.x) | 255.255.255.0 |
| 192.168.1.0/24 | Home (192.168.1.x) | 255.255.255.0 |
| 10.0.0.0/24 | Office (10.0.0.x) | 255.255.255.0 |
| 172.16.0.0/24 | Private (172.16.0.x) | 255.255.255.0 |
| 192.168.0.0/16 | Large (all 192.168.x.x) | 255.255.0.0 |

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lan-networks` | List user's networks |
| GET | `/api/lan-networks/suggestions` | Get common networks |
| GET | `/api/lan-networks/stats` | Get statistics |
| POST | `/api/lan-networks` | Add new network |
| PUT | `/api/lan-networks/:id` | Update network |
| PATCH | `/api/lan-networks/:id/toggle` | Enable/disable |
| DELETE | `/api/lan-networks/:id` | Delete network |

## Troubleshooting

### Can't login?
Reset your password or create a new test user using the registration endpoint.

### Network not in VPN config?
1. Ensure network is enabled (`enabled = 1`)
2. Regenerate the VPN config after adding networks
3. Check backend logs: `docker-compose logs backend --tail 50`

### Invalid CIDR error?
Use proper format: `192.168.1.0/24` (not `.1` or `.100`, must be network address)

## Documentation

- **Full Guide:** `docs/LAN_NETWORK_ROUTING_FEATURE.md`
- **Implementation Summary:** `OPTION_2_IMPLEMENTATION_SUMMARY.md`
- **API Docs:** Inline in `src/routes/lanNetworkRoutes.js`

## Database Password Note

Current root password: `root_secure_password_456`
(Stored in `.env` file - change for production!)

## What's Included in VPN Config

When you generate a VPN config, it will include:

```
# ============================================
# LAN Network Routes
# ============================================
# Home Network: 192.168.1.0/24
route 192.168.1.0 255.255.255.0
# Office Network: 10.0.0.0/24
route 10.0.0.0 255.255.255.0
# Total LAN networks configured: 2
# ============================================
```

These routes tell OpenVPN to send traffic for those networks through the VPN tunnel!
