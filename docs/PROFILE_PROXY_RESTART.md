Profile Proxy — restart instructions

This repository contains a small Node.js service that runs on the host and proxies requests to the OpenVPN Access Server container to generate/download VPN profiles.

Why this file

- The proxy runs on the host (not inside Docker). If you restart Docker or the machine, you'll need to restart the proxy manually.

Quick start (cross-platform)

1. From the project root (where this README sits):

   ```bash
   cd TNam
   npm run profile-proxy &
   ```

   - On Windows PowerShell, use this instead to run in background:

   ```powershell
   Start-Process -NoNewWindow -FilePath "node" -ArgumentList "scripts/profile-proxy.js"
   ```

Details and verification

- Environment variables you can set before starting:
  - PROFILE_PROXY_PORT (default: 3001)
  - OPENVPN_CONTAINER_NAME (default: openvpn-server)

- Health check (after starting):

  ```text
  http://localhost:3001/health
  -> {"status":"ok","container":"openvpn-server"}
  ```

- Endpoints available:
  - GET /health
  - GET /user/exists?username=<username>
  - POST /profile/userlogin  (body: {"username":"<username>"})
  - POST /profile/autologin  (body: {"username":"<username>"})

Notes

- If you need the service to auto-start on boot, consider using a system service (systemd on Linux) or a Windows service wrapper.
- The script calls "docker exec <container> sacli ..." and therefore requires that Docker CLI is available and that the named container is running.
