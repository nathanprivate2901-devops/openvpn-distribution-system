# Docker Container Management API

Comprehensive Docker API integration for OpenVPN Distribution System. All endpoints require admin authentication.

## CRITICAL SECURITY WARNINGS

### Docker Socket Access Risk

This application requires access to the Docker socket (`/var/run/docker.sock`) which provides **SIGNIFICANT SYSTEM CONTROL**. Understanding these risks is essential:

**Potential Security Issues:**
- **Container Escape**: Malicious containers could potentially escape to the host
- **Privilege Escalation**: Docker socket access is equivalent to root access on the host
- **Data Exfiltration**: Containers can access any host file system path
- **Denial of Service**: Malicious actors could consume all system resources

**Mitigation Measures Implemented:**
1. All Docker API endpoints require admin authentication via JWT
2. Privileged container creation is DISABLED
3. Volume mount paths are validated against a whitelist
4. Resource limits are enforced on created containers
5. All Docker operations are logged for audit purposes

### Production Security Recommendations

**DO NOT deploy this system without implementing these additional safeguards:**

1. **Use Docker Socket Proxy** (Recommended)
   ```yaml
   # Add to docker-compose.yml
   docker-socket-proxy:
     image: tecnativa/docker-socket-proxy
     environment:
       CONTAINERS: 1
       IMAGES: 1
       INFO: 1
       NETWORKS: 0
       VOLUMES: 0
       POST: 1
     volumes:
       - /var/run/docker.sock:/var/run/docker.sock:ro
     networks:
       - openvpn-network

   # Update backend to connect to proxy instead
   backend:
     environment:
       DOCKER_HOST: tcp://docker-socket-proxy:2375
   ```

2. **Network Isolation**
   - Place backend and database in isolated network
   - Use firewall rules to restrict Docker API access
   - Implement network policies for container communication

3. **Audit Logging**
   - Enable detailed Docker audit logging
   - Monitor all container creation/modification events
   - Set up alerts for suspicious activities

4. **Access Control**
   - Implement IP whitelisting for admin endpoints
   - Use strong JWT secrets (minimum 256 bits)
   - Enable multi-factor authentication for admin users
   - Rotate JWT secrets regularly

5. **Regular Security Updates**
   - Keep Docker daemon updated
   - Update base images regularly
   - Scan images for vulnerabilities
   - Monitor CVE databases

6. **Volume Mount Restrictions**
   - Review and update the whitelist in `/src/controllers/dockerController.js`
   - Default allowed paths: `/data/openvpn`, `/etc/openvpn`, `/var/lib/openvpn`
   - NEVER allow mounting root directory or sensitive paths

### Privileged Container Security

**IMPORTANT**: This system has been hardened to prevent privileged container creation:
- Privileged mode is DISABLED by default
- Only NET_ADMIN capability is granted (required for VPN functionality)
- Volume mounts are validated against whitelist
- Resource limits are enforced

If you need to modify these settings, understand that:
- **Privileged containers can escape to the host system**
- **Any compromise of a privileged container = full host compromise**
- **Only grant the minimum capabilities required**

---

## Base URL
```
/api/docker
```

## Authentication
All Docker API endpoints require:
- Valid JWT token in `Authorization` header
- Admin role privileges

```bash
Authorization: Bearer <your-jwt-token>
```

---

## Container Management

### List All Containers
List all Docker containers with optional filtering.

**Endpoint:** `GET /api/docker/containers`

**Query Parameters:**
- `all` (boolean, default: true) - Show all containers including stopped
- `limit` (number) - Limit number of containers returned
- `filters` (JSON string) - Filter containers by criteria

**Examples:**
```bash
# List all containers
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/containers

# List only running containers
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/docker/containers?filters={"status":["running"]}'

# List with limit
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/containers?limit=5
```

**Response:**
```json
{
  "success": true,
  "data": {
    "containers": [
      {
        "id": "abc123...",
        "shortId": "abc123def456",
        "names": ["my-container"],
        "image": "nginx:latest",
        "state": "running",
        "status": "Up 2 hours",
        "ports": [...],
        "networks": ["bridge"],
        "mounts": [...]
      }
    ],
    "count": 5
  }
}
```

---

### Get OpenVPN Containers
Filter and list containers with 'openvpn' in name or image.

**Endpoint:** `GET /api/docker/openvpn-containers`

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/openvpn-containers
```

**Response:**
```json
{
  "success": true,
  "data": {
    "containers": [
      {
        "id": "openvpn123...",
        "shortId": "openvpn123ab",
        "names": ["openvpn-server"],
        "image": "kylemanna/openvpn:latest",
        "state": "running",
        "status": "Up 5 days",
        "ports": [
          {
            "IP": "0.0.0.0",
            "PrivatePort": 1194,
            "PublicPort": 1194,
            "Type": "udp"
          }
        ]
      }
    ],
    "count": 1
  }
}
```

---

### Get Container Details
Retrieve detailed information about a specific container.

**Endpoint:** `GET /api/docker/containers/:id`

**Parameters:**
- `id` (string) - Container ID or name

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/containers/my-container
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123...",
    "name": "my-container",
    "created": "2025-10-14T10:00:00.000Z",
    "state": {
      "status": "running",
      "running": true,
      "paused": false,
      "exitCode": 0,
      "startedAt": "2025-10-14T10:00:05.000Z"
    },
    "config": {
      "hostname": "my-container",
      "env": ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"],
      "image": "nginx:latest"
    },
    "networkSettings": {
      "ipAddress": "172.17.0.2",
      "ports": {...},
      "networks": {...}
    },
    "mounts": [...]
  }
}
```

---

### Start Container
Start a stopped container.

**Endpoint:** `POST /api/docker/containers/:id/start`

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/containers/my-container/start
```

**Response:**
```json
{
  "success": true,
  "message": "Container started successfully",
  "data": {
    "containerId": "my-container"
  }
}
```

---

### Stop Container
Stop a running container.

**Endpoint:** `POST /api/docker/containers/:id/stop`

**Query Parameters:**
- `timeout` (number, default: 10) - Seconds to wait before killing

**Example:**
```bash
# Stop with default timeout (10 seconds)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/containers/my-container/stop

# Stop with custom timeout
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/docker/containers/my-container/stop?timeout=30'
```

**Response:**
```json
{
  "success": true,
  "message": "Container stopped successfully",
  "data": {
    "containerId": "my-container"
  }
}
```

---

### Restart Container
Restart a container.

**Endpoint:** `POST /api/docker/containers/:id/restart`

**Query Parameters:**
- `timeout` (number, default: 10) - Seconds to wait before killing

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/containers/my-container/restart
```

---

### Get Container Logs
Retrieve container logs.

**Endpoint:** `GET /api/docker/containers/:id/logs`

**Query Parameters:**
- `tail` (number, default: 100) - Number of lines to return
- `follow` (boolean, default: false) - Stream logs in real-time
- `stdout` (boolean, default: true) - Include stdout logs
- `stderr` (boolean, default: true) - Include stderr logs
- `timestamps` (boolean, default: true) - Show timestamps

**Example:**
```bash
# Get last 100 lines
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/containers/my-container/logs

# Get last 200 lines with timestamps
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/docker/containers/my-container/logs?tail=200&timestamps=true'

# Get only stderr logs
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/docker/containers/my-container/logs?stdout=false&stderr=true'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "containerId": "my-container",
    "logs": "2025-10-14 10:00:00 Starting nginx...\n2025-10-14 10:00:01 nginx started successfully",
    "linesReturned": 2
  }
}
```

---

### Get Container Statistics
Retrieve real-time container resource usage statistics.

**Endpoint:** `GET /api/docker/containers/:id/stats`

**Query Parameters:**
- `stream` (boolean, default: false) - Stream stats continuously

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/containers/my-container/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "containerId": "my-container",
    "read": "2025-10-14T10:00:00.000Z",
    "cpu": {
      "usage": "2.45",
      "systemUsage": 123456789,
      "onlineCpus": 4
    },
    "memory": {
      "usage": 52428800,
      "usageMB": "50.00",
      "limit": 2147483648,
      "limitMB": "2048.00",
      "percent": "2.44",
      "cache": 1048576
    },
    "network": {
      "eth0": {
        "rxBytes": 1048576,
        "txBytes": 524288,
        "rxPackets": 1024,
        "txPackets": 512
      }
    },
    "blockIO": {
      "read": 0,
      "write": 4096
    },
    "pids": 12
  }
}
```

---

### Remove Container
Delete a container.

**Endpoint:** `DELETE /api/docker/containers/:id`

**Query Parameters:**
- `force` (boolean, default: false) - Force removal of running container
- `volumes` (boolean, default: false) - Remove associated volumes

**Example:**
```bash
# Remove stopped container
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/containers/my-container

# Force remove running container with volumes
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/docker/containers/my-container?force=true&volumes=true'
```

**Response:**
```json
{
  "success": true,
  "message": "Container removed successfully",
  "data": {
    "containerId": "my-container"
  }
}
```

---

## OpenVPN Container Creation

### Create OpenVPN Container
Create a new OpenVPN container with custom configuration.

**SECURITY FEATURES:**
- Volume mounts validated against whitelist
- Privileged mode DISABLED
- Only NET_ADMIN capability granted
- Resource limits enforced (512MB memory, 1GB swap)

**Endpoint:** `POST /api/docker/openvpn/create`

**Request Body:**
```json
{
  "name": "openvpn-server",
  "port": 1194,
  "volumes": [
    "/data/openvpn:/etc/openvpn"
  ],
  "env": [
    "OVPN_SERVER=vpn.example.com"
  ],
  "image": "kylemanna/openvpn:latest"
}
```

**Parameters:**
- `name` (string, required) - Container name
- `port` (number, default: 1194) - Host port to bind
- `volumes` (array, optional) - Volume mappings (validated against whitelist)
- `env` (array, optional) - Environment variables
- `image` (string, default: 'kylemanna/openvpn') - Docker image

**Allowed Volume Paths:**
- `/data/openvpn`
- `/etc/openvpn`
- `/var/lib/openvpn`

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "openvpn-server",
    "port": 1194,
    "volumes": ["/data/openvpn:/etc/openvpn"],
    "env": ["OVPN_SERVER=vpn.example.com"],
    "image": "kylemanna/openvpn:latest"
  }' \
  http://localhost:3000/api/docker/openvpn/create
```

**Success Response:**
```json
{
  "success": true,
  "message": "OpenVPN container created successfully",
  "data": {
    "containerId": "abc123...",
    "name": "openvpn-server",
    "port": 1194,
    "image": "kylemanna/openvpn:latest",
    "securityProfile": {
      "privileged": false,
      "capabilities": ["NET_ADMIN"],
      "volumesValidated": true
    }
  }
}
```

**Error Response (Invalid Volume):**
```json
{
  "success": false,
  "message": "Unauthorized volume mount paths detected",
  "data": {
    "invalidPaths": ["/root", "/etc/shadow"],
    "allowedPaths": ["/data/openvpn", "/etc/openvpn", "/var/lib/openvpn"]
  }
}
```

---

## System Information

### Get Docker System Info
Retrieve Docker daemon information and system details.

**Endpoint:** `GET /api/docker/info`

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "version": {
      "version": "24.0.5",
      "apiVersion": "1.43",
      "goVersion": "go1.20.6",
      "os": "linux",
      "arch": "amd64",
      "kernelVersion": "5.15.0-83-generic"
    },
    "system": {
      "name": "docker-host",
      "serverVersion": "24.0.5",
      "operatingSystem": "Ubuntu 22.04.3 LTS",
      "architecture": "x86_64",
      "cpus": 4,
      "memory": {
        "total": 8374001664,
        "totalGB": "7.80"
      }
    },
    "containers": {
      "total": 10,
      "running": 5,
      "paused": 0,
      "stopped": 5
    },
    "images": 15,
    "storage": {
      "driver": "overlay2"
    }
  }
}
```

---

## Image Management

### List Docker Images
List all Docker images on the system.

**Endpoint:** `GET /api/docker/images`

**Query Parameters:**
- `all` (boolean, default: false) - Show all images including intermediate layers
- `filters` (JSON string) - Filter images by criteria

**Example:**
```bash
# List all images
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/images

# List with filters
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/docker/images?filters={"reference":["openvpn*"]}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "images": [
      {
        "id": "sha256:abc123...",
        "shortId": "abc123def456",
        "repoTags": ["nginx:latest", "nginx:1.25"],
        "created": 1697270400,
        "size": 142523392,
        "sizeMB": "135.95",
        "containers": 2
      }
    ],
    "count": 15
  }
}
```

---

### Pull Docker Image
Pull a Docker image from registry.

**Endpoint:** `POST /api/docker/images/pull`

**Request Body:**
```json
{
  "imageName": "kylemanna/openvpn",
  "tag": "latest"
}
```

**Parameters:**
- `imageName` (string, required) - Image name (can include tag)
- `tag` (string, default: 'latest') - Image tag if not included in imageName

**Example:**
```bash
# Pull latest version
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"imageName": "kylemanna/openvpn", "tag": "latest"}' \
  http://localhost:3000/api/docker/images/pull

# Pull specific tag
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"imageName": "nginx:1.25"}' \
  http://localhost:3000/api/docker/images/pull
```

**Response:**
```json
{
  "success": true,
  "message": "Image pulled successfully",
  "data": {
    "imageName": "kylemanna/openvpn:latest"
  }
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Admin privileges required."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Container not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Container with this name already exists"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Docker API error occurred"
}
```

---

## Security Best Practices

### Configuration Whitelist Management
To modify allowed volume mount paths, edit `/src/controllers/dockerController.js`:

```javascript
const ALLOWED_VOLUME_PATHS = [
  '/data/openvpn',
  '/etc/openvpn',
  '/var/lib/openvpn'
  // Add more paths carefully - validate each addition
];
```

**Guidelines:**
- NEVER allow root directory (`/`)
- NEVER allow sensitive system paths (`/etc/shadow`, `/etc/passwd`, `/root`)
- NEVER allow Docker socket (`/var/run/docker.sock`)
- Use specific, limited paths
- Document the reason for each allowed path

### Audit Logging
All Docker operations are logged to `/app/logs/combined.log`:
```json
{
  "level": "info",
  "message": "Admin admin@example.com creating OpenVPN container",
  "timestamp": "2025-10-14T10:00:00.000Z",
  "metadata": {
    "name": "openvpn-prod",
    "port": 1194,
    "image": "kylemanna/openvpn",
    "volumes": 1
  }
}
```

Monitor these logs for:
- Unauthorized volume mount attempts
- Suspicious container creation patterns
- Unusual resource allocation
- Failed authentication attempts

### Rate Limiting
Docker API endpoints are subject to rate limiting:
- Default: 100 requests per 15 minutes per IP
- Configurable via `RATE_LIMIT_*` environment variables
- Adjust based on your operational needs

---

## Complete Workflow Example

### Secure OpenVPN Container Setup

```bash
#!/bin/bash

# Set your admin token
TOKEN="your-admin-jwt-token"
API_BASE="http://localhost:3000/api/docker"

# 1. Check Docker system info
echo "Checking Docker system..."
curl -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/info"

# 2. Pull OpenVPN image
echo -e "\nPulling OpenVPN image..."
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"imageName": "kylemanna/openvpn", "tag": "latest"}' \
  "$API_BASE/images/pull"

# 3. Create OpenVPN container (with security features)
echo -e "\nCreating OpenVPN container..."
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "openvpn-prod",
    "port": 1194,
    "volumes": ["/data/openvpn:/etc/openvpn"],
    "env": ["OVPN_SERVER=vpn.example.com"]
  }' \
  "$API_BASE/openvpn/create"

# 4. Start the container
echo -e "\nStarting container..."
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/containers/openvpn-prod/start"

# 5. Check container stats
echo -e "\nChecking container stats..."
curl -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/containers/openvpn-prod/stats"

# 6. View container logs
echo -e "\nViewing container logs..."
curl -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/containers/openvpn-prod/logs?tail=50"

# 7. List all OpenVPN containers
echo -e "\nListing OpenVPN containers..."
curl -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/openvpn-containers"

echo -e "\n\nOpenVPN container setup complete!"
```

---

## Testing the API

### Prerequisites
1. Start the backend server
2. Login as admin to get JWT token
3. Set environment variables

```bash
# Start server
npm start

# Login as admin (default credentials from .env.example)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.data.token')

echo "Admin token: $TOKEN"
```

### Quick Test Commands

```bash
# Test 1: List all containers
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/containers | jq

# Test 2: Get Docker system info
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/info | jq

# Test 3: List images
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/images | jq

# Test 4: Get OpenVPN containers
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/docker/openvpn-containers | jq
```

---

## Troubleshooting

### Docker Socket Permission Issues
```bash
# Error: connect EACCES /var/run/docker.sock
sudo chmod 666 /var/run/docker.sock

# Or add user to docker group (preferred)
sudo usermod -aG docker $USER
newgrp docker
```

### Container Not Found
- Verify container ID or name is correct
- Check if container exists: `docker ps -a`

### Image Pull Failures
- Check Docker Hub connectivity
- Verify image name and tag are correct
- Check Docker daemon logs: `journalctl -u docker`

### Permission Denied
- Ensure JWT token is valid
- Verify user has admin role
- Check token expiration

### Volume Mount Rejected
- Ensure volume path is in whitelist
- Check `/src/controllers/dockerController.js` for allowed paths
- Review error response for specific invalid paths

---

## Additional Resources

- [Dockerode Documentation](https://github.com/apocas/dockerode)
- [Docker Engine API](https://docs.docker.com/engine/api/)
- [OpenVPN Docker Image](https://github.com/kylemanna/docker-openvpn)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Docker Socket Proxy](https://github.com/Tecnativa/docker-socket-proxy)

---

## Security Changelog

**v2.0 - October 2025**
- SECURITY FIX: Disabled privileged container creation
- SECURITY FIX: Implemented volume mount whitelist validation
- SECURITY FIX: Removed MySQL port exposure from docker-compose
- SECURITY ENHANCEMENT: Added resource limits to created containers
- SECURITY ENHANCEMENT: Enhanced audit logging for Docker operations
- SECURITY DOCUMENTATION: Added comprehensive security warnings

**Note:** This API provides direct access to the Docker daemon. Use with extreme caution and ensure all recommended security measures are implemented before deploying to production.
