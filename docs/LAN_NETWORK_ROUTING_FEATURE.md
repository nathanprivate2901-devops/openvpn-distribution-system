# LAN Network Routing Feature - Implementation Guide

## Overview

The **LAN Network Routing** feature allows users to define custom LAN (Local Area Network) networks that should be accessible through the VPN tunnel. When a user connects to the VPN, traffic destined for their configured LAN networks will automatically be routed through the VPN.

## Use Cases

### 1. Home Office Access
A remote worker wants to access their home network devices (NAS, printers, smart home devices) while traveling.

```
User configures: 192.168.1.0/24 (Home Network)
Result: Can access 192.168.1.x devices from anywhere
```

### 2. Multiple Sites
A user manages multiple locations and needs access to different networks.

```
User configures:
- 192.168.1.0/24 (Home)
- 10.0.0.0/24 (Office)
- 172.16.0.0/24 (Data Center)
Result: Can access all three networks simultaneously through VPN
```

### 3. Department-Specific Access
Different departments need access to different network segments.

```
Engineering: 10.10.0.0/24
Sales: 10.20.0.0/24
HR: 10.30.0.0/24
```

### 4. IoT Device Access
Access IoT devices on a separate subnet.

```
User configures: 192.168.100.0/24 (IoT VLAN)
Result: Can manage IoT devices remotely
```

## Database Schema

### Table: `user_lan_networks`

```sql
CREATE TABLE user_lan_networks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  network_cidr VARCHAR(50) NOT NULL,           -- e.g., "192.168.1.0/24"
  network_ip VARCHAR(15) NOT NULL,             -- e.g., "192.168.1.0"
  subnet_mask VARCHAR(15) NOT NULL,            -- e.g., "255.255.255.0"
  description VARCHAR(255) DEFAULT NULL,       -- User-friendly name
  enabled TINYINT(1) NOT NULL DEFAULT 1,       -- Can be disabled without deleting
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_network (user_id, network_cidr)
);
```

## API Endpoints

### User Endpoints

#### 1. Get User's LAN Networks
```http
GET /api/lan-networks
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "LAN networks retrieved successfully",
  "data": {
    "total": 2,
    "networks": [
      {
        "id": 1,
        "user_id": 1,
        "network_cidr": "192.168.1.0/24",
        "network_ip": "192.168.1.0",
        "subnet_mask": "255.255.255.0",
        "description": "Home Network",
        "enabled": 1,
        "created_at": "2025-11-07T10:00:00.000Z",
        "updated_at": "2025-11-07T10:00:00.000Z"
      }
    ]
  }
}
```

#### 2. Create LAN Network
```http
POST /api/lan-networks
Authorization: Bearer <token>
Content-Type: application/json

{
  "network_cidr": "192.168.1.0/24",
  "description": "Home Network"
}
```

**Response:**
```json
{
  "success": true,
  "message": "LAN network created successfully",
  "data": {
    "id": 1,
    "user_id": 1,
    "network_cidr": "192.168.1.0/24",
    "network_ip": "192.168.1.0",
    "subnet_mask": "255.255.255.0",
    "description": "Home Network",
    "enabled": true
  }
}
```

#### 3. Update LAN Network
```http
PUT /api/lan-networks/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "network_cidr": "192.168.2.0/24",
  "description": "Updated Home Network",
  "enabled": true
}
```

#### 4. Delete LAN Network
```http
DELETE /api/lan-networks/:id
Authorization: Bearer <token>
```

#### 5. Toggle Network Status
```http
PATCH /api/lan-networks/:id/toggle
Authorization: Bearer <token>
```

#### 6. Get Network Suggestions
```http
GET /api/lan-networks/suggestions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Network suggestions retrieved successfully",
  "data": [
    { "cidr": "192.168.0.0/24", "description": "Home Network (192.168.0.x)" },
    { "cidr": "192.168.1.0/24", "description": "Home Network (192.168.1.x)" },
    { "cidr": "10.0.0.0/24", "description": "Office Network (10.0.0.x)" }
  ]
}
```

### Admin Endpoints

#### Get All LAN Networks (Admin)
```http
GET /api/admin/lan-networks?page=1&limit=50
Authorization: Bearer <admin_token>
```

## OpenVPN Configuration Generation

When a user generates an OpenVPN configuration file, their enabled LAN networks are automatically included as `route` directives.

### Example Generated Config

```ovpn
client
dev tun
proto udp
remote vpn.example.com 1194
resolv-retry infinite
nobind
persist-key
persist-tun
cipher AES-256-CBC
auth SHA256
comp-lzo
verb 3

# User: user@example.com
# Generated: 2025-11-07T10:00:00.000Z

# QoS Policy: Premium
# Priority: high
# Max Download Speed: 20480 Kbps
# Max Upload Speed: 20480 Kbps

# ============================================
# LAN Network Routes
# ============================================
# The following networks will be accessible through the VPN tunnel
# Home Network: 192.168.1.0/24
route 192.168.1.0 255.255.255.0
# Office Network: 10.0.0.0/24
route 10.0.0.0 255.255.255.0
# Total LAN networks configured: 2
# ============================================

<ca>
[CA_CERT]
</ca>
...
```

## Security Features

### 1. Private Network Validation
Only RFC 1918 private network ranges are allowed:
- **10.0.0.0/8** (10.0.0.0 - 10.255.255.255)
- **172.16.0.0/12** (172.16.0.0 - 172.31.255.255)
- **192.168.0.0/16** (192.168.0.0 - 192.168.255.255)

### 2. CIDR Validation
- Validates proper CIDR notation (e.g., 192.168.1.0/24)
- Checks IP octets are in range 0-255
- Checks prefix is in range 0-32

### 3. Access Control
- Users can only manage their own networks
- Admins can view all networks
- Network ownership verified on all operations

### 4. Input Sanitization
- All user inputs are sanitized in configuration generation
- Prevents injection attacks in .ovpn files

### 5. Duplicate Prevention
- Unique constraint on (user_id, network_cidr)
- Prevents users from adding same network twice

## Installation Steps

### 1. Run Database Migration
```bash
mysql -u root -p openvpn_system < migrations/add-lan-networks-table.sql
```

### 2. Restart Backend Server
```bash
npm restart
# OR
docker-compose restart backend
```

### 3. Verify Installation
```bash
# Test endpoint
curl -X GET http://localhost:3000/api/lan-networks/suggestions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Usage Examples

### Example 1: Add Home Network
```bash
curl -X POST http://localhost:3000/api/lan-networks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "network_cidr": "192.168.1.0/24",
    "description": "Home Network"
  }'
```

### Example 2: Add Multiple Networks
```javascript
const networks = [
  { cidr: '192.168.1.0/24', description: 'Home' },
  { cidr: '10.0.0.0/24', description: 'Office' },
  { cidr: '172.16.0.0/24', description: 'Data Center' }
];

for (const net of networks) {
  await api.post('/api/lan-networks', {
    network_cidr: net.cidr,
    description: net.description
  });
}
```

### Example 3: Disable Network Temporarily
```bash
curl -X PATCH http://localhost:3000/api/lan-networks/1/toggle \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Example 4: Generate Config with Networks
```bash
# 1. Add networks
curl -X POST http://localhost:3000/api/lan-networks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"network_cidr": "192.168.1.0/24", "description": "Home"}'

# 2. Generate VPN config (networks will be included automatically)
curl -X POST http://localhost:3000/api/vpn/generate-config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Frontend Integration

### React Component Example

```jsx
import { useState, useEffect } from 'react';
import api from '@/lib/api';

function LANNetworkManager() {
  const [networks, setNetworks] = useState([]);
  const [newNetwork, setNewNetwork] = useState({ cidr: '', description: '' });

  useEffect(() => {
    fetchNetworks();
  }, []);

  const fetchNetworks = async () => {
    const response = await api.get('/api/lan-networks');
    setNetworks(response.data.data.networks);
  };

  const addNetwork = async () => {
    await api.post('/api/lan-networks', {
      network_cidr: newNetwork.cidr,
      description: newNetwork.description
    });
    fetchNetworks();
    setNewNetwork({ cidr: '', description: '' });
  };

  const deleteNetwork = async (id) => {
    await api.delete(`/api/lan-networks/${id}`);
    fetchNetworks();
  };

  const toggleNetwork = async (id) => {
    await api.patch(`/api/lan-networks/${id}/toggle`);
    fetchNetworks();
  };

  return (
    <div className="lan-network-manager">
      <h2>LAN Networks</h2>
      
      {/* Add Network Form */}
      <div className="add-form">
        <input
          type="text"
          placeholder="Network CIDR (e.g., 192.168.1.0/24)"
          value={newNetwork.cidr}
          onChange={(e) => setNewNetwork({...newNetwork, cidr: e.target.value})}
        />
        <input
          type="text"
          placeholder="Description (e.g., Home Network)"
          value={newNetwork.description}
          onChange={(e) => setNewNetwork({...newNetwork, description: e.target.value})}
        />
        <button onClick={addNetwork}>Add Network</button>
      </div>

      {/* Network List */}
      <div className="network-list">
        {networks.map(network => (
          <div key={network.id} className="network-item">
            <div>
              <strong>{network.description || 'Unnamed'}</strong>
              <span>{network.network_cidr}</span>
            </div>
            <div>
              <button onClick={() => toggleNetwork(network.id)}>
                {network.enabled ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => deleteNetwork(network.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Testing Guide

### 1. Test Network Creation
```bash
# Create a network
curl -X POST http://localhost:3000/api/lan-networks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "network_cidr": "192.168.1.0/24",
    "description": "Test Network"
  }'

# Should return 201 Created
```

### 2. Test Invalid CIDR
```bash
# Try invalid CIDR
curl -X POST http://localhost:3000/api/lan-networks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "network_cidr": "999.999.999.999/99",
    "description": "Invalid"
  }'

# Should return 400 Bad Request
```

### 3. Test Public Network Rejection
```bash
# Try public IP range
curl -X POST http://localhost:3000/api/lan-networks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "network_cidr": "8.8.8.0/24",
    "description": "Google DNS"
  }'

# Should return 400 - Only private networks allowed
```

### 4. Test Config Generation
```bash
# Generate config
curl -X POST http://localhost:3000/api/vpn/generate-config \
  -H "Authorization: Bearer $TOKEN"

# Download and verify routes are included
curl -X GET http://localhost:3000/api/vpn/config/latest \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### Networks Not Appearing in Config

**Issue:** Added networks but they don't appear in generated .ovpn file

**Solutions:**
1. Ensure networks are enabled: `enabled = 1`
2. Regenerate the config after adding networks
3. Check backend logs for errors

### "Invalid CIDR" Error

**Issue:** Cannot add network, gets validation error

**Solutions:**
1. Use proper CIDR notation: `192.168.1.0/24`
2. Network address must be the base address (not `.1` or `.100`)
3. Use valid prefix (0-32)

### Route Not Working in VPN

**Issue:** Network is in config but can't access devices

**Solutions:**
1. Ensure the OpenVPN server can route to that network
2. Check firewall rules on the destination network
3. Verify the network gateway allows VPN traffic
4. Use `push "route"` on server side if needed

## Performance Considerations

- **Maximum Networks per User:** Recommended limit: 20 networks
- **Database Impact:** Minimal - indexed queries
- **Config File Size:** Each network adds ~2 lines to .ovpn file
- **VPN Performance:** Multiple routes have minimal overhead

## Future Enhancements

### Planned Features
1. **Network Groups** - Create reusable network templates
2. **Auto-discovery** - Scan and suggest networks
3. **Import/Export** - Bulk network import from CSV
4. **Network Testing** - Test connectivity before adding
5. **Analytics** - Track which networks are most used
6. **Scheduling** - Enable networks at specific times

### Ideas for Consideration
- IPv6 network support
- Network priority/ordering
- Bandwidth limits per network
- Network sharing between users (teams)

## Support

For issues or questions:
1. Check the logs: `logs/combined.log`
2. Review API documentation in this file
3. Test with curl commands provided above
4. Check database entries: `SELECT * FROM user_lan_networks WHERE user_id = X`

---

**Last Updated:** November 7, 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready
