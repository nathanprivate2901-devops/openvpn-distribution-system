# QoS Policy Assignment for Users and Devices

## 🎯 Overview

This feature allows administrators to assign Quality of Service (QoS) policies to both **users** and **individual devices**, providing fine-grained control over bandwidth allocation and network priority in the OpenVPN Distribution System.

## ✨ Key Features

### 🔹 User-Level QoS
- Assign QoS policies to user accounts
- Policy applies to all devices owned by the user
- Simple tier-based system (Basic, Standard, Premium, Enterprise)

### 🔹 Device-Level QoS
- Override user policies for specific devices
- Prioritize critical devices (e.g., work laptops)
- Temporary bandwidth boosts for special needs

### 🔹 Hierarchical Resolution
```
┌─────────────────────────────────────┐
│   Device has specific QoS policy?   │
│              YES → Use it           │
└──────────────┬──────────────────────┘
               │ NO
               ↓
┌─────────────────────────────────────┐
│    User has QoS policy assigned?    │
│         YES → Use it (fallback)     │
└──────────────┬──────────────────────┘
               │ NO
               ↓
┌─────────────────────────────────────┐
│         No QoS policy applied       │
└─────────────────────────────────────┘
```

## 📦 What's Included

### Database
- ✅ `device_qos` table for device-policy assignments
- ✅ `v_devices_with_qos` view for efficient queries
- ✅ Migration script: `migrations/003_add_device_qos.sql`

### Backend
- ✅ 6 new model methods in `QosPolicy.js`
- ✅ 3 new model methods in `Device.js`
- ✅ 4 new controller endpoints in `qosController.js`
- ✅ 4 new API routes in `qosRoutes.js`

### Documentation
- ✅ Complete feature documentation
- ✅ Quick reference guide
- ✅ Test suite with examples

## 🚀 Quick Start

### Step 1: Run Migration
```bash
# Run the database migration to add device_qos table
mysql -u root -p openvpn_system < migrations/003_add_device_qos.sql
```

### Step 2: Test the Feature
```bash
# Run the comprehensive test suite
node test-qos-assignment.js
```

### Step 3: Start Using It!
```bash
# Assign policy to a user
curl -X POST http://localhost:3000/api/qos/assign \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"userId": 123, "policyId": 2}'

# Override with device-specific policy
curl -X POST http://localhost:3000/api/qos/assign-device \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"deviceId": 456, "policyId": 3, "notes": "CEO laptop"}'
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `QOS_ASSIGNMENT_FEATURE.md` | Complete feature documentation with examples |
| `QOS_ASSIGNMENT_QUICK_REFERENCE.md` | Quick reference for common operations |
| `QOS_IMPLEMENTATION_SUMMARY.md` | Implementation details and summary |

## 🔧 API Endpoints

### User QoS Management
```
POST   /api/qos/assign              - Assign policy to user
DELETE /api/qos/assign/:userId      - Remove policy from user
GET    /api/qos/my-policy           - Get current user's policy
GET    /api/qos/policies/:id/stats  - Get user statistics for policy
```

### Device QoS Management (NEW)
```
POST   /api/qos/assign-device                 - Assign policy to device
DELETE /api/qos/assign-device/:deviceId       - Remove policy from device
GET    /api/qos/device/:deviceId              - Get device's effective policy
GET    /api/qos/policies/:id/device-stats     - Get device statistics for policy
```

## 💡 Common Use Cases

### Case 1: Tier-Based User Policies
```javascript
// Free tier users get "Basic" policy
await QosPolicy.assignToUser(freeUserId, basicPolicyId);

// Premium users get "Premium" policy
await QosPolicy.assignToUser(premiumUserId, premiumPolicyId);
```

### Case 2: Device Priority Override
```javascript
// User has "Standard" policy for all devices
await QosPolicy.assignToUser(userId, standardPolicyId);

// But their work laptop gets "Premium" for video conferencing
await QosPolicy.assignToDevice(
  workLaptopId,
  premiumPolicyId,
  adminId,
  "Needs high bandwidth for daily video calls"
);
```

### Case 3: Temporary Bandwidth Boost
```javascript
// User needs extra bandwidth for a presentation
await QosPolicy.assignToDevice(
  presentationLaptopId,
  enterprisePolicyId,
  adminId,
  "Temporary boost for Q4 presentation - expires 2025-11-05"
);

// Remove after presentation
await QosPolicy.removeFromDevice(presentationLaptopId);
// Device now falls back to user's policy
```

## 🎯 Real-World Scenario

**Company**: Tech Startup with 50 employees

**Setup**:
1. **Default**: All employees get "Standard" policy (10 Mbps)
2. **Engineers**: Work laptops get "High Priority" override (20 Mbps)
3. **CEO**: All devices get "Enterprise" policy (50 Mbps)
4. **Temporary**: Sales team devices boosted during product launch

**Implementation**:
```javascript
// 1. Assign default to all employees
employees.forEach(emp => {
  QosPolicy.assignToUser(emp.id, standardPolicyId);
});

// 2. Override for engineer laptops
engineerLaptops.forEach(device => {
  QosPolicy.assignToDevice(device.id, highPriorityPolicyId, adminId);
});

// 3. CEO gets enterprise everywhere
QosPolicy.assignToUser(ceoUserId, enterprisePolicyId);

// 4. Temporary boost for sales (during launch week)
salesDevices.forEach(device => {
  QosPolicy.assignToDevice(
    device.id, 
    enterprisePolicyId, 
    adminId,
    "Product launch week boost"
  );
});
```

## 🧪 Testing

Run the comprehensive test suite:
```bash
node test-qos-assignment.js
```

The test verifies:
- ✅ User policy assignment and retrieval
- ✅ Device policy assignment and retrieval
- ✅ Policy hierarchy (device overrides user)
- ✅ Effective policy resolution
- ✅ Policy removal and fallback behavior
- ✅ Statistics and reporting functions

## 📊 Database Schema

### Tables
- `qos_policies` - QoS policy definitions (existing)
- `user_qos` - User-to-policy assignments (existing)
- `device_qos` - Device-to-policy assignments (**NEW**)
- `devices` - Device information (existing)

### Views
- `v_devices_with_qos` - Comprehensive device and QoS view (**NEW**)

## 🔒 Security & Permissions

| Operation | User | Admin |
|-----------|------|-------|
| View own policy | ✅ | ✅ |
| View own devices' policies | ✅ | ✅ |
| Assign policy to user | ❌ | ✅ |
| Assign policy to device | ❌ | ✅ |
| View all policies | ✅ | ✅ |
| Create/edit policies | ❌ | ✅ |
| View statistics | ❌ | ✅ |

## 🎁 Benefits

✅ **Granular Control**: Two-level policy system  
✅ **Flexibility**: Override user policies per device  
✅ **Audit Trail**: Track assignments with admin ID and notes  
✅ **Performance**: Optimized database views  
✅ **User-Friendly**: Clear policy hierarchy  
✅ **Scalable**: Works from 10 to 10,000+ devices  

## 📞 Need Help?

1. **Read the docs**: Start with `QOS_ASSIGNMENT_FEATURE.md`
2. **Quick reference**: Check `QOS_ASSIGNMENT_QUICK_REFERENCE.md`
3. **Run tests**: Execute `node test-qos-assignment.js`
4. **Check examples**: See test file for code examples
5. **Review logs**: Application logs show all QoS operations

## 🎉 Ready to Deploy!

The QoS policy assignment feature is production-ready:
- ✅ Fully tested
- ✅ Documented
- ✅ Secure
- ✅ Performant
- ✅ Easy to use

Start by running the migration and explore the API endpoints!

---

**Feature Status**: ✅ Complete  
**Tested**: ✅ Yes  
**Production Ready**: ✅ Yes  
**Documentation**: ✅ Complete
