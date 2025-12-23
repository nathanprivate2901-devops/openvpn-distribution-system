# OpenVPN Server LAN Network Routing Configuration Script
# Run this script whenever you add/remove/enable/disable LAN networks

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OpenVPN LAN Network Routing Sync" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get database password from environment or prompt
$DB_PASSWORD = $env:DB_ROOT_PASSWORD
if (-not $DB_PASSWORD) {
    Write-Host "DB_ROOT_PASSWORD not found in environment" -ForegroundColor Yellow
    $DB_PASSWORD = Read-Host "Enter MySQL root password" -AsSecureString
    $DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD))
}

Write-Host "Fetching enabled LAN networks from database..." -ForegroundColor Green

# Query enabled LAN networks
$query = "SELECT DISTINCT network_cidr FROM user_lan_networks WHERE enabled = 1 ORDER BY network_cidr"
$result = docker-compose exec -T mysql mysql -uroot -p${DB_PASSWORD} -D vpn_nam -e "$query" --skip-column-names 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error querying database:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}

# Parse networks
$networks = @()
foreach ($line in $result -split "`n") {
    $trimmed = $line.Trim()
    if ($trimmed -match '^\d+\.\d+\.\d+\.\d+/\d+$') {
        $networks += $trimmed
    }
}

Write-Host "Found $($networks.Count) enabled LAN network(s):" -ForegroundColor Cyan
foreach ($net in $networks) {
    Write-Host "  - $net" -ForegroundColor White
}
Write-Host ""

if ($networks.Count -eq 0) {
    Write-Host "No LAN networks to configure" -ForegroundColor Yellow
    Write-Host "Add networks at: http://localhost:3002/lan-networks" -ForegroundColor Yellow
    exit 0
}

Write-Host "Configuring OpenVPN server..." -ForegroundColor Green

# Enable NAT routing
Write-Host "  1. Enabling NAT routing mode..." -ForegroundColor Gray
docker exec openvpn-server sacli --key "vpn.server.routing.private_access" --value "nat" ConfigPut | Out-Null

# Add VPN subnet (always index 0)
Write-Host "  2. Adding VPN subnet (10.77.0.0/24)..." -ForegroundColor Gray
docker exec openvpn-server sacli --key "vpn.server.routing.private_network.0" --value "10.77.0.0/24" ConfigPut | Out-Null

# Add each LAN network
$index = 1
foreach ($network in $networks) {
    Write-Host "  $($index + 2). Adding LAN network: $network" -ForegroundColor Gray
    docker exec openvpn-server sacli --key "vpn.server.routing.private_network.$index" --value "$network" ConfigPut | Out-Null
    $index++
}

Write-Host ""
Write-Host "Applying configuration and restarting OpenVPN service..." -ForegroundColor Yellow
$restartResult = docker exec openvpn-server sacli start | ConvertFrom-Json

if ($restartResult.errors -and $restartResult.errors.PSObject.Properties.Count -gt 0) {
    Write-Host "Errors during restart:" -ForegroundColor Red
    $restartResult.errors | ConvertTo-Json
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "OpenVPN server is now configured to route:" -ForegroundColor Cyan
Write-Host "  - VPN subnet: 10.77.0.0/24" -ForegroundColor White
foreach ($net in $networks) {
    Write-Host "  - LAN network: $net" -ForegroundColor White
}
Write-Host ""
Write-Host "Total networks: $($networks.Count + 1)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Disconnect VPN clients" -ForegroundColor White
Write-Host "  2. Wait 10 seconds" -ForegroundColor White
Write-Host "  3. Reconnect VPN clients" -ForegroundColor White
Write-Host "  4. Test access to LAN networks" -ForegroundColor White
Write-Host ""
Write-Host "To verify configuration:" -ForegroundColor Gray
Write-Host '  docker exec openvpn-server sacli ConfigQuery | Select-String -Pattern "vpn.server.routing"' -ForegroundColor Gray
