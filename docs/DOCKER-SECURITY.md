# Docker Security Hardening Guide

## Executive Summary

This document details the critical security vulnerabilities that were identified and remediated in the OpenVPN Distribution System's Docker integration. **These vulnerabilities could have led to complete host system compromise** if exploited.

### Severity: CRITICAL

**Impact if Unpatched:**
- Complete container escape to host system
- Root-level access to host machine
- Arbitrary file system access
- Ability to compromise other containers
- Denial of service attacks

---

## Vulnerabilities Identified and Fixed

### 1. CRITICAL: Privileged Container Creation

**Severity:** CRITICAL (CVSS 9.8)

**Location:** `/src/controllers/dockerController.js:559`

**Original Vulnerable Code:**
```javascript
HostConfig: {
  CapAdd: ['NET_ADMIN'],
  Privileged: true,  // VULNERABILITY: Allows container escape
  RestartPolicy: {
    Name: 'unless-stopped',
    MaximumRetryCount: 0
  }
}
```

**Problem:**
- Privileged mode grants the container nearly all capabilities of the host
- Containers with privileged mode can:
  - Mount host file systems
  - Load kernel modules
  - Access all devices
  - Bypass AppArmor/SELinux protections
  - **Escape to the host system with root privileges**

**Attack Scenario:**
```bash
# Attacker creates privileged container
curl -X POST http://localhost:3000/api/docker/openvpn/create \
  -H "Authorization: Bearer $STOLEN_ADMIN_TOKEN" \
  -d '{"name": "backdoor", "volumes": ["/:/host"]}'

# Inside container, attacker now has root on host
docker exec backdoor chroot /host
# Game over - attacker owns the host system
```

**Fix Applied:**
```javascript
HostConfig: {
  CapAdd: ['NET_ADMIN'],  // Only necessary capability
  Privileged: false,       // FIXED: Disabled privileged mode
  SecurityOpt: ['no-new-privileges:true'],
  Memory: 512 * 1024 * 1024,  // Resource limits
  MemorySwap: 1024 * 1024 * 1024,
  CpuShares: 1024
}
```

**Mitigation:**
- Privileged mode completely disabled
- Only NET_ADMIN capability granted (minimum required for VPN)
- Added `no-new-privileges` security option
- Implemented resource limits to prevent DoS

---

### 2. HIGH: User-Controlled Volume Mounts

**Severity:** HIGH (CVSS 8.1)

**Location:** `/src/controllers/dockerController.js:557`

**Original Vulnerable Code:**
```javascript
const {
  volumes = [],  // VULNERABILITY: No validation
  // ...
} = req.body;

// Later used directly:
HostConfig: {
  Binds: volumes,  // Direct use of user input
}
```

**Problem:**
- No validation of volume mount paths
- Attacker could mount any host directory
- Combination with privileged mode = full host compromise
- Even without privileged mode, sensitive data exposure

**Attack Scenario:**
```bash
# Attacker mounts sensitive host paths
curl -X POST http://localhost:3000/api/docker/openvpn/create \
  -H "Authorization: Bearer $STOLEN_ADMIN_TOKEN" \
  -d '{
    "name": "evil",
    "volumes": [
      "/etc/shadow:/etc/shadow:ro",
      "/root/.ssh:/root/.ssh:ro",
      "/var/run/docker.sock:/var/run/docker.sock"
    ]
  }'

# Now attacker can:
# - Read password hashes from /etc/shadow
# - Steal SSH keys from /root/.ssh
# - Control Docker via mounted socket
```

**Fix Applied:**
```javascript
// Whitelist of allowed paths
const ALLOWED_VOLUME_PATHS = [
  '/data/openvpn',
  '/etc/openvpn',
  '/var/lib/openvpn'
];

// Validation function
const validateVolumeMounts = (volumes) => {
  if (!volumes || volumes.length === 0) {
    return { valid: true, invalidPaths: [] };
  }

  const invalidPaths = [];
  for (const volume of volumes) {
    const parts = volume.split(':');
    const hostPath = parts[0];

    const isAllowed = ALLOWED_VOLUME_PATHS.some(allowedPath =>
      hostPath.startsWith(allowedPath)
    );

    if (!isAllowed) {
      invalidPaths.push(hostPath);
    }
  }

  return {
    valid: invalidPaths.length === 0,
    invalidPaths
  };
};

// Validation enforcement
const volumeValidation = validateVolumeMounts(volumes);
if (!volumeValidation.valid) {
  logger.warn(`Admin ${req.user.email} attempted to mount unauthorized volumes`, {
    invalidPaths: volumeValidation.invalidPaths
  });
  return res.status(403).json({
    success: false,
    message: 'Unauthorized volume mount paths detected',
    data: {
      invalidPaths: volumeValidation.invalidPaths,
      allowedPaths: ALLOWED_VOLUME_PATHS
    }
  });
}
```

**Mitigation:**
- Implemented strict whitelist validation
- Only three paths allowed: `/data/openvpn`, `/etc/openvpn`, `/var/lib/openvpn`
- Attempts to mount unauthorized paths are logged and rejected
- Returns detailed error with allowed paths

---

### 3. MEDIUM: Database Port Exposure

**Severity:** MEDIUM (CVSS 5.3)

**Location:** `/docker-compose.yml:14`

**Original Vulnerable Configuration:**
```yaml
mysql:
  image: mysql:8.0
  ports:
    - "${DB_PORT:-3306}:3306"  # VULNERABILITY: Exposed to host
```

**Problem:**
- MySQL port exposed to host network
- Increases attack surface unnecessarily
- Backend connects via internal Docker network, so port exposure not needed
- External access to database = potential data breach

**Attack Scenario:**
```bash
# Attacker scans host
nmap -sV hostname

# Finds MySQL port 3306 open
# Attempts brute force or exploits MySQL vulnerabilities
hydra -l root -P passwords.txt mysql://hostname

# Or exploits known MySQL CVEs
# Once in database, steals user credentials, VPN configs, etc.
```

**Fix Applied:**
```yaml
mysql:
  image: mysql:8.0
  # SECURITY FIX: Removed port exposure
  # Port 3306 is NOT exposed to host, reducing attack surface
  # Backend connects via internal network (DB_HOST: mysql)
  volumes:
    - mysql_data:/var/lib/mysql
  networks:
    - openvpn-network
```

**Mitigation:**
- Completely removed `ports` section from MySQL service
- Database only accessible via internal Docker network
- Backend connects using service name: `DB_HOST: mysql`
- Significantly reduced attack surface

---

### 4. HIGH: Docker Socket Access Risk

**Severity:** HIGH (CVSS 8.0)

**Location:** `/docker-compose.yml:87`

**Current Configuration:**
```yaml
backend:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

**Problem:**
- Docker socket provides root-equivalent access to host
- Even read-only access is dangerous when combined with other vulnerabilities
- If backend is compromised, attacker gains Docker control

**Why This Wasn't Completely Removed:**
- Required for Docker API functionality
- Core feature of the application
- Complete removal would break container management

**Mitigations Applied:**
1. **Code-Level Security:**
   - Disabled privileged container creation
   - Implemented volume mount whitelisting
   - Added resource limits
   - Enhanced audit logging

2. **Documentation:**
   - Clear security warnings added
   - Production deployment recommendations provided
   - Docker socket proxy solution documented

3. **Access Control:**
   - All Docker endpoints require admin authentication
   - JWT-based authorization
   - Rate limiting enforced

**Recommended Production Solution:**
```yaml
# Use Docker Socket Proxy (recommended for production)
docker-socket-proxy:
  image: tecnativa/docker-socket-proxy
  environment:
    CONTAINERS: 1  # Allow container operations
    IMAGES: 1      # Allow image operations
    INFO: 1        # Allow info queries
    NETWORKS: 0    # Deny network operations
    VOLUMES: 0     # Deny volume operations
    POST: 1        # Allow POST requests
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
  networks:
    - openvpn-network

backend:
  environment:
    DOCKER_HOST: tcp://docker-socket-proxy:2375
  # Remove direct socket mount
```

---

## Security Controls Implemented

### 1. Principle of Least Privilege

**Container Capabilities:**
- Only NET_ADMIN capability granted (required for VPN)
- No privileged mode
- `no-new-privileges` security option enabled

**Resource Limits:**
```javascript
Memory: 512 * 1024 * 1024,      // 512MB RAM limit
MemorySwap: 1024 * 1024 * 1024, // 1GB swap limit
CpuShares: 1024                 // CPU priority
```

### 2. Input Validation

**Volume Mount Whitelist:**
```javascript
const ALLOWED_VOLUME_PATHS = [
  '/data/openvpn',
  '/etc/openvpn',
  '/var/lib/openvpn'
];
```

**Validation Logic:**
- Parse volume strings
- Check against whitelist
- Log unauthorized attempts
- Return detailed errors

### 3. Audit Logging

**All Docker Operations Logged:**
```javascript
logger.info(`Admin ${req.user.email} creating OpenVPN container`, {
  name,
  port,
  image,
  volumes: volumes.length
});

logger.warn(`Admin ${req.user.email} attempted to mount unauthorized volumes`, {
  invalidPaths: volumeValidation.invalidPaths
});
```

**Log Locations:**
- `/app/logs/combined.log` - All operations
- `/app/logs/error.log` - Errors only

### 4. Network Isolation

**Docker Compose Network:**
```yaml
networks:
  openvpn-network:
    driver: bridge
    name: openvpn-network
```

**Benefits:**
- Services isolated from host network
- Internal communication only
- No unnecessary port exposure

### 5. Authentication & Authorization

**Multi-Layer Security:**
1. JWT authentication required
2. Admin role verification
3. Rate limiting (100 req/15min)
4. Token expiration

---

## Testing Security Fixes

### Test 1: Verify Privileged Mode Disabled

```bash
# Create container
curl -X POST http://localhost:3000/api/docker/openvpn/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-container", "port": 1194}'

# Inspect container
docker inspect test-container | jq '.[0].HostConfig.Privileged'
# Expected: false
```

### Test 2: Verify Volume Mount Validation

```bash
# Attempt to mount unauthorized path
curl -X POST http://localhost:3000/api/docker/openvpn/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "evil-container",
    "volumes": ["/etc/shadow:/etc/shadow"]
  }'

# Expected: HTTP 403 with error message
```

### Test 3: Verify Database Port Not Exposed

```bash
# Check if MySQL port is accessible from host
nc -zv localhost 3306

# Expected: Connection refused or timeout

# Verify internal connectivity works
docker exec openvpn-backend mysql -h mysql -u openvpn_user -p

# Expected: Successful connection
```

### Test 4: Verify Resource Limits

```bash
# Inspect created container
docker inspect test-container | jq '.[0].HostConfig | {Memory, MemorySwap, CpuShares}'

# Expected:
# {
#   "Memory": 536870912,      # 512MB
#   "MemorySwap": 1073741824,  # 1GB
#   "CpuShares": 1024
# }
```

---

## Production Deployment Checklist

### Critical (Must Do Before Production)

- [ ] Change default admin password
- [ ] Generate strong JWT secret (min 256 bits)
- [ ] Enable HTTPS/TLS with valid certificates
- [ ] Implement Docker socket proxy
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Enable automated backups
- [ ] Review and update volume whitelist
- [ ] Implement IP whitelisting for admin endpoints
- [ ] Enable multi-factor authentication

### High Priority (Strongly Recommended)

- [ ] Set up centralized logging (ELK, Splunk, etc.)
- [ ] Implement security scanning (Trivy, Clair)
- [ ] Configure rate limiting per user
- [ ] Set up intrusion detection system
- [ ] Implement security headers (CSP, HSTS, etc.)
- [ ] Regular security audits
- [ ] Penetration testing
- [ ] Create incident response plan

### Medium Priority (Recommended)

- [ ] Implement API versioning
- [ ] Set up health monitoring
- [ ] Configure auto-scaling
- [ ] Implement request throttling
- [ ] Set up performance monitoring
- [ ] Create disaster recovery plan
- [ ] Document security procedures
- [ ] Train operations team

---

## Monitoring and Detection

### Log Patterns to Monitor

**Suspicious Activity:**
```bash
# Failed authentication attempts
grep "Access denied" /app/logs/combined.log

# Unauthorized volume mount attempts
grep "attempted to mount unauthorized volumes" /app/logs/combined.log

# Container creation spikes
grep "creating OpenVPN container" /app/logs/combined.log | wc -l
```

**Alert Triggers:**
- More than 5 failed admin logins in 5 minutes
- Any unauthorized volume mount attempt
- More than 10 containers created in 1 hour
- High resource usage on created containers
- Unexpected privileged container detection

### Recommended Monitoring Tools

1. **Prometheus + Grafana**
   - Metrics collection
   - Real-time dashboards
   - Alerting

2. **ELK Stack**
   - Centralized logging
   - Log analysis
   - Anomaly detection

3. **Falco**
   - Runtime security monitoring
   - Container behavior detection
   - Syscall analysis

4. **Docker Bench Security**
   - Automated security audit
   - CIS Docker Benchmark compliance
   - Configuration validation

---

## Incident Response

### If Container Escape Detected

1. **Immediate Actions:**
   ```bash
   # Stop all containers
   docker stop $(docker ps -q)

   # Disconnect network
   docker network disconnect openvpn-network openvpn-backend

   # Collect logs
   docker logs openvpn-backend > incident-$(date +%s).log
   cp /app/logs/combined.log incident-full-$(date +%s).log
   ```

2. **Investigate:**
   - Review audit logs
   - Check created containers
   - Analyze volume mounts
   - Examine network connections

3. **Remediate:**
   - Patch vulnerabilities
   - Rotate credentials
   - Update firewall rules
   - Restore from clean backup

4. **Post-Incident:**
   - Conduct root cause analysis
   - Update security procedures
   - Implement additional controls
   - Train team on lessons learned

---

## Compliance Considerations

### GDPR
- User data protection
- Right to deletion
- Data breach notification
- Audit logging

### PCI DSS (if applicable)
- Network segmentation
- Access control
- Logging and monitoring
- Security testing

### SOC 2
- Security controls
- Availability measures
- Confidentiality protection
- Processing integrity

---

## References

### Security Standards
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [OWASP Docker Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [NIST Container Security](https://csrc.nist.gov/publications/detail/sp/800-190/final)

### Docker Security
- [Docker Security Documentation](https://docs.docker.com/engine/security/)
- [Docker Socket Security](https://docs.docker.com/engine/security/protect-access/)
- [AppArmor Profile](https://docs.docker.com/engine/security/apparmor/)

### Tools
- [Docker Bench Security](https://github.com/docker/docker-bench-security)
- [Trivy Scanner](https://github.com/aquasecurity/trivy)
- [Falco Runtime Security](https://falco.org/)
- [Docker Socket Proxy](https://github.com/Tecnativa/docker-socket-proxy)

---

## Contact and Support

For security concerns or questions:
- Review this documentation thoroughly
- Check application logs: `/app/logs/`
- Consult Docker security best practices
- Consider professional security audit

**Remember:** Security is an ongoing process, not a one-time fix. Regular reviews, updates, and monitoring are essential to maintain a secure system.

---

**Document Version:** 2.0
**Last Updated:** October 2025
**Next Review:** January 2026
