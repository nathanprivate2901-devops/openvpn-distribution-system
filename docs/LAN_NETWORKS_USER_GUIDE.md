# LAN Network Feature - Quick Reference Guide

## Access URLs

- **Backend API**: http://localhost:3000/api
- **Frontend UI**: http://localhost:3002
- **User LAN Networks**: http://localhost:3002/lan-networks
- **Admin LAN Networks**: http://localhost:3002/admin/lan-networks

## User Guide

### Accessing LAN Networks Page
1. Login to the system at http://localhost:3002/login
2. Click "LAN Networks" in the navigation menu
3. You'll see your configured networks and statistics

### Adding a Network
1. Click the "Add Network" button
2. **Option A**: Select from suggestions dropdown
   - Choose from 7 common network ranges
   - Examples: 192.168.1.0/24, 10.0.0.0/24
3. **Option B**: Enter custom CIDR
   - Format: `192.168.1.0/24`
   - Must be valid CIDR notation
4. Add an optional description (e.g., "Home Network")
5. Click "Create Network"
6. Network appears in the table

### Editing a Network
1. Find your network in the table
2. Click the edit button (pencil icon)
3. Update CIDR or description
4. Click "Update Network"

### Enabling/Disabling a Network
1. Find your network in the table
2. Click the toggle button (power icon)
3. Status changes:
   - Green badge with "Enabled" = Network will be in VPN config
   - Gray badge with "Disabled" = Network excluded from VPN config

### Deleting a Network
1. Find your network in the table
2. Click the delete button (trash icon)
3. Confirm deletion in the dialog
4. Network is permanently removed

### Generating VPN Config with Routes
1. After configuring networks, go to "VPN Configs"
2. Click "Download VPN Profile" or generate new config
3. The config file will include route directives for enabled networks
4. Example routes in the .ovpn file:
   ```
   # LAN Network Routes
   route 192.168.1.0 255.255.255.0
   route 10.0.0.0 255.255.255.0
   ```

## Admin Guide

### Accessing Admin Page
1. Login with admin account
2. Navigate to "Admin" → "All LAN Networks"
3. View all users' networks

### Viewing All Networks
- See networks from all users
- Columns: User, Email, CIDR, IP, Mask, Description, Status, Actions
- 50 networks per page

### Managing User Networks
- **Toggle**: Enable/disable any user's network
- **Delete**: Remove any network (with confirmation)
- Changes affect the user's next VPN config generation

### Pagination
- Use "Previous" and "Next" buttons
- Page indicator shows current page number
- Network count shows total across all pages

## Common Network Ranges

### Home Networks (Class C)
```
192.168.0.0/24   - 192.168.0.1 to 192.168.0.254 (254 hosts)
192.168.1.0/24   - 192.168.1.1 to 192.168.1.254 (254 hosts)
192.168.0.0/16   - 192.168.0.1 to 192.168.255.254 (65,534 hosts)
```

### Office Networks (Class A)
```
10.0.0.0/24      - 10.0.0.1 to 10.0.0.254 (254 hosts)
10.0.1.0/24      - 10.0.1.1 to 10.0.1.254 (254 hosts)
10.0.0.0/8       - 10.0.0.1 to 10.255.255.254 (16,777,214 hosts)
```

### Private Networks (Class B)
```
172.16.0.0/24    - 172.16.0.1 to 172.16.0.254 (254 hosts)
172.16.0.0/12    - 172.16.0.1 to 172.31.255.254 (1,048,574 hosts)
```

## CIDR Notation Quick Reference

| CIDR | Subnet Mask     | Hosts | Description           |
|------|----------------|-------|-----------------------|
| /8   | 255.0.0.0      | 16M   | Very large network    |
| /16  | 255.255.0.0    | 65K   | Large network         |
| /24  | 255.255.255.0  | 254   | Standard network      |
| /25  | 255.255.255.128| 126   | Half network          |
| /26  | 255.255.255.192| 62    | Quarter network       |
| /27  | 255.255.255.224| 30    | Small network         |
| /28  | 255.255.255.240| 14    | Very small network    |
| /29  | 255.255.255.248| 6     | Tiny network          |
| /30  | 255.255.255.252| 2     | Point-to-point link   |

## Troubleshooting

### Network Not Appearing in VPN Config
1. Check if network is enabled (green badge)
2. Generate a NEW VPN config (old configs don't update)
3. Download the new config file
4. Verify routes in the .ovpn file

### Can't Add Network
- **Error**: "Invalid CIDR notation"
  - Check format: `192.168.1.0/24`
  - IP must be valid (0-255 for each octet)
  - Prefix must be 0-32
- **Error**: "Network already exists"
  - You've already added this network
  - Edit existing network instead

### Network Not Accessible After Connection
1. Verify VPN connection is active
2. Check network is enabled in UI
3. Regenerate VPN config if you added network after last config
4. Verify target network is actually reachable
5. Check firewall rules on target network

### Admin Can't See All Networks
- Verify you're logged in as admin
- Check role in profile (should be "admin")
- Try refreshing the page
- Check browser console for errors

## API Endpoints (For Developers)

### User Endpoints
```
GET    /api/lan-networks/suggestions     - Get common network suggestions
GET    /api/lan-networks                 - Get user's networks
GET    /api/lan-networks/enabled         - Get user's enabled networks
GET    /api/lan-networks/:id             - Get specific network
POST   /api/lan-networks                 - Create network
PUT    /api/lan-networks/:id             - Update network
PATCH  /api/lan-networks/:id/toggle      - Toggle enabled status
DELETE /api/lan-networks/:id             - Delete network
```

### Admin Endpoints
```
GET    /api/lan-networks/all?page=1&limit=50  - Get all networks (paginated)
```

## Docker Commands

### View Container Logs
```powershell
# Frontend logs
docker-compose logs -f frontend

# Backend logs
docker-compose logs -f backend
```

### Restart Containers
```powershell
# Restart frontend
docker-compose restart frontend

# Restart backend
docker-compose restart backend

# Restart all
docker-compose restart
```

### Rebuild After Code Changes
```powershell
# Rebuild frontend
docker-compose up -d --build frontend

# Rebuild backend
docker-compose up -d --build backend
```

## Feature Status

✅ **Database**: user_lan_networks table created  
✅ **Backend API**: 9 endpoints implemented  
✅ **Frontend UI**: User and admin pages deployed  
✅ **Navigation**: Links added to dashboard  
✅ **VPN Integration**: Routes included in configs  
✅ **Docker**: Containers rebuilt and running  

## Support

For issues or questions:
1. Check the documentation files:
   - `LAN_NETWORK_FEATURE_COMPLETE.md`
   - `FRONTEND_LAN_NETWORKS_COMPLETE.md`
   - `docs/LAN_NETWORK_ROUTING_FEATURE.md`
2. Review container logs
3. Test with PowerShell commands in `POWERSHELL_TEST_COMMANDS.md`
4. Verify network CIDR format is correct

## Best Practices

### For Users
- Use descriptive names for networks
- Enable only networks you need
- Disable unused networks instead of deleting (can re-enable later)
- Test connectivity after adding new networks
- Keep track of which networks you've configured

### For Admins
- Monitor network usage across users
- Check for overlapping or conflicting networks
- Advise users on proper CIDR notation
- Use bulk operations (future feature) for managing many networks
- Regular audits of configured networks

## Security Notes

- Networks are user-specific (isolation enforced)
- Only enabled networks appear in VPN configs
- Admins can manage all networks for support purposes
- JWT authentication required for all operations
- CIDR validation prevents invalid network configurations

---

**Last Updated**: 2025-11-07  
**Version**: 1.0  
**Status**: Production Ready ✅
