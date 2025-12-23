# OpenVPN Quick Start Guide

## Your OpenVPN Access Server is Running! ✅

### Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Admin UI** | https://localhost:943/admin | username: `openvpn`<br>password: `admin123` |
| **Client UI** | https://localhost:444/ | (same as admin) |
| **Backend API** | http://localhost:3000 | See API docs |
| **Frontend** | http://localhost:3001 | Web interface |

### Quick Commands

```bash
# View all running services
docker-compose ps

# View OpenVPN logs
docker-compose logs -f openvpn-server

# Restart OpenVPN server
docker-compose restart openvpn-server

# Stop all services
docker-compose down

# Start all services
docker-compose up -d
```

### VPN Connection Ports

- **UDP**: Port 1194 (default, recommended)
- **TCP**: Port 9443 (fallback)
- **Admin**: Port 943 (HTTPS)
- **Client**: Port 444 (HTTPS)

### Next Steps

1. **Login to Admin UI**: https://localhost:943/admin
   - Use credentials: `openvpn` / `admin123`

2. **Change Admin Password**:
   - Go to User Management → User Permissions
   - Update password for `openvpn` user

3. **Configure Server Settings**:
   - Network Settings → Hostname/IP: Set to your public IP or domain
   - VPN Settings → Routing: Configure network access
   - Apply Configuration (click "Save Settings" + "Update Running Server")

4. **Create VPN Users**:
   - User Management → User Permissions
   - Add new users or import from your distribution system

5. **Update .env File**:
   ```env
   OPENVPN_SERVER=your-public-ip-or-domain.com
   OPENVPN_PORT=1194
   OPENVPN_PROTOCOL=udp
   ```

6. **Restart Backend** (to pick up new config):
   ```bash
   docker-compose restart backend
   ```

### Test VPN Connection

1. Download client config from: https://localhost:444/
2. Login with `openvpn` / `admin123`
3. Download "Yourself (autologin profile)"
4. Import `.ovpn` file into OpenVPN Connect client
5. Connect!

### Management Commands

```bash
# Change admin password
docker exec openvpn-server sacli --user openvpn --new_pass YOUR_NEW_PASSWORD SetLocalPassword

# Create new VPN user
docker exec openvpn-server sacli --user john --new_pass johns_password SetLocalPassword

# Make user admin
docker exec openvpn-server sacli --user john --key prop_superuser --value true UserPropPut

# View active connections
docker exec openvpn-server sacli VPNSummary

# View server status
docker exec openvpn-server sacli Status

# Restart OpenVPN service
docker exec openvpn-server sacli start
```

### Integration with Distribution System

Your backend API endpoints for OpenVPN config generation:

```bash
# Generate config for authenticated user
curl -X POST http://localhost:3000/api/openvpn/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Download generated config
curl http://localhost:3000/api/openvpn/download/CONFIG_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o myconfig.ovpn
```

### Troubleshooting

**Can't access Admin UI?**
- Check container is running: `docker ps | grep openvpn-server`
- Check port not blocked by firewall
- Try: https://localhost:943/admin (note: HTTPS, not HTTP)
- Accept self-signed certificate warning in browser

**Forgot password?**
```bash
docker exec openvpn-server sacli --user openvpn --new_pass admin123 SetLocalPassword
```

**Container keeps restarting?**
```bash
docker-compose logs openvpn-server
```

**VPN clients can't connect?**
- Verify OPENVPN_SERVER in `.env` matches your public IP/domain
- Check firewall allows UDP 1194 and TCP 9443
- Ensure port forwarding is configured on your router

### Important Security Notes

⚠️ **CHANGE DEFAULT PASSWORD IMMEDIATELY!**

⚠️ **For Production:**
- Use strong admin password
- Set OPENVPN_SERVER to your actual domain/IP
- Configure SSL certificates (Let's Encrypt)
- Set up firewall rules
- Limit admin access by IP
- Enable 2FA if supported

### Support

- Full setup guide: [OPENVPN_SETUP.md](OPENVPN_SETUP.md)
- Project docs: [CLAUDE.md](CLAUDE.md)
- OpenVPN docs: https://openvpn.net/access-server-manual/

---

**Container Status:**
```bash
$ docker-compose ps
NAME               STATUS
openvpn-backend    Up 17 minutes (healthy)
openvpn-frontend   Up 46 minutes (unhealthy)
openvpn-mysql      Up 46 minutes (healthy)
openvpn-server     Up 1 minute (healthy)  ✅
```

🎉 **Your OpenVPN Access Server is ready to use!**
