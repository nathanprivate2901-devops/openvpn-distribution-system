# OpenVPN Profile Technical Specifications

## Table of Contents
1. [Overview](#overview)
2. [Profile Generation Architecture](#profile-generation-architecture)
3. [Technical Parameters](#technical-parameters)
4. [Network Configuration](#network-configuration)
5. [Security Specifications](#security-specifications)
6. [Dynamic Route Injection](#dynamic-route-injection)
7. [IP Address Management](#ip-address-management)
8. [Certificate Management](#certificate-management)

---

## Overview

The OpenVPN Distribution System generates `.ovpn` configuration files dynamically using the **OpenVPN Access Server sacli** (Server Access Command Line Interface) utility. This document details the technical specifications, parameters, and constraints of the generated profiles.

### Profile Generation Flow

```
User Request → Backend API → Profile Proxy Service → Docker Exec → OpenVPN Container
    ↓
  sacli --user <username> GetUserlogin/GetAutologin
    ↓
Generated .ovpn Profile → LAN Route Injection → Database Storage → User Download
```

---

## Profile Generation Architecture

### 1. Profile Proxy Service

**Location**: `scripts/profile-proxy.js`  
**Runs On**: Host machine (outside Docker)  
**Port**: `3001`  
**Access**: Internal network only (via `host.docker.internal`)

#### Key Functions:

```javascript
// Executes sacli commands in OpenVPN container
execSacli(`docker exec openvpn-server sacli --user "${username}" GetUserlogin`)

// Commands:
// - GetUserlogin: Generates password-authenticated profile
// - GetAutologin: Generates certificate-only profile (no password)
```

#### Available Endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/profile/userlogin` | POST | Generate user-login profile (password required) |
| `/profile/autologin` | POST | Generate auto-login profile (certificate only) |
| `/user/exists` | GET | Verify user exists in OpenVPN server |
| `/health` | GET | Service health check |
| `/sacli/userpropget` | GET | Get all user properties |
| `/sacli/vpnstatus` | GET | Get VPN connection status |

### 2. Backend Service Integration

**Service**: `src/services/openvpnProfileService.js`  
**Controller**: `src/controllers/vpnProfileController.js`

#### Service Configuration:

```javascript
proxyHost: process.env.PROFILE_PROXY_HOST || 'host.docker.internal'
proxyPort: process.env.PROFILE_PROXY_PORT || 3001
proxyUrl: 'http://host.docker.internal:3001'
```

#### Profile Types:

1. **Userlogin Profile** (Default)
   - Requires username + password authentication
   - More secure for end users
   - Generated via: `sacli --user <username> GetUserlogin`

2. **Autologin Profile** (Admin only)
   - Certificate-based authentication
   - No password required
   - Useful for automated systems
   - Generated via: `sacli --user <username> GetAutologin`

---

## Technical Parameters

### Core OpenVPN Configuration Parameters

The generated `.ovpn` files contain the following technical specifications:

#### 1. Connection Parameters

```ini
# Client configuration identifier
client

# Network device type - TUN (Layer 3 IP tunnel)
dev tun

# Transport protocol and port
proto udp
remote <server_address> <port>

# Default server configuration
remote vpn.example.com 1194

# External port mapping (Docker)
# Internal: 1194/udp
# External: 8088/udp (configurable)
```

**Parameter Significance:**
- `dev tun`: Creates Layer 3 IP tunnel (routes IP packets)
- `proto udp`: Uses UDP for better performance (default)
- `remote`: VPN server address and port

**Constraints:**
- Port range: `1-65535`
- Protocol options: `udp`, `tcp`
- Default UDP port: `1194` (mapped to `8088` externally)
- TCP port: `9443` (alternative)

#### 2. Encryption & Security Parameters

```ini
# Data channel cipher - 256-bit AES encryption
cipher AES-256-CBC

# HMAC authentication algorithm
auth SHA256

# TLS version constraints
tls-version-min 1.2

# Renegotiation time (seconds)
reneg-sec 0

# Connection retry settings
resolv-retry infinite
nobind

# Downgrade privileges after initialization
user nobody
group nogroup (Linux) / nobody (Windows)

# Persist key and tunnel on restart
persist-key
persist-tun
```

**Parameter Significance:**

| Parameter | Value | Purpose | Security Level |
|-----------|-------|---------|---------------|
| `cipher` | `AES-256-CBC` | Data encryption | Military-grade |
| `auth` | `SHA256` | Packet authentication | Strong HMAC |
| `tls-version-min` | `1.2` | Minimum TLS version | Modern standard |
| `cipher` (Alternative) | `AES-256-GCM` | AEAD cipher | Higher performance |

**Constraints:**
- Cipher options: `AES-256-CBC`, `AES-256-GCM`, `AES-128-CBC`
- Auth algorithms: `SHA256`, `SHA384`, `SHA512`, `SHA1` (legacy)
- TLS versions: `1.2` (minimum), `1.3` (preferred)

#### 3. Compression & Optimization

```ini
# Compression (deprecated in modern OpenVPN)
comp-lzo no

# Alternative compression
compress lz4-v2

# MTU discovery
mssfix 0

# Traffic shaping
sndbuf 0
rcvbuf 0
```

**Parameter Significance:**
- `comp-lzo`: Legacy compression (disabled for security)
- `compress lz4-v2`: Modern compression algorithm
- `mssfix`: TCP MSS adjustment for tunneling
- `sndbuf`/`rcvbuf`: Buffer sizes (0 = OS default)

#### 4. Keep-Alive & Connection Monitoring

```ini
# Ping remote every N seconds
ping 10

# Restart if no ping received in N seconds  
ping-restart 60

# Send ping-exit notification on shutdown
explicit-exit-notify 3

# Keep connection alive through NAT
keepalive 10 60
```

**Constraints:**
- Ping interval: `5-30 seconds` (typical)
- Timeout: `60-120 seconds` (typical)
- Must balance between responsiveness and bandwidth

#### 5. DNS & Routing

```ini
# Push DNS settings from server
dhcp-option DNS 8.8.8.8
dhcp-option DNS 8.8.4.4

# Pull routes and options from server
pull

# Route all traffic through VPN (full tunnel)
redirect-gateway def1

# Or route specific networks only (split tunnel)
route 10.0.0.0 255.255.255.0
route 192.168.1.0 255.255.255.0
```

---

## Network Configuration

### VPN IP Address Management

#### IP Address Pool Configuration

**OpenVPN Access Server Default Pools:**

| Network Type | CIDR | IP Range | Available IPs | Usage |
|--------------|------|----------|---------------|-------|
| VPN Clients | `172.27.224.0/20` | `172.27.224.1` - `172.27.239.254` | 4,094 | Dynamic client IPs |
| Alternative | `10.8.0.0/24` | `10.8.0.1` - `10.8.0.254` | 254 | Small deployments |
| Alternative | `10.0.0.0/16` | `10.0.0.1` - `10.0.255.254` | 65,534 | Large deployments |

**Constraints:**
- Must not overlap with LAN networks
- Must not overlap with server network
- Recommended: Use RFC 1918 private address space
  - `10.0.0.0/8` (Class A)
  - `172.16.0.0/12` (Class B)
  - `192.168.0.0/16` (Class C)

#### IP Assignment Strategy

```
Client connects → DHCP assignment from pool → IP associated with username
   ↓
Stored in OpenVPN AS database → Tracked in system DB
   ↓
Static binding possible for persistent IPs
```

**IP Persistence:**
- First connection: Assigns from pool
- Subsequent connections: Attempts to reuse same IP
- IP released after: Disconnect + timeout period
- Force new IP: Admin can reset user's IP binding

### Server Network Configuration

```ini
# OpenVPN server network configuration
server 172.27.224.0 255.255.240.0

# Enable client-to-client routing
client-to-client

# Assign specific IPs to clients (optional)
ifconfig-pool 172.27.224.100 172.27.239.254

# Enable IP forwarding
push "redirect-gateway def1"
```

---

## Dynamic Route Injection

### LAN Network Routing Feature

**Database Table**: `user_lan_networks`

#### Schema:

```sql
CREATE TABLE user_lan_networks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  network_cidr VARCHAR(18) NOT NULL,    -- e.g., "192.168.1.0/24"
  network_ip VARCHAR(15) NOT NULL,       -- e.g., "192.168.1.0"
  subnet_mask VARCHAR(15) NOT NULL,      -- e.g., "255.255.255.0"
  description VARCHAR(255),
  enabled TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Route Injection Process

**File**: `src/controllers/vpnProfileController.js`

```javascript
// 1. Generate base profile from OpenVPN AS
const profile = await openvpnProfileService.getUserloginProfile(username);

// 2. Fetch user's enabled LAN networks
const lanNetworks = await UserLanNetwork.findByUserId(userId, true);

// 3. Build route section
let routeSection = '\n# LAN Network Routes\n';
lanNetworks.forEach(network => {
  routeSection += `# ${network.description}: ${network.network_cidr}\n`;
  routeSection += `route ${network.network_ip} ${network.subnet_mask}\n`;
});

// 4. Inject before certificates section
const insertPoint = profile.indexOf('<ca>');
modifiedProfile = profile.substring(0, insertPoint) + 
                  routeSection + 
                  profile.substring(insertPoint);
```

#### Route Directive Format

```ini
# ============================================
# LAN Network Routes
# ============================================
# The following networks will be accessible through the VPN tunnel

# Home Network: 192.168.1.0/24
route 192.168.1.0 255.255.255.0

# Office Network: 10.0.1.0/24
route 10.0.1.0 255.255.255.0

# Data Center: 172.16.0.0/16
route 172.16.0.0 255.255.0.0

# Total LAN networks configured: 3
# ============================================
```

### Supported Network Ranges

#### Common Presets (Available in UI):

| Description | CIDR | Network IP | Subnet Mask | Host Count |
|-------------|------|------------|-------------|------------|
| Home Network | `192.168.1.0/24` | `192.168.1.0` | `255.255.255.0` | 254 |
| Home Network Alt | `192.168.0.0/24` | `192.168.0.0` | `255.255.255.0` | 254 |
| Office Small | `10.0.0.0/24` | `10.0.0.0` | `255.255.255.0` | 254 |
| Office Medium | `10.0.1.0/24` | `10.0.1.0` | `255.255.255.0` | 254 |
| Private Class B | `172.16.0.0/24` | `172.16.0.0` | `255.255.255.0` | 254 |
| Large Network | `192.168.0.0/16` | `192.168.0.0` | `255.255.0.0` | 65,534 |
| Very Large | `10.0.0.0/8` | `10.0.0.0` | `255.0.0.0` | 16,777,214 |

#### CIDR Validation Rules

**Model**: `src/models/UserLanNetwork.js`

```javascript
static isValidCIDR(cidr) {
  // Format: IP/prefix (e.g., 192.168.1.0/24)
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  
  if (!cidrRegex.test(cidr)) return false;
  
  const [ip, prefix] = cidr.split('/');
  const octets = ip.split('.');
  
  // Validate each octet (0-255)
  if (octets.some(o => parseInt(o) > 255 || parseInt(o) < 0)) {
    return false;
  }
  
  // Validate prefix (0-32)
  const prefixNum = parseInt(prefix);
  if (prefixNum < 0 || prefixNum > 32) {
    return false;
  }
  
  return true;
}
```

**Constraints:**
- IP octets: `0-255`
- Prefix length: `0-32` (CIDR notation)
- Format: `X.X.X.X/Y` (strict)
- Must be valid network address (not host address)
- Cannot overlap with VPN pool (enforced by routing)

#### CIDR to Subnet Mask Conversion

```javascript
static parseCIDR(cidr) {
  const [networkIp, prefix] = cidr.split('/');
  const prefixNum = parseInt(prefix);
  
  // Convert prefix to subnet mask
  const mask = -1 << (32 - prefixNum);
  const subnetMask = [
    (mask >>> 24) & 255,
    (mask >>> 16) & 255,
    (mask >>> 8) & 255,
    mask & 255
  ].join('.');
  
  return { networkIp, subnetMask };
}
```

**Examples:**

| CIDR Prefix | Subnet Mask | Binary | Hosts |
|-------------|-------------|--------|-------|
| `/8` | `255.0.0.0` | `11111111.00000000.00000000.00000000` | 16,777,214 |
| `/16` | `255.255.0.0` | `11111111.11111111.00000000.00000000` | 65,534 |
| `/24` | `255.255.255.0` | `11111111.11111111.11111111.00000000` | 254 |
| `/25` | `255.255.255.128` | `11111111.11111111.11111111.10000000` | 126 |
| `/30` | `255.255.255.252` | `11111111.11111111.11111111.11111100` | 2 |

---

## Security Specifications

### Certificate Management

#### Certificate Structure in .ovpn File

```ini
<ca>
-----BEGIN CERTIFICATE-----
MIIDOzCCAiOgAwIBAgIJAKE5V4cZQGIxMA0GCSqGSIb3DQEBCwUAMDQxMjAwBgNV
[... CA certificate content ...]
-----END CERTIFICATE-----
</ca>

<cert>
-----BEGIN CERTIFICATE-----
MIIDRTCCAi2gAwIBAgIRAKm5V4cZQGIyMA0GCSqGSIb3DQEBCwUAMDQxMjAwBgNV
[... User-specific client certificate ...]
-----END CERTIFICATE-----
</cert>

<key>
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC8xHZqZ9vPWyRV
[... User-specific private key - SENSITIVE ...]
-----END PRIVATE KEY-----
</key>

<tls-auth>
-----BEGIN OpenVPN Static key V1-----
a8b45c932e1f4d5c6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f
[... TLS authentication key ...]
-----END OpenVPN Static key V1-----
</tls-auth>
```

#### Certificate Specifications

| Component | Type | Key Size | Validity | Purpose |
|-----------|------|----------|----------|---------|
| CA Certificate | X.509 v3 | 2048-4096 bit RSA | 10 years | Root authority |
| Client Certificate | X.509 v3 | 2048 bit RSA | 1-3 years | User authentication |
| Private Key | RSA Private Key | 2048 bit | N/A | Decryption & signing |
| TLS Auth Key | HMAC SHA256 | 256 bit | N/A | Packet authentication |

#### Security Features

1. **TLS Authentication (`tls-auth`)**
   - Adds HMAC signature to all control channel packets
   - Prevents DoS attacks and port scanning
   - Validates packets before TLS handshake

2. **Certificate Pinning**
   - Client validates server certificate against embedded CA
   - Prevents MITM attacks
   - Server validates client certificate

3. **Perfect Forward Secrecy (PFS)**
   - Ephemeral keys for each session
   - Compromise of long-term keys doesn't expose past sessions
   - Uses Diffie-Hellman key exchange

4. **Control Channel Encryption**
   - TLS 1.2+ with strong cipher suites
   - Separate from data channel encryption
   - Protects authentication credentials

### Authentication Methods

#### 1. Userlogin Profile (Password + Certificate)

```ini
auth-user-pass
# Prompts for username/password at connection time
# Credentials validated against OpenVPN AS user database
```

**Security Flow:**
1. TLS handshake with certificates
2. Username/password challenge
3. Server validates against user database
4. Two-factor authentication possible
5. Connection established

#### 2. Autologin Profile (Certificate Only)

```ini
# No auth-user-pass directive
# Uses certificate for authentication only
```

**Security Flow:**
1. TLS handshake with certificates
2. Server validates client certificate
3. Connection established immediately
4. Less secure but convenient for automation

**Use Cases:**
- Automated systems
- Service accounts
- Site-to-site VPN
- Admin quick access

---

## Profile Generation Security

### Input Sanitization

**File**: `src/controllers/openvpnController.js`

```javascript
function sanitizeConfigValue(value) {
  if (value === null || value === undefined) return 'N/A';
  
  const str = String(value);
  
  // Remove control characters and limit length
  return str
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
    .replace(/[<>'"]/g, '')           // Remove injection chars
    .substring(0, 200);               // Limit length
}
```

**Purpose:**
- Prevent template injection attacks
- Protect against malicious descriptions
- Ensure profile file integrity

### Database Storage

**Table**: `config_files`

```sql
CREATE TABLE config_files (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  qos_policy_id INT NULL,
  filename VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,                    -- Full .ovpn file
  downloaded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Features:**
- Tracks all generated profiles
- Stores complete profile content
- Records download history
- Supports revocation
- Audit trail

**Filename Format:**
```
{username}_{timestamp}.ovpn

Examples:
admin_1736985600000.ovpn
john_1736985700000.ovpn
alice_1736985800000.ovpn
```

---

## API Integration Specifications

### Profile Download Endpoint

**Route**: `GET /api/vpn/profile/download`  
**Authentication**: Required (JWT)  
**Authorization**: User must be email-verified

#### Request:
```http
GET /api/vpn/profile/download HTTP/1.1
Host: dree.asuscomm.com:3000
Authorization: Bearer <jwt_token>
```

#### Response Headers:
```http
HTTP/1.1 200 OK
Content-Type: application/x-openvpn-profile
Content-Disposition: attachment; filename="username_1736985600000.ovpn"
Content-Length: 8456
```

#### Response Body:
```
# Automatically generated OpenVPN client config file
# Generated on 2026-01-15 by openvpn-server
# OVPN_ACCESS_SERVER_USERNAME=username

client
dev tun
proto udp
remote vpn.example.com 1194
[... rest of configuration ...]
```

### Profile Generation Process

```javascript
// 1. Validate user
const user = await User.findById(userId);
if (!user.email_verified) {
  throw new Error('Email verification required');
}

// 2. Generate from OpenVPN AS
const profile = await openvpnProfileService.getUserloginProfile(user.username);

// 3. Inject LAN routes
const lanNetworks = await UserLanNetwork.findByUserId(userId, true);
const modifiedProfile = injectRoutes(profile, lanNetworks);

// 4. Save to database
await ConfigFile.create(userId, null, filename, modifiedProfile);

// 5. Send email notification
await sendConfigGeneratedEmail(user.email, filename, modifiedProfile);

// 6. Return to user
res.setHeader('Content-Type', 'application/x-openvpn-profile');
res.send(modifiedProfile);
```

---

## Performance & Scalability

### Profile Generation Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Proxy request | 50-200ms | HTTP call to host |
| sacli execution | 100-500ms | Docker exec overhead |
| Route injection | 1-10ms | In-memory string operation |
| Database save | 10-50ms | INSERT operation |
| Total | 200-800ms | Acceptable for user experience |

### Caching Strategy

**Not Implemented** (Profiles are generated fresh each time)

**Rationale:**
- Ensures latest LAN network routes
- Reflects current user permissions
- Small performance penalty acceptable
- Security: Prevents stale certificates

**Future Optimization:**
- Cache profiles for 5-10 minutes
- Invalidate on LAN network changes
- Background regeneration on updates

---

## Error Handling

### Common Errors & Resolution

| Error | Cause | Resolution |
|-------|-------|------------|
| `User does not exist in OpenVPN AS` | User not synced | Run sync: `POST /api/openvpn/sync/all` |
| `Profile proxy unreachable` | Proxy not running | Start: `node scripts/profile-proxy.js` |
| `Email verification required` | User email not verified | Verify email first |
| `Invalid CIDR notation` | Malformed network | Use format: `X.X.X.X/Y` |
| `HTTP 500` | OpenVPN container down | Check: `docker ps` |

---

## Constraints Summary

### Technical Constraints

1. **Network Constraints**
   - VPN IP pool: Must be RFC 1918 private space
   - LAN routes: Cannot overlap with VPN pool
   - Maximum routes: ~100 per profile (practical limit)
   - CIDR prefix: `/0` to `/32` (IPv4 only)

2. **Performance Constraints**
   - Profile generation: 200-800ms per request
   - Concurrent generations: Limited by Docker exec
   - File size: ~4-12 KB typical (with certificates)
   - Maximum profile size: No hard limit

3. **Security Constraints**
   - TLS minimum version: 1.2
   - Certificate key size: 2048 bit minimum
   - Password complexity: Enforced by user policy
   - Session timeout: Configurable (default: 24h)

4. **System Constraints**
   - OpenVPN AS license: Concurrent connection limit
   - Database storage: TEXT field for profile content
   - Docker socket access: Required for proxy
   - Network accessibility: Proxy must reach container

---

## Configuration Reference

### Environment Variables

```bash
# Profile Proxy Service
PROFILE_PROXY_PORT=3001
OPENVPN_CONTAINER_NAME=openvpn-server

# Backend Service
PROFILE_PROXY_HOST=host.docker.internal
PROFILE_PROXY_PORT=3001

# OpenVPN Server
OPENVPN_SERVER=vpn.example.com
OPENVPN_PORT=1194
OPENVPN_PROTOCOL=udp
OPENVPN_CIPHER=AES-256-GCM
OPENVPN_AUTH=SHA256
```

### Docker Configuration

```yaml
# docker-compose.yml
services:
  openvpn-server:
    image: openvpn/openvpn-as:latest
    container_name: openvpn-server
    ports:
      - "943:943/tcp"    # Admin UI
      - "444:443/tcp"    # Client UI
      - "9443:9443/tcp"  # TCP
      - "8088:1194/udp"  # UDP
    volumes:
      - openvpn_config:/openvpn
```

---

## Testing & Validation

### Validate Generated Profile

```bash
# Download profile
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/vpn/profile/download \
  -o test.ovpn

# Verify syntax
openvpn --config test.ovpn --show-digests

# Check certificates
openssl x509 -in <(sed -n '/<cert>/,/<\/cert>/p' test.ovpn | sed '1d;$d') -text -noout

# Test connection
openvpn --config test.ovpn
```

### Verify LAN Routes

```bash
# Check generated routes in profile
grep "^route" test.ovpn

# Example output:
# route 192.168.1.0 255.255.255.0
# route 10.0.0.0 255.255.255.0
```

---

## References

- **OpenVPN Manual**: https://openvpn.net/community-resources/reference-manual-for-openvpn-2-4/
- **OpenVPN Access Server**: https://openvpn.net/access-server-manual/
- **sacli Documentation**: https://openvpn.net/access-server-command-line-tools/
- **RFC 1918** (Private Address Space): https://datatracker.ietf.org/doc/html/rfc1918
- **CIDR Notation**: https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing

---

**Document Version**: 1.0  
**Last Updated**: January 15, 2026  
**Author**: System Documentation
