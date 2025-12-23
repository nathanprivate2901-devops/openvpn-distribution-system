# QoS Policy Assignment Feature

## Overview
This feature allows administrators to assign Quality of Service (QoS) policies to both **users** and **individual devices**, providing granular control over bandwidth allocation and network priority.

## Key Features

### 1. User-Level QoS Assignment
- Assign QoS policies to user accounts
- All devices belonging to a user inherit the user's QoS policy (unless overridden)
- One policy per user

### 2. Device-Level QoS Assignment
- Assign QoS policies to specific devices
- Device-level policies **override** user-level policies
- Useful for prioritizing specific devices (e.g., work laptops over personal tablets)

### 3. Hierarchical Policy Resolution
```
Device Policy (highest priority)
    ↓ (if not set)
User Policy (fallback)
    ↓ (if not set)
No Policy (default)
```

## Database Schema

### New Table: `device_qos`
```sql
CREATE TABLE device_qos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id INT UNSIGNED NOT NULL,
  qos_policy_id INT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by INT UNSIGNED NULL,  -- Admin who assigned it
  notes TEXT NULL,                 -- Optional assignment notes
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (qos_policy_id) REFERENCES qos_policies(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_device_qos (device_id, qos_policy_id)
);
```

### View: `v_devices_with_qos`
Provides comprehensive view of all devices with their effective QoS policies:
- Device-specific policy (if assigned)
- User-level policy (if no device policy)
- Effective policy (the one actually being applied)

## API Endpoints

### User QoS Management (Existing)

#### Assign QoS Policy to User
```http
POST /api/qos/assign
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "userId": 123,
  "policyId": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "QoS policy assigned to user successfully",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com"
    },
    "policy": {
      "id": 2,
      "policy_name": "Standard",
      "max_download_speed": 10,
      "max_upload_speed": 10,
      "priority": "medium"
    }
  }
}
```

#### Remove QoS Policy from User
```http
DELETE /api/qos/assign/:userId
Authorization: Bearer <admin_token>
```

#### Get User's QoS Policy
```http
GET /api/qos/my-policy
Authorization: Bearer <user_token>
```

### Device QoS Management (New)

#### Assign QoS Policy to Device
```http
POST /api/qos/assign-device
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "deviceId": 456,
  "policyId": 3,
  "notes": "High priority for CEO's laptop"
}
```

**Response:**
```json
{
  "success": true,
  "message": "QoS policy assigned to device successfully",
  "data": {
    "device": {
      "id": 456,
      "name": "MacBook Pro",
      "device_type": "laptop",
      "user_id": 123
    },
    "policy": {
      "id": 3,
      "policy_name": "Premium",
      "max_download_speed": 20,
      "max_upload_speed": 20,
      "priority": "high"
    },
    "assigned_by": {
      "id": 1,
      "name": "Admin",
      "email": "admin@example.com"
    }
  }
}
```

#### Remove QoS Policy from Device
```http
DELETE /api/qos/assign-device/:deviceId
Authorization: Bearer <admin_token>
```

#### Get Device's Effective QoS Policy
```http
GET /api/qos/device/:deviceId
Authorization: Bearer <user_token>
```

Returns the effective QoS policy (device-level or user-level) with source indication.

**Response:**
```json
{
  "success": true,
  "message": "Device QoS policy retrieved successfully",
  "data": {
    "device": {
      "id": 456,
      "name": "MacBook Pro",
      "device_type": "laptop",
      "user_id": 123
    },
    "policy": {
      "id": 3,
      "policy_name": "Premium",
      "max_download_speed": 20,
      "priority": "high"
    },
    "policy_source": "device",  // or "user"
    "assigned_at": "2025-11-01T10:30:00.000Z"
  }
}
```

#### Get Device Statistics for Policy
```http
GET /api/qos/policies/:id/device-stats
Authorization: Bearer <admin_token>
```

Returns statistics about devices assigned to a specific policy.

## Model Methods

### QosPolicy Model - User Methods
- `QosPolicy.assignToUser(userId, policyId)` - Assign policy to user
- `QosPolicy.removeFromUser(userId)` - Remove policy from user
- `QosPolicy.findByUserId(userId)` - Get user's assigned policy
- `QosPolicy.getUsersByPolicy(policyId)` - Get all users with a policy

### QosPolicy Model - Device Methods (New)
- `QosPolicy.assignToDevice(deviceId, policyId, assignedBy, notes)` - Assign policy to device
- `QosPolicy.removeFromDevice(deviceId)` - Remove policy from device
- `QosPolicy.findByDeviceId(deviceId)` - Get device's assigned policy
- `QosPolicy.getDevicesByPolicy(policyId)` - Get all devices with a policy
- `QosPolicy.getEffectiveDevicePolicy(deviceId)` - Get effective policy (device or user)
- `QosPolicy.getDeviceQosStats()` - Get device QoS statistics

### Device Model - QoS Methods (New)
- `Device.findByIdWithQos(id)` - Get device with its QoS policy
- `Device.findByUserIdWithQos(userId)` - Get user's devices with QoS policies
- `Device.getAllDevicesWithQos(page, limit)` - Get all devices with QoS (admin)

## Usage Examples

### Example 1: Assign User-Level QoS
```javascript
// Admin assigns "Standard" policy to a user
// All user's devices will inherit this policy
const result = await QosPolicy.assignToUser(userId, standardPolicyId);
```

### Example 2: Override with Device-Level QoS
```javascript
// Admin assigns "Premium" policy to user's work laptop
// This laptop gets Premium, other devices still get Standard
const result = await QosPolicy.assignToDevice(
  laptopDeviceId, 
  premiumPolicyId,
  adminUserId,
  "Work laptop needs higher bandwidth"
);
```

### Example 3: Check Effective Policy
```javascript
// Get the actual policy being applied to a device
const effectivePolicy = await QosPolicy.getEffectiveDevicePolicy(deviceId);

console.log(`Policy: ${effectivePolicy.name}`);
console.log(`Source: ${effectivePolicy.policy_source}`); // "device" or "user"
console.log(`Bandwidth: ${effectivePolicy.bandwidth_limit} Kbps`);
```

### Example 4: List All Devices with Policies
```javascript
// Admin views all devices and their effective QoS policies
const result = await Device.getAllDevicesWithQos(1, 50);

result.devices.forEach(device => {
  console.log(`${device.device_name} (${device.user_email})`);
  console.log(`  Effective Policy: ${device.effective_qos_policy_name}`);
  console.log(`  Bandwidth: ${device.effective_bandwidth_limit} Kbps`);
  console.log(`  Priority: ${device.effective_priority}`);
});
```

## Migration

Run the migration to add the device_qos table:

```bash
# Windows (PowerShell)
Get-Content migrations/003_add_device_qos.sql | mysql -u root -p openvpn_system

# Linux/Mac
mysql -u root -p openvpn_system < migrations/003_add_device_qos.sql
```

## Use Cases

### 1. User Tier System
- **Basic Users**: Get "Basic" policy (5 Mbps)
- **Premium Users**: Get "Premium" policy (20 Mbps)
- Applied automatically to all their devices

### 2. Device Priority
- User has "Standard" policy (10 Mbps)
- Their work laptop gets "Premium" override (20 Mbps)
- Their mobile phone keeps "Standard" (10 Mbps)

### 3. Temporary Upgrades
- User needs extra bandwidth for a presentation
- Admin assigns "Enterprise" policy to their laptop for the day
- Notes field tracks: "Temporary upgrade for Q4 presentation - 2025-11-01"

### 4. Department-Based QoS
- Engineering team: "High Priority" policy
- Each engineer's personal gaming device: "Low Priority" override
- Ensures work devices get better bandwidth

## Security & Permissions

- **Admin-only operations**: Assigning/removing policies
- **User operations**: Viewing their own device policies
- **Audit trail**: `assigned_by` and `notes` fields track who assigned what and why

## Benefits

1. **Granular Control**: Policy at both user and device level
2. **Flexibility**: Override user policies for specific devices
3. **Auditability**: Track who assigned policies and when
4. **Performance**: Efficient database views for quick lookups
5. **User Experience**: Users see relevant QoS info for their devices

## Testing Checklist

- [ ] Create QoS policies (Basic, Standard, Premium)
- [ ] Assign policy to user
- [ ] Verify all user's devices inherit the policy
- [ ] Assign different policy to one device
- [ ] Verify device policy overrides user policy
- [ ] Remove device policy, verify fallback to user policy
- [ ] Test API endpoints with various scenarios
- [ ] Check statistics endpoints return correct data
- [ ] Verify permissions (users can't assign policies)

## Future Enhancements

1. **Time-based policies**: Schedule policy changes
2. **Automatic rules**: Auto-assign based on device type
3. **Usage monitoring**: Track bandwidth consumption
4. **Policy templates**: Pre-configured policy sets
5. **Notification system**: Alert users when policies change
