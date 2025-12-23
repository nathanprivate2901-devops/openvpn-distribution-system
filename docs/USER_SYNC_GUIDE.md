# OpenVPN User Synchronization Guide

## Overview

Your OpenVPN Distribution System now includes **automatic user synchronization** between your MySQL database and OpenVPN Access Server. This ensures users can authenticate with their distribution system credentials to access the VPN.

## Architecture

### Two-Way Integration

1. **User Sync Service** - Automatically creates/updates/deletes users in OpenVPN AS
2. **PAM Authentication** (Optional) - Allows OpenVPN to authenticate directly against MySQL

### Sync Methods

#### Method 1: Automatic Sync (Current Implementation)
- Users are automatically synced when created/updated/deleted in MySQL
- Scheduled sync runs every 15 minutes (configurable)
- Temporary passwords generated for new users
- Admin API for manual control

#### Method 2: PAM MySQL Authentication (Advanced)
- Direct authentication against MySQL database
- No password duplication needed
- Requires custom Docker image with PAM modules
- See [PAM Setup](#pam-authentication-setup-optional) below

## Features

### ✅ Automatic Synchronization

**When users are synced:**
- ✅ After email verification (primary trigger)
- ✅ When admin creates verified user
- ✅ When user profile is updated
- ✅ When user is deleted (soft delete)
- ✅ Every 15 minutes via scheduler (configurable)

**What is synced:**
- Username → OpenVPN username
- Email → OpenVPN email property
- Name → OpenVPN display name
- Role → Admin privileges (admin role = superuser in OpenVPN)

### 🔒 Security

- Only **verified** users (email_verified=1) are synced
- **Deleted** users (soft delete) are removed from OpenVPN
- Non-blocking sync (database operations succeed even if OpenVPN is down)
- Admin-only API access with JWT authentication

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# User Sync Configuration
SYNC_INTERVAL_MINUTES=15
OPENVPN_CONTAINER_NAME=openvpn-server
```

### Sync Interval

Default: 15 minutes
Range: 1-60 minutes
Change via API or env var

## API Endpoints

All endpoints require **admin authentication** (JWT token with admin role).

### 1. Manual Full Sync

Synchronize all users from MySQL to OpenVPN.

```bash
POST /api/sync/users

# Request body (optional):
{
  "dryRun": false,           # Set true to preview without changes
  "deleteOrphaned": false    # Set true to remove OpenVPN users not in MySQL
}

# Example:
curl -X POST http://localhost:3000/api/sync/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false, "deleteOrphaned": false}'

# Response:
{
  "success": true,
  "message": "User synchronization completed",
  "data": {
    "created": ["john", "jane"],
    "updated": ["admin"],
    "deleted": [],
    "errors": [],
    "skipped": [],
    "summary": {
      "totalProcessed": 3,
      "successful": 3,
      "failed": 0
    }
  }
}
```

**Important:** Newly created users receive **temporary passwords**. Notify users to change their password via OpenVPN admin UI or implement password sync.

### 2. Sync Single User

Sync a specific user by their MySQL user ID.

```bash
POST /api/sync/users/:userId

# Example:
curl -X POST http://localhost:3000/api/sync/users/5 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Response:
{
  "success": true,
  "message": "User synced successfully",
  "data": {
    "action": "created",
    "username": "john",
    "tempPassword": "TempPass123!@#"  # Only if newly created
  }
}
```

### 3. Remove User from OpenVPN

Delete a user from OpenVPN Access Server (does not delete from MySQL).

```bash
DELETE /api/sync/users/:username

# Example:
curl -X DELETE http://localhost:3000/api/sync/users/john \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Response:
{
  "success": true,
  "message": "User removed from OpenVPN successfully",
  "data": {
    "username": "john"
  }
}
```

### 4. Get Sync Status

View synchronization status and statistics.

```bash
GET /api/sync/status

# Example:
curl http://localhost:3000/api/sync/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Response:
{
  "success": true,
  "data": {
    "mysql": {
      "totalUsers": 5,
      "verifiedUsers": 4,
      "users": ["admin", "john", "jane", "bob"]
    },
    "openvpn": {
      "totalUsers": 3,
      "users": ["admin", "john", "jane"]
    },
    "sync": {
      "inSync": false,
      "missingInOpenVPN": ["bob"],
      "orphanedInOpenVPN": [],
      "syncPercentage": 75
    },
    "scheduler": {
      "running": true,
      "interval": "15 minutes",
      "lastSync": "2025-10-15T14:00:00Z",
      "nextSync": "2025-10-15T14:15:00Z",
      "history": [...]
    }
  }
}
```

### 5. Control Scheduler

Start or stop the automatic sync scheduler.

```bash
POST /api/sync/scheduler/control

# Request body:
{
  "action": "start"  # or "stop"
}

# Example:
curl -X POST http://localhost:3000/api/sync/scheduler/control \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'

# Response:
{
  "success": true,
  "message": "Scheduler started successfully",
  "data": {
    "running": true,
    "interval": "15 minutes"
  }
}
```

### 6. Update Sync Interval

Change how often automatic sync runs.

```bash
PUT /api/sync/scheduler/interval

# Request body:
{
  "interval": 30  # Minutes (1-60)
}

# Example:
curl -X PUT http://localhost:3000/api/sync/scheduler/interval \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"interval": 30}'

# Response:
{
  "success": true,
  "message": "Scheduler interval updated successfully",
  "data": {
    "interval": "30 minutes",
    "nextSync": "2025-10-15T14:30:00Z"
  }
}
```

## Automatic Triggers

Users are automatically synced in these scenarios:

### 1. After Email Verification
```javascript
// When user verifies their email
User.updateProfile(userId, { email_verified: true });
// → User automatically synced to OpenVPN
```

### 2. After User Creation (if already verified)
```javascript
// When admin creates pre-verified user
User.create({ username: 'john', email_verified: true, ... });
// → User automatically synced to OpenVPN
```

### 3. After Soft Delete
```javascript
// When user is deleted
User.softDelete(userId);
// → User automatically removed from OpenVPN
```

### 4. Scheduled Sync
- Runs every 15 minutes (default)
- Syncs all verified users
- Reconciles any drift between systems

## Password Management

### Current Behavior

**Problem:** OpenVPN AS cannot directly use bcrypt hashes from MySQL.

**Solution:** When users are synced, temporary passwords are generated.

**User Flow:**
1. User registers in distribution system
2. User verifies email → synced to OpenVPN with temp password
3. User receives temp password (via email/admin notification)
4. User changes password in OpenVPN admin UI

### Better Solutions

#### Option 1: PAM Authentication (Recommended)
Use PAM to authenticate against MySQL directly. See [PAM Setup](#pam-authentication-setup-optional).

#### Option 2: Password Sync Webhook
Implement webhook to sync password changes from distribution system to OpenVPN.

#### Option 3: Unified Auth Portal
Require users to set OpenVPN password separately through distribution system UI.

## PAM Authentication Setup (Optional)

For seamless authentication without password duplication:

### Step 1: Build Custom Image

```bash
cd docker/openvpn-pam
chmod +x build-and-deploy.sh
./build-and-deploy.sh
```

### Step 2: Update Environment

Edit `.env`:
```env
OPENVPN_IMAGE=openvpn-as-pam:latest
```

### Step 3: Deploy

```bash
docker-compose up -d --force-recreate openvpn-server
```

### Step 4: Configure OpenVPN

```bash
cd scripts
chmod +x configure-openvpn-mysql-auth.sh
./configure-openvpn-mysql-auth.sh
```

### Step 5: Test

Users can now login to OpenVPN with their MySQL username and password directly!

```bash
# User logs in with:
Username: john
Password: their_mysql_password
```

## Monitoring

### Check Scheduler Status

```bash
# Via health endpoint
curl http://localhost:3000/health | jq '.syncScheduler'

# Via sync status endpoint
curl http://localhost:3000/api/sync/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq '.data.scheduler'
```

### View Logs

```bash
# Backend logs
docker-compose logs -f backend | grep -i sync

# OpenVPN logs
docker-compose logs -f openvpn-server
```

### Sync History

Last 10 sync operations are tracked:

```bash
curl http://localhost:3000/api/sync/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq '.data.scheduler.history'
```

## Troubleshooting

### Sync Not Working

**Check scheduler is running:**
```bash
curl http://localhost:3000/api/sync/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq '.data.scheduler.running'
```

**Check Docker connectivity:**
```bash
docker exec openvpn-server sacli ConfigQuery
```

**Check backend logs:**
```bash
docker-compose logs backend | grep -E "(sync|error)"
```

### User Not Syncing

**Verify user is eligible:**
```sql
SELECT username, email_verified, deleted_at
FROM users
WHERE username = 'john';
```

Requirements:
- ✅ `email_verified = 1`
- ✅ `deleted_at IS NULL`
- ✅ `username` is not NULL

**Force sync single user:**
```bash
curl -X POST http://localhost:3000/api/sync/users/USER_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Scheduler Stopped

**Restart scheduler:**
```bash
curl -X POST http://localhost:3000/api/sync/scheduler/control \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'
```

**Or restart backend:**
```bash
docker-compose restart backend
```

### OpenVPN Container Not Found

**Check container name:**
```bash
docker ps | grep openvpn
```

**Update environment:**
```env
OPENVPN_CONTAINER_NAME=your-actual-container-name
```

### PAM Authentication Not Working

**Check PAM configuration:**
```bash
docker exec openvpn-server cat /etc/pam.d/openvpn
```

**Check MySQL connectivity from OpenVPN:**
```bash
docker exec openvpn-server ping -c 3 mysql
```

**Verify PAM module enabled:**
```bash
docker exec openvpn-server sacli ConfigQuery | grep auth.pam
```

## Best Practices

### 1. Initial Setup

```bash
# 1. Start all services
docker-compose up -d

# 2. Verify backend is healthy
curl http://localhost:3000/health

# 3. Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# 4. Run initial sync
curl -X POST http://localhost:3000/api/sync/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deleteOrphaned": true}'

# 5. Verify sync status
curl http://localhost:3000/api/sync/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2. Regular Operations

- Let scheduler handle routine syncs
- Use manual sync after bulk user operations
- Monitor sync status via health endpoint
- Check sync history for failures

### 3. Production Deployment

- ✅ Set `SYNC_INTERVAL_MINUTES` appropriately (15-30 recommended)
- ✅ Implement PAM authentication for seamless login
- ✅ Monitor sync errors via logging
- ✅ Set up alerts for sync failures
- ✅ Backup both MySQL and OpenVPN configs
- ✅ Test sync after major updates

### 4. Security

- ✅ Restrict sync API to admin only (already implemented)
- ✅ Use strong JWT secrets
- ✅ Rotate temporary passwords regularly
- ✅ Audit sync operations via logs
- ✅ Limit Docker socket access

## Summary

Your OpenVPN Distribution System now provides:

✅ **Automatic user synchronization** between MySQL and OpenVPN
✅ **Scheduled sync** every 15 minutes (configurable)
✅ **Real-time sync** on user create/update/delete
✅ **Admin API** for manual control
✅ **Sync monitoring** via health and status endpoints
✅ **PAM authentication** support (optional)
✅ **Non-blocking** sync (doesn't fail database operations)
✅ **Comprehensive logging** and error handling

Users can now register in your distribution system and automatically gain access to the OpenVPN server with the same credentials!

## Related Documentation

- [OPENVPN_QUICKSTART.md](OPENVPN_QUICKSTART.md) - Quick start guide
- [OPENVPN_SETUP.md](OPENVPN_SETUP.md) - Detailed setup
- [CLAUDE.md](CLAUDE.md) - Project architecture
- [README.md](README.md) - General documentation
