#!/bin/bash
# Build and deploy OpenVPN AS with PAM MySQL authentication

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Building OpenVPN Access Server with PAM MySQL authentication..."

# Build custom image
docker build -t openvpn-as-pam:latest -f "$SCRIPT_DIR/Dockerfile.pam" "$SCRIPT_DIR"

echo "Image built successfully!"
echo ""
echo "To deploy, update your .env file:"
echo "OPENVPN_IMAGE=openvpn-as-pam:latest"
echo ""
echo "Then restart the container:"
echo "docker-compose up -d --force-recreate openvpn-server"
