# LAN Network API - PowerShell Test Commands

## Authentication
```powershell
# Login and get token
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body (@{ email = "your-email@example.com"; password = "your-password" } | ConvertTo-Json)
$token = $loginResponse.data.token
```

## Network Suggestions
```powershell
# Get common network suggestions
Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/suggestions" -Method GET -Headers @{ "Authorization" = "Bearer $token" }
```

## Create Network
```powershell
# Create a new LAN network
$body = @{
    network_cidr = "192.168.1.0/24"
    description = "Home Network"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks" -Method POST -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body $body
```

## List Networks
```powershell
# Get all user's LAN networks
Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks" -Method GET -Headers @{ "Authorization" = "Bearer $token" }

# Get only enabled networks
Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/enabled" -Method GET -Headers @{ "Authorization" = "Bearer $token" }
```

## Get Network by ID
```powershell
# Get specific network
Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/4" -Method GET -Headers @{ "Authorization" = "Bearer $token" }
```

## Update Network
```powershell
# Update network description
$body = @{
    description = "Updated Description"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/4" -Method PUT -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body $body

# Update network CIDR
$body = @{
    network_cidr = "192.168.2.0/24"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/4" -Method PUT -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body $body
```

## Toggle Network
```powershell
# Disable network
$body = @{ enabled = $false } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/4/toggle" -Method PATCH -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body $body

# Enable network
$body = @{ enabled = $true } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/4/toggle" -Method PATCH -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body $body
```

## Delete Network
```powershell
# Delete a specific network
Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/4" -Method DELETE -Headers @{ "Authorization" = "Bearer $token" }
```

## Admin - Get All Networks
```powershell
# Admin only: Get all networks from all users (paginated)
Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/all?page=1&limit=50" -Method GET -Headers @{ "Authorization" = "Bearer $token" }
```

## Generate VPN Config
```powershell
# Generate VPN config with LAN routes
$body = @{
    description = "My VPN Config with LAN Routes"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/vpn/generate-config" -Method POST -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body $body

# Get the config ID
$configId = $response.data.id
```

## Download VPN Config
```powershell
# Download the generated config file
Invoke-WebRequest -Uri "http://localhost:3000/api/vpn/config/$configId" -Method GET -Headers @{ "Authorization" = "Bearer $token" } -OutFile "my-vpn-config.ovpn"

# View routes in the config
Get-Content my-vpn-config.ovpn | Select-String -Pattern "route"
```

## View Config Info
```powershell
# Get config metadata
Invoke-RestMethod -Uri "http://localhost:3000/api/vpn/config/$configId/info" -Method GET -Headers @{ "Authorization" = "Bearer $token" }
```

## Verify LAN Routes
```powershell
# Check routes with context
Get-Content my-vpn-config.ovpn | Select-String -Context 2 -Pattern "LAN Network"
```

## Full Test Workflow
```powershell
# 1. Login
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body (@{ email = "test@example.com"; password = "password123" } | ConvertTo-Json)
$token = $loginResponse.data.token

# 2. Create networks
Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks" -Method POST -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body (@{ network_cidr = "192.168.1.0/24"; description = "Home Network" } | ConvertTo-Json)
Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks" -Method POST -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body (@{ network_cidr = "10.0.0.0/24"; description = "Office Network" } | ConvertTo-Json)

# 3. List networks
$networks = Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks" -Method GET -Headers @{ "Authorization" = "Bearer $token" }
$networks.data | ConvertTo-Json -Depth 5

# 4. Generate VPN config
$configResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/vpn/generate-config" -Method POST -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body (@{ description = "Test Config" } | ConvertTo-Json)

# 5. Download and verify
$configId = $configResponse.data.id
Invoke-WebRequest -Uri "http://localhost:3000/api/vpn/config/$configId" -Method GET -Headers @{ "Authorization" = "Bearer $token" } -OutFile "test-config.ovpn"
Get-Content test-config.ovpn | Select-String -Pattern "route"

# 6. Test disable/enable
Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/$($networks.data.networks[0].id)/toggle" -Method PATCH -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body (@{ enabled = $false } | ConvertTo-Json)

# 7. Generate new config to verify disabled network is excluded
$configResponse2 = Invoke-RestMethod -Uri "http://localhost:3000/api/vpn/generate-config" -Method POST -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body (@{ description = "Test Config 2" } | ConvertTo-Json)
Invoke-WebRequest -Uri "http://localhost:3000/api/vpn/config/$($configResponse2.data.id)" -Method GET -Headers @{ "Authorization" = "Bearer $token" } -OutFile "test-config-2.ovpn"
Get-Content test-config-2.ovpn | Select-String -Pattern "route"
```

## Common CIDR Notations
- **192.168.0.0/24** - 192.168.0.1 to 192.168.0.254 (254 hosts)
- **192.168.1.0/24** - 192.168.1.1 to 192.168.1.254 (254 hosts)
- **10.0.0.0/24** - 10.0.0.1 to 10.0.0.254 (254 hosts)
- **10.0.0.0/16** - 10.0.0.1 to 10.0.255.254 (65,534 hosts)
- **172.16.0.0/24** - 172.16.0.1 to 172.16.0.254 (254 hosts)
- **192.168.0.0/16** - 192.168.0.1 to 192.168.255.254 (65,534 hosts)

## Error Handling
```powershell
# Wrap API calls in try-catch
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks" -Method POST -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body $body
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $_.Exception.Response | ConvertTo-Json
}
```
