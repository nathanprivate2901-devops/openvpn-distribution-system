# OpenVPN Access Server Setup Guide

This guide explains how to use the integrated OpenVPN Access Server with your distribution system.

## Quick Start

### 1. Start All Services

```bash
docker-compose up -d
```

This will start:
- MySQL database
- Node.js backend
- Next.js frontend
- **OpenVPN Access Server**

### 2. Access OpenVPN Admin UI

Once the containers are running, access the OpenVPN Access Server admin interface:

**URL:** https://localhost:943/admin

**Default Credentials:**
- Username: `openvpn`
- Password: `admin123` (configured during setup)

### 3. Initial OpenVPN Configuration

1. **Login to Admin UI** at https://localhost:943/admin
2. **Accept the EULA**
3. **Set Admin Password** - Change from the auto-generated password
4. **Configure Network Settings:**
   - Hostname or IP Address: Your public IP or domain
   - Protocol: UDP (port 1194) or TCP (port 9443)
   - Routing: Enable routing for your network

5. **Apply Configuration** and wait for the server to restart

### 4. Update Your Distribution System

After configuring the OpenVPN server, update your `.env` file:

```env
# Use your public domain or IP address
OPENVPN_SERVER=your-domain.com  # or your public IP
OPENVPN_PORT=1194
OPENVPN_PROTOCOL=udp
```

## Service Ports

| Service | Port | Description |
|---------|------|-------------|
| OpenVPN Admin UI | 943 | Web-based admin interface (HTTPS) |
| OpenVPN TCP | 9443 | VPN connections over TCP |
| OpenVPN UDP | 1194 | VPN connections over UDP (default) |
| Backend API | 3000 | Distribution system API |
| Frontend | 3001 | Web dashboard |
| MySQL | 3306 | Database (internal) |

## Managing the OpenVPN Server

### View Logs
```bash
docker-compose logs -f openvpn-server
```

### Restart Server
```bash
docker-compose restart openvpn-server
```

### Stop Server
```bash
docker-compose stop openvpn-server
```

### Access Server Shell
```bash
docker exec -it openvpn-server bash
```

## Certificate Management

### Retrieve CA Certificate

The CA certificate is needed for client configurations:

```bash
# Access the container
docker exec -it openvpn-server bash

# CA cert location (depends on OpenVPN AS version)
cat /config/etc/ssl/ca.crt
```

You can also download it from the admin UI:
- Navigate to **Configuration** → **Certificates**
- Download the CA certificate

### Update Backend Configuration

Update `.env` to point to the correct CA certificate path:

```env
OPENVPN_CA_CERT_PATH=/config/etc/ssl/ca.crt
```

## Integration with Distribution System

### How It Works

1. **User Registration:**
   - User registers via your backend API
   - Email verification sent

2. **Config Generation:**
   - Authenticated user requests OpenVPN config
   - Backend generates `.ovpn` file using:
     - OpenVPN server address (from `.env`)
     - User-specific QoS policies
     - CA certificate from OpenVPN server

3. **User Connection:**
   - User downloads `.ovpn` config
   - Connects to your Docker-hosted OpenVPN server
   - QoS policies applied

### API Endpoints

Your distribution system provides these endpoints:

```bash
# Generate OpenVPN config for user
POST /api/openvpn/generate
Authorization: Bearer <user_token>

# Download config file
GET /api/openvpn/download/:configId
Authorization: Bearer <user_token>

# Admin: View all configs
GET /api/admin/configs
Authorization: Bearer <admin_token>
```

## Production Deployment

### Security Checklist

- [ ] Change OpenVPN admin password
- [ ] Update `OPENVPN_SERVER` to your public domain/IP
- [ ] Configure firewall rules for ports 943, 1194, 9443
- [ ] Enable SSL/TLS certificates (Let's Encrypt recommended)
- [ ] Set up proper DNS records
- [ ] Configure backup for `/openvpn_config` volume
- [ ] Review OpenVPN Access Server user limits (free: 2 users)

### Firewall Configuration

Allow incoming connections:

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 943/tcp   # Admin UI
sudo ufw allow 1194/udp  # OpenVPN UDP
sudo ufw allow 9443/tcp  # OpenVPN TCP

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=943/tcp
sudo firewall-cmd --permanent --add-port=1194/udp
sudo firewall-cmd --permanent --add-port=9443/tcp
sudo firewall-cmd --reload
```

### Domain Configuration

Point your domain to your server:

```
A Record: vpn.yourdomain.com → Your Server IP
```

Then update `.env`:

```env
OPENVPN_SERVER=vpn.yourdomain.com
```

## Troubleshooting

### Container Won't Start

**Error:** "ERROR: Cannot create container for service openvpn-server: device /dev/net/tun not found"

**Solution:**
```bash
# Create TUN device (Linux)
sudo mkdir -p /dev/net
sudo mknod /dev/net/tun c 10 200
sudo chmod 600 /dev/net/tun
```

For Windows with WSL2, ensure WSL kernel supports TUN/TAP.

### Can't Access Admin UI

**Error:** "Connection refused on port 943"

**Check:**
1. Container is running: `docker ps | grep openvpn-server`
2. Logs for errors: `docker-compose logs openvpn-server`
3. Port not blocked by firewall
4. Use `https://` not `http://`

### Client Can't Connect

**Check:**
1. OpenVPN server hostname/IP is correct
2. Firewall allows UDP port 1194
3. Client config has correct CA certificate
4. OpenVPN service is running in container

## Advanced Configuration

### Custom OpenVPN Image

The default image is `openvpn/openvpn-as:latest` (official OpenVPN Access Server).

If you want to use a different image:

```env
OPENVPN_IMAGE=your-registry/custom-openvpn:tag
```

**Note:** If using a different image, you may need to adjust volume mounts and environment variables accordingly.

### Change Ports

To use different ports, update `.env`:

```env
OPENVPN_PORT=1195
OPENVPN_ADMIN_PORT=8443
OPENVPN_TCP_PORT=8444
```

### Backup Configuration

```bash
# Backup OpenVPN config volume
docker run --rm -v openvpn-server-config:/config \
  -v $(pwd):/backup ubuntu tar czf /backup/openvpn-backup.tar.gz /config

# Restore
docker run --rm -v openvpn-server-config:/config \
  -v $(pwd):/backup ubuntu tar xzf /backup/openvpn-backup.tar.gz -C /
```

## Monitoring

### Check Server Status

```bash
# Container health
docker ps --format "table {{.Names}}\t{{.Status}}" | grep openvpn

# Resource usage
docker stats openvpn-server --no-stream

# Active connections
docker exec openvpn-server sacli VPNSummary
```

### Logs

```bash
# Real-time logs
docker-compose logs -f openvpn-server

# Last 100 lines
docker-compose logs --tail=100 openvpn-server
```

## User Management

OpenVPN Access Server has two management options:

1. **Admin UI:** Create users manually via web interface
2. **Integration:** Use your distribution system's user database

For full integration, consider:
- Setting up OpenVPN to use external authentication (RADIUS, LDAP)
- Using the OpenVPN Access Server API to sync users
- Implementing custom authentication scripts

## Resources

- [OpenVPN Access Server Docs](https://openvpn.net/access-server-manual/)
- [LinuxServer.io OpenVPN AS Image](https://docs.linuxserver.io/images/docker-openvpn-as)
- [Docker OpenVPN Guide](https://github.com/kylemanna/docker-openvpn)

## Support

For issues specific to:
- **Distribution System:** Check [backend logs](logs/combined.log)
- **OpenVPN Server:** Check container logs
- **Docker:** Run `docker-compose ps` and `docker-compose logs`
