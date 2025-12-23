Using a Docker socket proxy with the backend

Background

- The backend (`openvpn-backend`) previously attempted to access `/var/run/docker.sock` directly.
- In some deployments the backend cannot access the host docker socket due to permissions (EACCES).
- A secure alternative is to run a docker socket proxy container and have the backend connect to it via TCP (or a managed socket proxy).

How to configure the backend to use a socket proxy

1) Ensure a socket proxy is running and reachable. For example, run a trusted socket proxy on the host or as a container bound to a controlled port (e.g., 2375).

2) Set the backend environment variable `DOCKER_HOST` to point to the proxy. Example: `tcp://docker-proxy:2375` or `http://127.0.0.1:2375` depending on network.

3) The backend automatically respects `DOCKER_HOST` or `DOCKER_SOCKET_PATH`.

Example docker-compose snippet (socket proxy as a container)

```yaml
services:
  docker-proxy:
    image: tecnativa/docker-socket-proxy:latest
    ports:
      - '2375:2375'
    environment:
      - CONTAINERS=1
      - IMAGES=1
      - AUTH=0
    # bind mount docker.sock on the host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

  openvpn-backend:
    image: openvpn-system-backend
    environment:
      - DOCKER_HOST=tcp://docker-proxy:2375
    depends_on:
      - docker-proxy

# Note: This proxy exposes a TCP API. Use firewall/routing to restrict access.
```

Security notes

- Run the proxy on an internal-only network and restrict access via Docker network or host firewall.
- Limit the allowed operations via the proxy configuration where possible (example proxy supports limiting endpoints).
- Do not expose the Docker API to the public internet.

Verification

- After setting `DOCKER_HOST`, restart the backend container and check logs. Successful connection will remove EACCES errors and scheduled syncs should succeed.
- Backend will log the selected Docker connection mode at startup.

```powershell
# After updating env and restarting backend
docker logs -f openvpn-backend
# look for: Creating Docker client using DOCKER_HOST
```
