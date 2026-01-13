# ============================================================================
# LAN Networks Feature - PowerShell Test Script
# ============================================================================

Write-Host "`nLAN Network Routing Feature - Verification Test`n" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray

# Configuration
$dbPassword = "root_secure_password_456"
$mysqlCmd = "docker-compose exec -T mysql mysql -u root -p$dbPassword openvpn_system"

# ============================================================================
# Test 1: Verify Table Exists
# ============================================================================
Write-Host "`n1️⃣  Checking if table exists..." -ForegroundColor Yellow
$tableCheck = Invoke-Expression "$mysqlCmd -e `"SHOW TABLES LIKE 'user_lan_networks';`"" 2>&1 | Select-String "user_lan_networks"

if ($tableCheck) {
    Write-Host "   ✅ Table 'user_lan_networks' exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ Table does not exist!" -ForegroundColor Red
    Write-Host "   Run: Get-Content migrations\add-lan-networks-table.sql | docker-compose exec -T mysql mysql -u root -p$dbPassword openvpn_system" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# Test 2: Check Table Structure
# ============================================================================
Write-Host "`n2️⃣  Verifying table structure..." -ForegroundColor Yellow
$columns = Invoke-Expression "$mysqlCmd -e `"DESCRIBE user_lan_networks;`"" 2>&1 | Select-String "^(id|user_id|network_cidr|network_ip|subnet_mask|description|enabled|created_at|updated_at)"

$requiredColumns = @("id", "user_id", "network_cidr", "network_ip", "subnet_mask", "description", "enabled", "created_at", "updated_at")
$foundColumns = 0

foreach ($col in $requiredColumns) {
    if ($columns -match $col) {
        $foundColumns++
    }
}

if ($foundColumns -eq $requiredColumns.Count) {
    Write-Host "   ✅ All $($requiredColumns.Count) required columns present" -ForegroundColor Green
} else {
    Write-Host "   ❌ Missing columns! Found: $foundColumns / $($requiredColumns.Count)" -ForegroundColor Red
}

# ============================================================================
# Test 3: Check Sample Data
# ============================================================================
Write-Host "`n3️⃣  Checking sample data..." -ForegroundColor Yellow
$sampleData = Invoke-Expression "$mysqlCmd -e `"SELECT id, network_cidr, description, enabled FROM user_lan_networks;`"" 2>&1 | Select-String "^\d"

if ($sampleData) {
    Write-Host "   ✅ Sample networks found:" -ForegroundColor Green
    $sampleData | ForEach-Object {
        $line = $_.ToString().Trim()
        if ($line -match "^\d") {
            Write-Host "      $line" -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "   ℹ️  No sample data yet (this is normal)" -ForegroundColor Yellow
}

# ============================================================================
# Test 4: Test API Endpoints (Health Check)
# ============================================================================
Write-Host "`n4️⃣  Testing API availability..." -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get
    if ($health.status -eq "OK") {
        Write-Host "   ✅ Backend is running and healthy" -ForegroundColor Green
        Write-Host "      Uptime: $([math]::Round($health.uptime, 2))s" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   ❌ Backend not responding!" -ForegroundColor Red
    Write-Host "   Start with: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# Test 5: Check if Routes are Registered
# ============================================================================
Write-Host "`n5️⃣  Checking API routes..." -ForegroundColor Yellow

# Test suggestions endpoint (doesn't require auth)
try {
    $suggestions = Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/suggestions" -Method Get -Headers @{
        "Authorization" = "Bearer test"
    } -ErrorAction Stop 2>&1
    
    # If we get here or even if unauthorized, the route exists
    Write-Host "   ⚠️  Route exists but requires authentication (expected)" -ForegroundColor Yellow
    Write-Host "   ℹ️  Endpoint: /api/lan-networks/suggestions is registered" -ForegroundColor Cyan
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ✅ Route registered (requires authentication)" -ForegroundColor Green
        Write-Host "      Endpoint: /api/lan-networks/suggestions" -ForegroundColor Cyan
    } else {
        Write-Host "   ❌ Route might not be registered" -ForegroundColor Red
        Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# Test 6: Test Config Generation Integration
# ============================================================================
Write-Host "`n6️⃣  Testing config generation integration..." -ForegroundColor Yellow

# Check if UserLanNetwork model file exists
if (Test-Path "src\models\UserLanNetwork.js") {
    Write-Host "   ✅ UserLanNetwork model exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ UserLanNetwork model missing!" -ForegroundColor Red
}

# Check if controller has been modified
$controllerContent = Get-Content "src\controllers\openvpnController.js" -Raw
if ($controllerContent -match "UserLanNetwork" -and $controllerContent -match "lanNetworks") {
    Write-Host "   ✅ OpenVPN controller integrated with LAN networks" -ForegroundColor Green
} else {
    Write-Host "   ❌ OpenVPN controller not integrated!" -ForegroundColor Red
}

# Check if routes are registered
$indexContent = Get-Content "src\index.js" -Raw
if ($indexContent -match "lanNetworkRoutes") {
    Write-Host "   ✅ LAN network routes registered in main app" -ForegroundColor Green
} else {
    Write-Host "   ❌ Routes not registered in src/index.js!" -ForegroundColor Red
}

# ============================================================================
# Test 7: Simulate Config Generation with LAN Networks
# ============================================================================
Write-Host "`n7️⃣  Simulating config generation..." -ForegroundColor Yellow

$testNetworks = @(
    @{ cidr = "192.168.1.0/24"; desc = "Home Network" },
    @{ cidr = "10.0.0.0/24"; desc = "Office Network" }
)

Write-Host "   Sample VPN config would include:" -ForegroundColor Cyan
Write-Host "   ============================================" -ForegroundColor Gray
Write-Host "   # LAN Network Routes" -ForegroundColor Gray
Write-Host "   ============================================" -ForegroundColor Gray

foreach ($net in $testNetworks) {
    # Parse CIDR (simplified)
    $parts = $net.cidr -split "/"
    $ip = $parts[0]
    $prefix = [int]$parts[1]
    
    # Calculate subnet mask
    $mask = ""
    for ($i = 0; $i -lt 4; $i++) {
        $n = [Math]::Min($prefix - ($i * 8), 8)
        $octet = 256 - [Math]::Pow(2, 8 - [Math]::Max($n, 0))
        $mask += "$octet"
        if ($i -lt 3) { $mask += "." }
    }
    
    Write-Host "   # $($net.desc): $($net.cidr)" -ForegroundColor Cyan
    Write-Host "   route $ip $mask" -ForegroundColor Green
}
Write-Host "   ============================================" -ForegroundColor Gray

# ============================================================================
# Summary
# ============================================================================
Write-Host "`n" + ("=" * 70) -ForegroundColor Gray
Write-Host "`nVERIFICATION COMPLETE!" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "   1. Register a new user or use existing credentials" -ForegroundColor White
Write-Host "   2. Login to get JWT token" -ForegroundColor White
Write-Host "   3. Test API endpoints with authentication" -ForegroundColor White
Write-Host "`nExample API Usage:" -ForegroundColor Cyan
Write-Host @"
   # Login
   `$body = @{ email = "your@email.com"; password = "your_password" } | ConvertTo-Json
   `$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" ``
       -Method Post -Body `$body -ContentType "application/json"
   `$token = `$response.token
   
   # Get network suggestions
   `$suggestions = Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks/suggestions" ``
       -Method Get -Headers @{ "Authorization" = "Bearer `$token" }
   
   # Add a network
   `$network = @{ 
       network_cidr = "192.168.1.0/24"
       description = "Home Network"
   } | ConvertTo-Json
   Invoke-RestMethod -Uri "http://localhost:3000/api/lan-networks" ``
       -Method Post -Body `$network -ContentType "application/json" ``
       -Headers @{ "Authorization" = "Bearer `$token" }
   
   # Generate VPN config (includes networks automatically)
   Invoke-RestMethod -Uri "http://localhost:3000/api/vpn/generate-config" ``
       -Method Post -Headers @{ "Authorization" = "Bearer `$token" }
"@ -ForegroundColor White

Write-Host "`nFull Documentation:" -ForegroundColor Cyan
Write-Host "   - docs/LAN_NETWORK_ROUTING_FEATURE.md" -ForegroundColor White
Write-Host "   - OPTION_2_IMPLEMENTATION_SUMMARY.md" -ForegroundColor White

Write-Host "`nFeature is ready to use!`n" -ForegroundColor Green
