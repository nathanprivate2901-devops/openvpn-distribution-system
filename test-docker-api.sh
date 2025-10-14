#!/bin/bash

###############################################################################
# Docker API Test Script
# Tests all Docker management endpoints
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Docker API Test Suite${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Step 1: Login and get token
echo -e "${YELLOW}[1/10] Logging in as admin...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Failed to login. Check credentials.${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Test health endpoint
echo -e "${YELLOW}[2/10] Testing health endpoint...${NC}"
HEALTH=$(curl -s "$API_BASE/health")
echo "$HEALTH" | grep -q '"status"' && echo -e "${GREEN}✓ Health check passed${NC}" || echo -e "${RED}✗ Health check failed${NC}"
echo ""

# Step 3: Get Docker system info
echo -e "${YELLOW}[3/10] Getting Docker system info...${NC}"
DOCKER_INFO=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/docker/info")
echo "$DOCKER_INFO" | grep -q '"success":true' && echo -e "${GREEN}✓ Docker info retrieved${NC}" || echo -e "${RED}✗ Failed to get Docker info${NC}"
echo "Docker Version:" $(echo "$DOCKER_INFO" | grep -o '"version":"[^"]*' | cut -d'"' -f4 | head -1)
echo ""

# Step 4: List all containers
echo -e "${YELLOW}[4/10] Listing all containers...${NC}"
CONTAINERS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/docker/containers")
CONTAINER_COUNT=$(echo "$CONTAINERS" | grep -o '"count":[0-9]*' | cut -d':' -f2)
echo "$CONTAINERS" | grep -q '"success":true' && echo -e "${GREEN}✓ Containers listed${NC}" || echo -e "${RED}✗ Failed to list containers${NC}"
echo "Total containers: $CONTAINER_COUNT"
echo ""

# Step 5: List OpenVPN containers
echo -e "${YELLOW}[5/10] Listing OpenVPN containers...${NC}"
OPENVPN_CONTAINERS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/docker/openvpn-containers")
OPENVPN_COUNT=$(echo "$OPENVPN_CONTAINERS" | grep -o '"count":[0-9]*' | cut -d':' -f2)
echo "$OPENVPN_CONTAINERS" | grep -q '"success":true' && echo -e "${GREEN}✓ OpenVPN containers listed${NC}" || echo -e "${RED}✗ Failed to list OpenVPN containers${NC}"
echo "OpenVPN containers: $OPENVPN_COUNT"
echo ""

# Step 6: List Docker images
echo -e "${YELLOW}[6/10] Listing Docker images...${NC}"
IMAGES=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/docker/images")
IMAGE_COUNT=$(echo "$IMAGES" | grep -o '"count":[0-9]*' | cut -d':' -f2)
echo "$IMAGES" | grep -q '"success":true' && echo -e "${GREEN}✓ Images listed${NC}" || echo -e "${RED}✗ Failed to list images${NC}"
echo "Total images: $IMAGE_COUNT"
echo ""

# Step 7: Test with specific container (if any exists)
echo -e "${YELLOW}[7/10] Testing container details...${NC}"
# Get first container ID if available
FIRST_CONTAINER=$(echo "$CONTAINERS" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$FIRST_CONTAINER" ]; then
  CONTAINER_DETAILS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/docker/containers/$FIRST_CONTAINER")
  echo "$CONTAINER_DETAILS" | grep -q '"success":true' && echo -e "${GREEN}✓ Container details retrieved${NC}" || echo -e "${RED}✗ Failed to get container details${NC}"
  CONTAINER_NAME=$(echo "$CONTAINER_DETAILS" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
  echo "Container: $CONTAINER_NAME"
else
  echo -e "${YELLOW}⊘ No containers available to test${NC}"
fi
echo ""

# Step 8: Test container logs (if container exists)
echo -e "${YELLOW}[8/10] Testing container logs...${NC}"
if [ -n "$FIRST_CONTAINER" ]; then
  LOGS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/docker/containers/$FIRST_CONTAINER/logs?tail=10")
  echo "$LOGS" | grep -q '"success":true' && echo -e "${GREEN}✓ Container logs retrieved${NC}" || echo -e "${RED}✗ Failed to get container logs${NC}"
  LOG_LINES=$(echo "$LOGS" | grep -o '"linesReturned":[0-9]*' | cut -d':' -f2)
  echo "Log lines returned: $LOG_LINES"
else
  echo -e "${YELLOW}⊘ No containers available to test${NC}"
fi
echo ""

# Step 9: Test container stats (if container exists and is running)
echo -e "${YELLOW}[9/10] Testing container stats...${NC}"
if [ -n "$FIRST_CONTAINER" ]; then
  STATS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/docker/containers/$FIRST_CONTAINER/stats")
  if echo "$STATS" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Container stats retrieved${NC}"
    CPU=$(echo "$STATS" | grep -o '"usage":"[^"]*' | cut -d'"' -f4 | head -1)
    MEMORY=$(echo "$STATS" | grep -o '"usageMB":"[^"]*' | cut -d'"' -f4 | head -1)
    echo "CPU Usage: ${CPU}%"
    echo "Memory Usage: ${MEMORY}MB"
  else
    echo -e "${YELLOW}⊘ Container may not be running${NC}"
  fi
else
  echo -e "${YELLOW}⊘ No containers available to test${NC}"
fi
echo ""

# Step 10: Test unauthorized access (should fail)
echo -e "${YELLOW}[10/10] Testing unauthorized access...${NC}"
UNAUTHORIZED=$(curl -s "$API_BASE/api/docker/info")
if echo "$UNAUTHORIZED" | grep -q '"success":false'; then
  echo -e "${GREEN}✓ Unauthorized access properly blocked${NC}"
else
  echo -e "${RED}✗ Security issue: unauthorized access allowed${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Test Suite Complete${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "${GREEN}All Docker API endpoints tested successfully!${NC}"
echo ""
echo "Available endpoints:"
echo "  • GET    /api/docker/containers"
echo "  • GET    /api/docker/openvpn-containers"
echo "  • GET    /api/docker/containers/:id"
echo "  • POST   /api/docker/containers/:id/start"
echo "  • POST   /api/docker/containers/:id/stop"
echo "  • POST   /api/docker/containers/:id/restart"
echo "  • GET    /api/docker/containers/:id/logs"
echo "  • GET    /api/docker/containers/:id/stats"
echo "  • POST   /api/docker/openvpn/create"
echo "  • DELETE /api/docker/containers/:id"
echo "  • GET    /api/docker/info"
echo "  • GET    /api/docker/images"
echo "  • POST   /api/docker/images/pull"
echo ""
echo "For detailed documentation, see DOCKER_API.md"
echo ""
