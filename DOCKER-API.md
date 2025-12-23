# Docker Management API Documentation

This API allows administrators to manage Docker containers, specifically for controlling OpenVPN Access Server and Debian containers.

## Prerequisites

- Docker must be installed and running on the host system
- The backend application must have permissions to execute Docker commands
- Admin authentication required for all endpoints

## Authentication

All Docker API endpoints require:
1. Valid JWT token with admin role
2. Token passed in Authorization header: `Bearer <token>`

## Base URL

```
/api/docker
```

## Endpoints

### Container Management

#### Get All Containers

```http
GET /api/docker/containers
```

Returns a list of all Docker containers (running and stopped).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123def456",
      "name": "openvpn-as",
      "image": "openvpn/openvpn-as",
      "status": "Up 2 hours",
      "ports": "0.0.0.0:943->943/tcp, 0.0.0.0:443->443/tcp"
    }
  ]
}
```

#### Get OpenVPN Containers Only

```http
GET /api/docker/openvpn-containers
```

Returns only OpenVPN Access Server containers.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123def456",
      "name": "openvpn-as-1",
      "status": "Up 2 hours",
      "ports": "0.0.0.0:943->943/tcp"
    }
  ]
}
```

#### Get Container Details

```http
GET /api/docker/containers/:id
```

Get detailed information about a specific container.

**Parameters:**
- `id` (path) - Container ID or name

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "name": "/openvpn-as",
    "image": "openvpn/openvpn-as",
    "status": "running",
    "created": "2024-10-14T10:00:00.000Z",
    "ports": {
      "443/tcp": [{"HostIp": "0.0.0.0", "HostPort": "443"}],
      "943/tcp": [{"HostIp": "0.0.0.0", "HostPort": "943"}]
    },
    "mounts": [...],
    "environment": [...]
  }
}
```

#### Start Container

```http
POST /api/docker/containers/:id/start
```

Start a stopped container.

**Response:**
```json
{
  "success": true,
  "message": "Container started successfully"
}
```

#### Stop Container

```http
POST /api/docker/containers/:id/stop
```

Stop a running container.

**Response:**
```json
{
  "success": true,
  "message": "Container stopped successfully"
}
```

#### Restart Container

```http
POST /api/docker/containers/:id/restart
```

Restart a container.

**Response:**
```json
{
  "success": true,
  "message": "Container restarted successfully"
}
```

#### Remove Container

```http
DELETE /api/docker/containers/:id?force=true
```

Remove a container. Use `force=true` to force remove a running container.

**Query Parameters:**
- `force` (optional) - Set to 'true' to force remove

**Response:**
```json
{
  "success": true,
  "message": "Container removed successfully"
}
```

### Container Monitoring

#### Get Container Logs

```http
GET /api/docker/containers/:id/logs?lines=100
```

Retrieve container logs.

**Query Parameters:**
- `lines` (optional) - Number of lines to retrieve (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": "Log output here...",
    "errors": "Error output here..."
  }
}
```

#### Get Container Statistics

```http
GET /api/docker/containers/:id/stats
```

Get real-time container resource usage statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "cpu": "2.5%",
    "memory": "256MB / 2GB",
    "network": "1.2MB / 800KB",
    "blockIO": "10MB / 5MB"
  }
}
```

### OpenVPN Container Creation

#### Create OpenVPN Container

```http
POST /api/docker/openvpn/create
```

Create and run a new OpenVPN Access Server container.

**Request Body:**
```json
{
  "name": "openvpn-as-prod",
  "adminPassword": "SecurePassword123!",
  "ports": {
    "admin": 943,
    "client": 443
  }
}
```

**Parameters:**
- `name` (optional) - Container name (auto-generated if not provided)
- `adminPassword` (optional) - Admin password (default: admin123)
- `ports.admin` (optional) - Admin UI port (default: 943)
- `ports.client` (optional) - Client connection port (default: 443)

**Response:**
```json
{
  "success": true,
  "message": "OpenVPN container created successfully",
  "data": {
    "containerId": "abc123def456",
    "name": "openvpn-as-prod",
    "adminUrl": "https://localhost:943/admin",
    "clientUrl": "https://localhost:443"
  }
}
```

### Docker System Information

#### Get Docker Info

```http
GET /api/docker/info
```

Get Docker system information.

**Response:**
```json
{
  "success": true,
  "data": {
    "containers": 5,
    "images": 12,
    "serverVersion": "24.0.6",
    "operatingSystem": "Ubuntu 22.04",
    "architecture": "x86_64",
    "cpus": 8,
    "memory": 16843747328
  }
}
```

### Image Management

#### Get Docker Images

```http
GET /api/docker/images
```

List all Docker images on the system.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sha256:abc123",
      "repository": "openvpn/openvpn-as",
      "tag": "latest",
      "size": "1.2GB",
      "createdAt": "2024-10-01 10:00:00"
    }
  ]
}
```

#### Pull Docker Image

```http
POST /api/docker/images/pull
```

Pull a Docker image from registry.

**Request Body:**
```json
{
  "image": "openvpn/openvpn-as:latest"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Image pulled successfully",
  "output": "Pull output..."
}
```

## Usage Examples

### Example 1: Create and Start OpenVPN Container

```bash
# Get admin token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.data.token')

# Create OpenVPN container
curl -X POST http://localhost:3000/api/docker/openvpn/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "openvpn-main",
    "adminPassword": "MySecurePassword123!",
    "ports": {
      "admin": 943,
      "client": 443
    }
  }'
```

### Example 2: Monitor Container

```bash
# Get container logs
curl http://localhost:3000/api/docker/containers/openvpn-main/logs?lines=50 \
  -H "Authorization: Bearer $TOKEN"

# Get container stats
curl http://localhost:3000/api/docker/containers/openvpn-main/stats \
  -H "Authorization: Bearer $TOKEN"
```

### Example 3: Manage Container Lifecycle

```bash
# Stop container
curl -X POST http://localhost:3000/api/docker/containers/openvpn-main/stop \
  -H "Authorization: Bearer $TOKEN"

# Start container
curl -X POST http://localhost:3000/api/docker/containers/openvpn-main/start \
  -H "Authorization: Bearer $TOKEN"

# Restart container
curl -X POST http://localhost:3000/api/docker/containers/openvpn-main/restart \
  -H "Authorization: Bearer $TOKEN"
```

## Security Considerations

1. **Docker Permissions**: The application needs access to Docker socket
   - Add user to docker group: `sudo usermod -aG docker $USER`
   - Or run with appropriate permissions

2. **Container Security**:
   - Always use strong admin passwords
   - Limit exposed ports
   - Use firewall rules to restrict access

3. **API Security**:
   - Only admins can access Docker endpoints
   - All operations are logged
   - Rate limiting applied

4. **Production Deployment**:
   - Consider using Docker API instead of shell commands
   - Implement additional validation
   - Use Docker secrets for sensitive data

## Error Handling

All endpoints return standard error responses:

```json
{
  "success": false,
  "message": "Error description here"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad request
- `401` - Unauthorized
- `403` - Forbidden (not admin)
- `404` - Container not found
- `500` - Server error

## Limitations

- Docker must be installed on the host
- Commands are executed via shell (not Docker SDK)
- Some operations may require elevated privileges
- Container names must be unique

## Future Enhancements

- Docker Compose management
- Volume management
- Network configuration
- Image building
- Container health checks
- Automated backups
- Resource limits configuration
