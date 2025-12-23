# Add Windows Firewall rules to allow LAN access to OpenVPN services
# Run this script as Administrator

Write-Host "Adding Windows Firewall rules for OpenVPN services..." -ForegroundColor Green

# Frontend Dashboard (port 3002)
New-NetFirewallRule -DisplayName "OpenVPN Frontend (3002)" `
    -Direction Inbound `
    -LocalPort 3002 `
    -Protocol TCP `
    -Action Allow `
    -Profile Private `
    -Description "Allow LAN access to OpenVPN Frontend Dashboard"

# Backend API (port 3000)
New-NetFirewallRule -DisplayName "OpenVPN Backend API (3000)" `
    -Direction Inbound `
    -LocalPort 3000 `
    -Protocol TCP `
    -Action Allow `
    -Profile Private `
    -Description "Allow LAN access to OpenVPN Backend API"

# OpenVPN Admin UI (port 943)
New-NetFirewallRule -DisplayName "OpenVPN Admin UI (943)" `
    -Direction Inbound `
    -LocalPort 943 `
    -Protocol TCP `
    -Action Allow `
    -Profile Private `
    -Description "Allow LAN access to OpenVPN Admin Interface"

# OpenVPN Client UI (port 444)
New-NetFirewallRule -DisplayName "OpenVPN Client UI (444)" `
    -Direction Inbound `
    -LocalPort 444 `
    -Protocol TCP `
    -Action Allow `
    -Profile Private `
    -Description "Allow LAN access to OpenVPN Client Interface"

# OpenVPN TCP Connection (port 9443)
New-NetFirewallRule -DisplayName "OpenVPN TCP (9443)" `
    -Direction Inbound `
    -LocalPort 9443 `
    -Protocol TCP `
    -Action Allow `
    -Profile Private `
    -Description "Allow OpenVPN TCP connections"

# OpenVPN UDP Connection (port 8088)
New-NetFirewallRule -DisplayName "OpenVPN UDP (8088)" `
    -Direction Inbound `
    -LocalPort 8088 `
    -Protocol UDP `
    -Action Allow `
    -Profile Private `
    -Description "Allow OpenVPN UDP connections"

# MySQL Database (port 3306) - OPTIONAL, comment out if you don't want to expose
New-NetFirewallRule -DisplayName "MySQL Database (3306)" `
    -Direction Inbound `
    -LocalPort 3306 `
    -Protocol TCP `
    -Action Allow `
    -Profile Private `
    -Description "Allow LAN access to MySQL Database"

Write-Host "`nFirewall rules added successfully!" -ForegroundColor Green
Write-Host "`nYou can now access services from other devices on your LAN:" -ForegroundColor Cyan
Write-Host "  Frontend:  http://10.77.0.182:3002" -ForegroundColor Yellow
Write-Host "  API:       http://10.77.0.182:3000" -ForegroundColor Yellow
Write-Host "  Admin:     https://10.77.0.182:943" -ForegroundColor Yellow
Write-Host "  Client:    https://10.77.0.182:444" -ForegroundColor Yellow
Write-Host "  VPN (UDP): 10.77.0.182:8088" -ForegroundColor Yellow
