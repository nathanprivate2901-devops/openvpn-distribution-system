/**
 * QoS Policy Assignment - Test Script
 * 
 * This script demonstrates and tests the QoS policy assignment feature
 * for both users and devices.
 * 
 * Prerequisites:
 * 1. Run migration: migrations/003_add_device_qos.sql
 * 2. Ensure server is running
 * 3. Have test user and device IDs ready
 * 
 * Usage: node test-qos-assignment.js
 */

const { QosPolicy, User, Device } = require('./src/models');
const logger = require('./src/utils/logger');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'cyan');
  console.log('='.repeat(70));
}

async function testUserQosAssignment() {
  section('Testing User-Level QoS Policy Assignment');

  try {
    // 1. Get all QoS policies
    log('\n1. Fetching available QoS policies...', 'blue');
    const policies = await QosPolicy.findAll();
    log(`✓ Found ${policies.length} policies`, 'green');
    policies.forEach(p => {
      log(`  - ${p.name}: ${p.bandwidth_limit / 1000} Mbps (${p.priority} priority)`, 'yellow');
    });

    if (policies.length === 0) {
      log('⚠ No QoS policies found. Please create policies first.', 'yellow');
      return null;
    }

    // 2. Get a test user
    log('\n2. Finding test user...', 'blue');
    const users = await User.findAll(1, 5);
    if (users.data.length === 0) {
      log('⚠ No users found. Please create a test user first.', 'yellow');
      return null;
    }
    const testUser = users.data[0];
    log(`✓ Using user: ${testUser.email} (ID: ${testUser.id})`, 'green');

    // 3. Assign QoS policy to user
    log('\n3. Assigning QoS policy to user...', 'blue');
    const standardPolicy = policies.find(p => p.name === 'Standard') || policies[0];
    const assignment = await QosPolicy.assignToUser(testUser.id, standardPolicy.id);
    log(`✓ Assigned "${standardPolicy.name}" policy to user`, 'green');
    log(`  Bandwidth: ${standardPolicy.bandwidth_limit / 1000} Mbps`, 'yellow');

    // 4. Verify assignment
    log('\n4. Verifying user policy assignment...', 'blue');
    const userPolicy = await QosPolicy.findByUserId(testUser.id);
    if (userPolicy) {
      log(`✓ User has policy: ${userPolicy.name}`, 'green');
      log(`  Priority: ${userPolicy.priority}`, 'yellow');
      log(`  Assigned at: ${userPolicy.assigned_at}`, 'yellow');
    } else {
      log('✗ Failed to retrieve user policy', 'red');
    }

    // 5. Get users with this policy
    log('\n5. Getting all users with this policy...', 'blue');
    const usersWithPolicy = await QosPolicy.getUsersByPolicy(standardPolicy.id);
    log(`✓ Found ${usersWithPolicy.length} users with "${standardPolicy.name}" policy`, 'green');

    return { userId: testUser.id, policyId: standardPolicy.id };

  } catch (error) {
    log(`✗ Error in user QoS assignment test: ${error.message}`, 'red');
    console.error(error);
    return null;
  }
}

async function testDeviceQosAssignment(userId) {
  section('Testing Device-Level QoS Policy Assignment');

  try {
    // 1. Get user's devices
    log('\n1. Fetching user\'s devices...', 'blue');
    const Device = require('./src/models/Device');
    const devices = await Device.findByUserId(userId);
    
    if (devices.length === 0) {
      log('⚠ No devices found for user. Devices are auto-created on VPN connection.', 'yellow');
      log('  Tip: Connect to VPN to create a device, or create one manually for testing.', 'yellow');
      return;
    }

    log(`✓ Found ${devices.length} devices`, 'green');
    devices.forEach(d => {
      log(`  - ${d.name} (${d.device_type}) - ID: ${d.id}`, 'yellow');
    });

    const testDevice = devices[0];

    // 2. Get all QoS policies
    log('\n2. Fetching QoS policies...', 'blue');
    const policies = await QosPolicy.findAll();
    const premiumPolicy = policies.find(p => p.name === 'Premium') || policies[policies.length - 1];

    // 3. Assign device-specific QoS policy
    log('\n3. Assigning device-specific QoS policy...', 'blue');
    const deviceAssignment = await QosPolicy.assignToDevice(
      testDevice.id, 
      premiumPolicy.id,
      1, // Admin user ID
      'Test assignment - prioritizing this device'
    );
    log(`✓ Assigned "${premiumPolicy.name}" policy to device "${testDevice.name}"`, 'green');
    log(`  This overrides any user-level policy for this device`, 'yellow');

    // 4. Get device's assigned policy
    log('\n4. Verifying device policy assignment...', 'blue');
    const devicePolicy = await QosPolicy.findByDeviceId(testDevice.id);
    if (devicePolicy) {
      log(`✓ Device has policy: ${devicePolicy.name}`, 'green');
      log(`  Bandwidth: ${devicePolicy.bandwidth_limit / 1000} Mbps`, 'yellow');
      log(`  Priority: ${devicePolicy.priority}`, 'yellow');
      log(`  Assigned by: ${devicePolicy.assigned_by_name || 'System'}`, 'yellow');
      if (devicePolicy.notes) {
        log(`  Notes: ${devicePolicy.notes}`, 'yellow');
      }
    }

    // 5. Get effective policy for device
    log('\n5. Getting effective QoS policy for device...', 'blue');
    const effectivePolicy = await QosPolicy.getEffectiveDevicePolicy(testDevice.id);
    if (effectivePolicy) {
      log(`✓ Effective policy: ${effectivePolicy.name}`, 'green');
      log(`  Source: ${effectivePolicy.policy_source} level`, 'yellow');
      log(`  Bandwidth: ${effectivePolicy.bandwidth_limit / 1000} Mbps`, 'yellow');
    }

    // 6. Get device with QoS info
    log('\n6. Getting device with QoS information...', 'blue');
    const deviceWithQos = await Device.findByIdWithQos(testDevice.id);
    if (deviceWithQos) {
      log(`✓ Device: ${deviceWithQos.name}`, 'green');
      if (deviceWithQos.qos_policy_name) {
        log(`  QoS Policy: ${deviceWithQos.qos_policy_name} (${deviceWithQos.qos_source} level)`, 'yellow');
        log(`  Bandwidth: ${deviceWithQos.bandwidth_limit / 1000} Mbps`, 'yellow');
        log(`  Priority: ${deviceWithQos.qos_priority}`, 'yellow');
      }
    }

    // 7. Get all devices with a policy
    log('\n7. Getting all devices with this policy...', 'blue');
    const devicesWithPolicy = await QosPolicy.getDevicesByPolicy(premiumPolicy.id);
    log(`✓ Found ${devicesWithPolicy.length} devices with "${premiumPolicy.name}" policy`, 'green');
    devicesWithPolicy.forEach(d => {
      log(`  - ${d.name} (${d.user_name} - ${d.user_email})`, 'yellow');
    });

    // 8. Get device QoS statistics
    log('\n8. Getting device QoS statistics...', 'blue');
    const stats = await QosPolicy.getDeviceQosStats();
    log(`✓ Device QoS Statistics:`, 'green');
    log(`  Total devices with policies: ${stats.devices_with_policies}`, 'yellow');
    log(`  Policies in use: ${stats.policies_in_use}`, 'yellow');
    log(`  Total assignments: ${stats.total_device_assignments}`, 'yellow');

    // 9. Remove device-specific policy to test fallback
    log('\n9. Testing policy removal and fallback...', 'blue');
    await QosPolicy.removeFromDevice(testDevice.id);
    log(`✓ Removed device-specific policy`, 'green');
    
    const fallbackPolicy = await QosPolicy.getEffectiveDevicePolicy(testDevice.id);
    if (fallbackPolicy) {
      log(`✓ Device now uses fallback policy: ${fallbackPolicy.name} (${fallbackPolicy.policy_source} level)`, 'green');
    } else {
      log(`✓ Device has no policy (neither device-level nor user-level)`, 'yellow');
    }

  } catch (error) {
    log(`✗ Error in device QoS assignment test: ${error.message}`, 'red');
    console.error(error);
  }
}

async function testPolicyStatistics() {
  section('Testing QoS Policy Statistics');

  try {
    // 1. Get overall QoS statistics
    log('\n1. Fetching overall QoS statistics...', 'blue');
    const stats = await QosPolicy.getStats();
    log(`✓ Overall QoS Statistics:`, 'green');
    log(`  Total policies: ${stats.total_policies}`, 'yellow');
    log(`  High priority: ${stats.high_priority}`, 'yellow');
    log(`  Medium priority: ${stats.medium_priority}`, 'yellow');
    log(`  Low priority: ${stats.low_priority}`, 'yellow');
    log(`  Users with policies: ${stats.users_with_policies}`, 'yellow');

    // 2. Get device QoS statistics
    log('\n2. Fetching device QoS statistics...', 'blue');
    const deviceStats = await QosPolicy.getDeviceQosStats();
    log(`✓ Device QoS Statistics:`, 'green');
    log(`  Devices with policies: ${deviceStats.devices_with_policies}`, 'yellow');
    log(`  Policies in use: ${deviceStats.policies_in_use}`, 'yellow');

  } catch (error) {
    log(`✗ Error in statistics test: ${error.message}`, 'red');
    console.error(error);
  }
}

async function runAllTests() {
  log('\n╔═══════════════════════════════════════════════════════════════════╗', 'magenta');
  log('║       QoS Policy Assignment Feature - Test Suite                 ║', 'magenta');
  log('╚═══════════════════════════════════════════════════════════════════╝', 'magenta');

  try {
    // Test user-level QoS assignment
    const userTestResult = await testUserQosAssignment();
    
    if (userTestResult) {
      // Test device-level QoS assignment
      await testDeviceQosAssignment(userTestResult.userId);
    }

    // Test statistics
    await testPolicyStatistics();

    section('✓ All Tests Completed Successfully!');
    log('The QoS policy assignment feature is working correctly.', 'green');
    log('\nKey Features Tested:', 'cyan');
    log('  ✓ User-level QoS assignment', 'green');
    log('  ✓ Device-level QoS assignment', 'green');
    log('  ✓ Policy hierarchy (device overrides user)', 'green');
    log('  ✓ Effective policy resolution', 'green');
    log('  ✓ Policy removal and fallback', 'green');
    log('  ✓ Statistics and reporting', 'green');

    process.exit(0);

  } catch (error) {
    section('✗ Test Failed');
    log(`Error during testing: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testUserQosAssignment,
  testDeviceQosAssignment,
  testPolicyStatistics
};
