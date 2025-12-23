# QoS Policy Assignment - Quick Reference

## 🚀 Quick Start

### 1. Run Migration
```bash
# Run this SQL file to add device_qos table and views
mysql -u root -p openvpn_system < migrations/003_add_device_qos.sql
```

### 2. Test the Feature
```bash
# Run test script to verify everything works
node test-qos-assignment.js
```

## 📋 API Endpoints Summary

### User QoS Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/qos/assign` | Assign policy to user | Admin |
| DELETE | `/api/qos/assign/:userId` | Remove policy from user | Admin |
| GET | `/api/qos/my-policy` | Get current user's policy | User |

### Device QoS Endpoints (NEW)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/qos/assign-device` | Assign policy to device | Admin |
| DELETE | `/api/qos/assign-device/:deviceId` | Remove policy from device | Admin |
| GET | `/api/qos/device/:deviceId` | Get device's effective policy | User/Admin |
| GET | `/api/qos/policies/:id/device-stats` | Get device stats for policy | Admin |

## 🔑 Key Concepts

### Policy Hierarchy
```
Device Policy (highest priority) → User Policy (fallback) → No Policy
```

### Example Scenario
```
User: john@example.com
  └─ User Policy: "Standard" (10 Mbps)
     ├─ Device: "Work Laptop"
     │   └─ Device Policy: "Premium" (20 Mbps) ✓ APPLIED
     └─ Device: "Personal Phone"
         └─ No Device Policy → Uses "Standard" (10 Mbps) ✓ APPLIED
```

## 💡 Common Use Cases

### 1. Assign Policy to All User's Devices
```bash
curl -X POST http://localhost:3000/api/qos/assign \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 123,
    "policyId": 2
  }'
```

### 2. Override Policy for Specific Device
```bash
curl -X POST http://localhost:3000/api/qos/assign-device \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": 456,
    "policyId": 3,
    "notes": "CEO laptop - high priority"
  }'
```

### 3. Check Effective Policy for Device
```bash
curl http://localhost:3000/api/qos/device/456 \
  -H "Authorization: Bearer <user_token>"
```

## 📊 Model Methods

### QosPolicy Model

#### User Methods
```javascript
// Assign to user
await QosPolicy.assignToUser(userId, policyId);

// Get user's policy
const policy = await QosPolicy.findByUserId(userId);

// Remove from user
await QosPolicy.removeFromUser(userId);
```

#### Device Methods (NEW)
```javascript
// Assign to device
await QosPolicy.assignToDevice(deviceId, policyId, adminId, notes);

// Get device's policy
const policy = await QosPolicy.findByDeviceId(deviceId);

// Get effective policy (device or user fallback)
const effective = await QosPolicy.getEffectiveDevicePolicy(deviceId);

// Remove from device
await QosPolicy.removeFromDevice(deviceId);

// Get stats
const stats = await QosPolicy.getDeviceQosStats();
```

### Device Model (NEW)
```javascript
// Get device with QoS info
const device = await Device.findByIdWithQos(deviceId);

// Get user's devices with QoS
const devices = await Device.findByUserIdWithQos(userId);

// Get all devices with QoS (admin)
const result = await Device.getAllDevicesWithQos(page, limit);
```

## 🗂️ Database View

### v_devices_with_qos
Provides comprehensive device and QoS information:

```sql
SELECT * FROM v_devices_with_qos WHERE user_email = 'john@example.com';
```

Returns:
- Device info (name, type, ID)
- User info (name, email)
- Device-level QoS policy
- User-level QoS policy
- **Effective QoS policy** (the one actually being applied)

## ✅ Testing Checklist

```
□ Migration executed successfully
□ Can create QoS policies
□ Can assign policy to user
□ All user devices inherit policy
□ Can assign device-specific policy
□ Device policy overrides user policy
□ Can remove device policy (falls back to user)
□ Can view effective policy
□ Statistics endpoints return data
□ Permissions enforced (admin-only operations)
```

## 🔧 Troubleshooting

### Issue: Migration fails
**Solution**: Ensure devices table exists first (run migration 002_add_device_management_simple.sql)

### Issue: Can't assign policy to device
**Solution**: 
- Check device exists: `SELECT * FROM devices WHERE id = ?`
- Check policy exists: `SELECT * FROM qos_policies WHERE id = ?`
- Verify admin permissions

### Issue: Wrong policy applied
**Solution**: Check policy hierarchy
```javascript
// Device policy takes precedence
const devicePolicy = await QosPolicy.findByDeviceId(deviceId);
if (devicePolicy) {
  // This is the effective policy
} else {
  // Falls back to user policy
  const userPolicy = await QosPolicy.findByUserId(userId);
}
```

## 📁 Files Added/Modified

### New Files
- `migrations/003_add_device_qos.sql` - Database migration
- `docs/QOS_ASSIGNMENT_FEATURE.md` - Full documentation
- `test-qos-assignment.js` - Test suite

### Modified Files
- `src/models/QosPolicy.js` - Added device methods
- `src/models/Device.js` - Added QoS integration
- `src/controllers/qosController.js` - Added device endpoints
- `src/routes/qosRoutes.js` - Added device routes

## 🎯 Benefits

✅ **Granular Control**: Policy at both user and device level
✅ **Flexibility**: Override user policies for specific devices
✅ **Auditability**: Track who assigned policies and when
✅ **Performance**: Efficient database views
✅ **User Experience**: Users see relevant QoS info

## 📞 Support

For issues or questions:
1. Check documentation: `docs/QOS_ASSIGNMENT_FEATURE.md`
2. Run tests: `node test-qos-assignment.js`
3. Check logs: Review application logs for errors
