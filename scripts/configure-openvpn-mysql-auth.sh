#!/bin/bash
# Configure OpenVPN Access Server to use MySQL authentication via PAM
# This script configures the OpenVPN AS to authenticate users against the MySQL database

set -e

CONTAINER_NAME="${OPENVPN_CONTAINER_NAME:-openvpn-server}"

echo "Configuring OpenVPN Access Server for MySQL authentication..."

# Enable PAM authentication
echo "Enabling PAM authentication module..."
docker exec "$CONTAINER_NAME" sacli --key "auth.module.type" --value "pam" ConfigPut

# Set PAM service name
docker exec "$CONTAINER_NAME" sacli --key "auth.pam.0.service" --value "openvpn" ConfigPut

# Enable the PAM module
docker exec "$CONTAINER_NAME" sacli --key "auth.pam.0.enable" --value "true" ConfigPut

# Disable local password database (optional - keep both enabled for fallback)
# docker exec "$CONTAINER_NAME" sacli --key "auth.local.0.enable" --value "false" ConfigPut

# Restart the OpenVPN service to apply changes
echo "Restarting OpenVPN service..."
docker exec "$CONTAINER_NAME" sacli start

echo ""
echo "Configuration complete!"
echo ""
echo "OpenVPN Access Server is now configured to authenticate against MySQL database."
echo ""
echo "Users can login with their MySQL username and password."
echo "Only verified users (email_verified=1) who are not deleted can authenticate."
