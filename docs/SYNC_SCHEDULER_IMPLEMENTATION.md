# OpenVPN User Sync Scheduler Implementation - Complete

## Overview

Comprehensive automated scheduler service that synchronizes users between MySQL database and OpenVPN Access Server at configurable intervals using node-cron, with full REST API control.

## Files Created/Modified

### 1. Created: `src/services/syncScheduler.js`
**Location**: `c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam\src\services\syncScheduler.js`

**Features**:
- Periodic user synchronization using node-cron
- Configurable sync interval (1-60 minutes, default: 15 minutes)
- Manual sync trigger via `runNow()` method
- Comprehensive sync history tracking (last 10 syncs)
- Real-time sync status and statistics
- Error handling with detailed logging
- Concurrent sync prevention
- Graceful start/stop control
- Dynamic interval updates

**Exported Methods**:
```javascript
syncScheduler.start()              // Start scheduled syncing
syncScheduler.stop()               // Stop scheduled syncing
syncScheduler.runNow(options)      // Trigger manual sync immediately
syncScheduler.getStatus()          // Get scheduler status and statistics
syncScheduler.resetStats()         // Reset statistics
syncScheduler.updateInterval(min)  // Change sync interval dynamically
```

### 2. Modified: `src/index.js`
**Location**: `c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam\src\index.js`

**Changes**:
- Imported `syncScheduler` service (line 27)
- Imported `syncRoutes` (line 40)
- Mounted sync routes at `/api/sync` (line 179)
- Auto-start scheduler after server initialization (lines 258-270)
- Added scheduler status to `/health` endpoint (lines 126-150)
- Graceful shutdown integration - stops scheduler on SIGTERM/SIGINT (lines 297-305)
- Updated API documentation to include sync endpoints

### 3. Modified: `src/controllers/syncController.js`
**Location**: `c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam\src\controllers\syncController.js`

**Changes**:
- Imported `syncScheduler` service (line 2)
- Updated `syncAllUsers` to use `syncScheduler.runNow()` instead of direct openvpnUserSync call
- Enhanced `getSyncStatus` to include comprehensive scheduler information
- Added `controlScheduler` method for start/stop control
- Added `updateInterval` method for dynamic interval changes
- Improved error handling with scheduler integration

### 4. Modified: `src/routes/syncRoutes.js`
**Location**: `c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam\src\routes\syncRoutes.js`

**Changes**:
- Added scheduler control endpoint: `POST /api/sync/scheduler/control`
- Added interval update endpoint: `PUT /api/sync/scheduler/interval`
- Enhanced documentation for all endpoints
- Clarified admin-only access requirements

### 5. Modified: `package.json`
**Location**: `c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam\package.json`

**Changes**:
- Added `node-cron: ^3.0.3` dependency (line 41)

### 6. Modified: `.env.example`
**Location**: `c:\Users\Dread\Downloads\Compressed\openvpn-distribution-system\TNam\.env.example`

**Changes**:
- Added `SYNC_INTERVAL_MINUTES` configuration (lines 47-52)
- Added `OPENVPN_CONTAINER_NAME` configuration (line 45)
- Default sync interval: 15 minutes

## Configuration

### Environment Variables

```bash
# Sync interval in minutes (1-60)
SYNC_INTERVAL_MINUTES=15

# OpenVPN container name for Docker exec commands
OPENVPN_CONTAINER_NAME=openvpn-server
```

## API Endpoints

All sync endpoints require admin authentication.

### 1. Manual Sync Trigger
```bash
POST /api/sync/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "dryRun": false,
  "deleteOrphaned": false
}

# Response:
{
  "success": true,
  "message": "User synchronization completed successfully",
  "data": {
    "dryRun": false,
    "summary": {
      "created": 2,
      "updated": 5,
      "deleted": 0,
      "errors": 0,
      "skipped": 1
    },
    "details": {
      "created": [
        {"username": "newuser1", "tempPassword": "..."},
        {"username": "newuser2", "tempPassword": "..."}
      ],
      "updated": ["user1", "user2", "user3", "user4", "user5"],
      "deleted": [],
      "errors": [],
      "skipped": [{"id": 123, "reason": "no username"}]
    }
  }
}
```

### 2. Get Sync Status
```bash
GET /api/sync/status
Authorization: Bearer <admin_token>

# Response:
{
  "success": true,
  "data": {
    "mysql": {
      "total": 15,
      "withUsername": 14,
      "withoutUsername": 1,
      "verified": 15
    },
    "openvpn": {
      "total": 12,
      "users": ["user1", "user2", ...]
    },
    "comparison": {
      "inSync": 12,
      "missingInOpenVPN": 2,
      "orphanedInOpenVPN": 0,
      "syncPercentage": 86
    },
    "details": {
      "missingInOpenVPN": ["newuser1", "newuser2"],
      "orphanedInOpenVPN": [],
      "inSync": ["user1", "user2", ...]
    },
    "scheduler": {
      "isRunning": true,
      "isSyncing": false,
      "intervalMinutes": 15,
      "cronExpression": "*/15 * * * *",
      "statistics": {
        "totalSyncs": 48,
        "successfulSyncs": 47,
        "failedSyncs": 1,
        "successRate": "97.92%"
      },
      "lastSync": {
        "timestamp": "2025-10-15T10:30:00.000Z",
        "result": {
          "created": [],
          "updated": [5],
          "deleted": [],
          "errors": [],
          "skipped": []
        },
        "error": null
      },
      "nextSync": "2025-10-15T10:45:00.000Z",
      "recentHistory": [
        {
          "timestamp": "2025-10-15T10:30:00.000Z",
          "success": true,
          "duration": 1250,
          "result": {...},
          "trigger": "scheduled"
        }
      ]
    },
    "lastChecked": "2025-10-15T10:32:00.000Z"
  }
}
```

### 3. Control Scheduler
```bash
POST /api/sync/scheduler/control
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "stop"  # or "start"
}

# Response:
{
  "success": true,
  "message": "Scheduler stopped successfully",
  "data": {
    "isRunning": false,
    "intervalMinutes": 15
  }
}
```

### 4. Update Sync Interval
```bash
PUT /api/sync/scheduler/interval
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "intervalMinutes": 30
}

# Response:
{
  "success": true,
  "message": "Scheduler interval updated to 30 minutes",
  "data": {
    "intervalMinutes": 30,
    "cronExpression": "*/30 * * * *",
    "isRunning": true
  }
}
```

### 5. Sync Single User
```bash
POST /api/sync/users/:userId
Authorization: Bearer <admin_token>

# Example: POST /api/sync/users/123

# Response:
{
  "success": true,
  "message": "User john_doe created in OpenVPN Access Server",
  "data": {
    "userId": 123,
    "username": "john_doe",
    "action": "created",
    "tempPassword": "randomTempPassword123"
  }
}
```

### 6. Remove User from OpenVPN
```bash
DELETE /api/sync/users/:username
Authorization: Bearer <admin_token>

# Example: DELETE /api/sync/users/john_doe

# Response:
{
  "success": true,
  "message": "User john_doe removed from OpenVPN Access Server",
  "data": {
    "username": "john_doe",
    "result": {...}
  }
}
```

## Installation & Usage

### 1. Install Dependencies

```bash
npm install
```

This will install `node-cron@^3.0.3` along with other dependencies.

### 2. Configure Environment

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env and set:
SYNC_INTERVAL_MINUTES=15
OPENVPN_CONTAINER_NAME=openvpn-server
```

### 3. Start Server

```bash
# Development with hot reload
npm run dev

# Production
npm start
```

The scheduler will start automatically and begin syncing at the configured interval.

### 4. Monitor Health

```bash
curl http://localhost:3000/health | jq '.syncScheduler'
```

## Architecture

### Complete System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Express Server                          │
│                     (src/index.js)                           │
│  - Initializes syncScheduler on startup                      │
│  - Exposes /health endpoint with scheduler status            │
│  - Mounts /api/sync routes for admin control                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────────┐      ┌────────────────────┐
│  Sync Scheduler   │      │   Sync Routes      │
│ (syncScheduler)   │      │ (syncRoutes.js)    │
│                   │      │                    │
│ - Cron scheduling │      │ POST /sync/users   │
│ - Auto sync every │◄─────┤ GET /sync/status   │
│   N minutes       │      │ POST /scheduler/   │
│ - Manual trigger  │      │      control       │
│ - Status tracking │      │ PUT /scheduler/    │
└─────────┬─────────┘      │     interval       │
          │                └──────────┬─────────┘
          │                           │
          │                           ▼
          │                ┌──────────────────────┐
          │                │  Sync Controller     │
          │                │ (syncController.js)  │
          │                │                      │
          │                │ - syncAllUsers()     │
          └───────────────►│ - getSyncStatus()    │
                           │ - controlScheduler() │
                           │ - updateInterval()   │
                           └──────────┬───────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │ OpenVPN User Sync    │
                           │ (openvpnUserSync.js) │
                           │                      │
                           │ - syncUsers()        │
                           │ - getMySQLUsers()    │
                           │ - getOpenVPNUsers()  │
                           │ - createOpenVPNUser()│
                           │ - updateOpenVPNUser()│
                           │ - deleteOpenVPNUser()│
                           └──────────┬───────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
            ┌──────────────┐                  ┌─────────────────┐
            │    MySQL     │                  │  OpenVPN AS     │
            │   Database   │                  │ (Docker exec    │
            │              │                  │  sacli cmds)    │
            └──────────────┘                  └─────────────────┘
```

### Sync Execution Flow

1. **Scheduled Execution**: Cron job triggers at interval
2. **Concurrent Prevention**: Check `isSyncing` flag
3. **Fetch Data**: Get users from MySQL and OpenVPN
4. **Compare & Sync**:
   - Create missing users in OpenVPN
   - Update existing users
   - Delete orphaned users (if enabled)
5. **Track Results**: Store statistics and history
6. **Log Activity**: Comprehensive Winston logging

### Data Structures

#### Scheduler Status
```javascript
{
  scheduler: {
    isRunning: boolean,
    isSyncing: boolean,
    intervalMinutes: number,
    cronExpression: string
  },
  statistics: {
    totalSyncs: number,
    successfulSyncs: number,
    failedSyncs: number,
    successRate: string
  },
  lastSync: {
    timestamp: Date,
    result: Object,
    error: Object | null
  },
  nextSync: Date,
  history: Array<SyncHistory> // Last 10
}
```

#### Sync Result
```javascript
{
  created: Array<{username, tempPassword}>,
  updated: Array<username>,
  deleted: Array<username>,
  errors: Array<{username, error}>,
  skipped: Array<{id, reason}>
}
```

## Error Handling

### Scheduler-Level Errors
- **Invalid Configuration**: Falls back to 15-minute default
- **Cron Validation Failure**: Logged, scheduler won't start
- **Sync Failures**: Logged with full error stack, statistics updated
- **Concurrent Sync Attempts**: Skipped with warning

### API-Level Errors
- **Docker Connection Issues**: 503 Service Unavailable
- **Invalid Parameters**: 400 Bad Request with details
- **User Not Found**: 404 Not Found
- **Already Running/Stopped**: 400 with status message

### Recovery Mechanisms
- Server continues even if scheduler fails to start
- Failed syncs don't crash the scheduler
- Next scheduled sync proceeds normally after errors
- Graceful shutdown stops scheduler cleanly

## Logging

All activities logged via Winston with context:

```javascript
// Scheduler initialization
[info]: Sync Scheduler initialized { intervalMinutes: 15, cronExpression: '*/15 * * * *' }

// Scheduler start
[info]: Sync scheduler started successfully { intervalMinutes: 15, nextSync: '2025-10-15T10:45:00.000Z' }

// Sync execution
[info]: Starting scheduled user synchronization... { syncCount: 1, trigger: 'scheduled' }
[info]: User synchronization completed successfully { duration: '1250ms', created: 2, updated: 5 }

// Admin actions
[info]: Admin admin@example.com initiating full user sync { dryRun: false, deleteOrphaned: false }
[info]: Admin admin@example.com requesting scheduler stop

// Errors
[error]: User synchronization failed: { error: 'Docker container not running', duration: '500ms' }
```

## Production Considerations

### 1. Performance Optimization
- **Sync Interval**: Adjust based on user volume (larger systems: 30-60 min)
- **Database Pooling**: Ensure adequate connection pool size
- **Container Performance**: Monitor Docker exec command overhead

### 2. Monitoring & Alerting
- Use `/health` endpoint for external monitoring (Prometheus, Datadog, etc.)
- Set up alerts for:
  - High sync failure rate (>10%)
  - Scheduler stopped unexpectedly
  - Large user discrepancies
  - Sync duration exceeding threshold

### 3. Security
- All sync endpoints require admin authentication
- Temporary passwords generated for new users (16 chars, secure random)
- Audit logging for all admin actions
- Rate limiting applied to all endpoints

### 4. Scaling Considerations
- Single scheduler instance (no horizontal scaling issues)
- Concurrent sync prevention built-in
- History limited to 10 entries (adjustable)
- Consider database load during sync operations

### 5. Backup & Recovery
- Sync history in memory (lost on restart)
- Consider persistent storage for critical sync records
- Test recovery scenarios (scheduler restart, server restart)

## Testing

### Unit Testing
```javascript
// Test scheduler initialization
const syncScheduler = require('./src/services/syncScheduler');
assert(syncScheduler.syncIntervalMinutes === 15);
assert(syncScheduler.cronExpression === '*/15 * * * *');

// Test manual sync
const result = await syncScheduler.runNow({ dryRun: true });
assert(result.created !== undefined);

// Test status retrieval
const status = syncScheduler.getStatus();
assert(status.scheduler.isRunning !== undefined);
```

### Integration Testing
```bash
# Start server
npm run dev

# Test manual sync
curl -X POST http://localhost:3000/api/sync/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Test scheduler control
curl -X POST http://localhost:3000/api/sync/scheduler/control \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'

# Test interval update
curl -X PUT http://localhost:3000/api/sync/scheduler/interval \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 30}'
```

### Load Testing
```bash
# Test concurrent sync attempts (should be prevented)
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/sync/users \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"dryRun": false}' &
done
wait

# Only one should execute, others should skip
```

## Troubleshooting

### Scheduler Not Starting
```bash
# Check logs
tail -f logs/combined.log | grep -i scheduler

# Common issues:
# - Invalid SYNC_INTERVAL_MINUTES value
# - node-cron not installed (run npm install)
# - Permission issues with Docker socket
```

### Sync Failing
```bash
# Check OpenVPN container status
docker ps | grep openvpn

# Test Docker exec manually
docker exec openvpn-server sacli UserPropGet

# Check database connectivity
mysql -u root -p -e "SELECT COUNT(*) FROM users WHERE email_verified=1"
```

### High Memory Usage
```bash
# Scheduler keeps 10 sync histories in memory
# Reduce maxHistorySize in syncScheduler.js if needed
# Current memory usage shown in /health endpoint
```

## Future Enhancements

1. **Persistent History**: Store sync results in database
2. **Email Notifications**: Alert on sync failures or large discrepancies
3. **Webhook Integration**: POST sync results to external systems
4. **Advanced Scheduling**: Support custom cron expressions via API
5. **Selective Sync**: Sync only users modified since last sync
6. **Rollback Capability**: Revert failed syncs
7. **Metrics Export**: Prometheus-compatible metrics endpoint
8. **Multi-Container Support**: Sync to multiple OpenVPN instances

## Summary

The OpenVPN User Sync Scheduler is now fully integrated with comprehensive features:

**Automatic Operations**:
- Starts with server
- Syncs every 15 minutes (configurable)
- Tracks all sync operations
- Stops gracefully on shutdown

**Manual Control**:
- Trigger sync on-demand via API
- Start/stop scheduler dynamically
- Update interval without restart
- Query status and history

**Monitoring**:
- Health endpoint includes scheduler stats
- Comprehensive logging
- Sync history tracking
- Success rate calculation

**Production-Ready**:
- Error handling and recovery
- Concurrent sync prevention
- Admin-only access control
- Security best practices

The implementation provides a robust, scalable solution for keeping MySQL users synchronized with OpenVPN Access Server automatically while maintaining full operational control through REST APIs.
