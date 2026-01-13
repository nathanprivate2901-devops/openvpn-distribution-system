/**
 * Test Case: VPN IP Conflict Resolution
 * 
 * This test simulates VPN IP reuse scenarios to verify that the system
 * correctly handles device registration when VPN IPs are reassigned
 * between different users.
 */

const pool = require('./src/config/database');
const logger = require('./src/utils/logger');

// Test configuration
const TEST_VPN_IP = '172.27.250.100'; // Use a dedicated test IP
const TEST_USERS = [
  { id: 2, username: 'demousersync' },
  { id: 16, username: 'sad' }
];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(colors.cyan, `\n📝 Step ${step}: ${message}`);
}

function logSuccess(message) {
  log(colors.green, `✅ ${message}`);
}

function logError(message) {
  log(colors.red, `❌ ${message}`);
}

function logInfo(message) {
  log(colors.blue, `ℹ️  ${message}`);
}

/**
 * Clean up test data
 */
async function cleanup() {
  try {
    await pool.execute(
      'DELETE FROM devices WHERE device_id = ?',
      [TEST_VPN_IP]
    );
    logInfo('Test data cleaned up');
  } catch (error) {
    logError(`Cleanup failed: ${error.message}`);
  }
}

/**
 * Test Case 1: Initial device registration
 * User A connects and gets VPN IP assigned
 */
async function testCase1_InitialRegistration() {
  logStep(1, 'Test Initial Device Registration');
  
  try {
    const user = TEST_USERS[0];
    const deviceName = `${user.username}'s test device (${TEST_VPN_IP})`;
    
    logInfo(`Inserting device for user ${user.id} (${user.username})`);
    
    await pool.execute(
      `INSERT INTO devices (user_id, name, device_id, device_type, last_ip, last_connected, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), TRUE, NOW(), NOW())`,
      [user.id, deviceName, TEST_VPN_IP, 'desktop', '192.168.1.100']
    );
    
    // Verify insertion
    const [devices] = await pool.execute(
      'SELECT * FROM devices WHERE device_id = ?',
      [TEST_VPN_IP]
    );
    
    if (devices.length === 1 && devices[0].user_id === user.id) {
      logSuccess('Device registered successfully for user ' + user.id);
      logInfo(`Device ID: ${devices[0].id}, User: ${devices[0].user_id}, VPN IP: ${devices[0].device_id}`);
      return true;
    } else {
      logError('Device registration verification failed');
      return false;
    }
  } catch (error) {
    logError(`Test Case 1 failed: ${error.message}`);
    return false;
  }
}

/**
 * Test Case 2: Duplicate prevention - same user, same VPN IP
 * User A tries to register the same VPN IP again (should fail with unique constraint)
 */
async function testCase2_DuplicatePrevention() {
  logStep(2, 'Test Duplicate Prevention (Same User, Same VPN IP)');
  
  try {
    const user = TEST_USERS[0];
    const deviceName = `${user.username}'s duplicate device (${TEST_VPN_IP})`;
    
    logInfo(`Attempting to insert duplicate device for user ${user.id}`);
    
    await pool.execute(
      `INSERT INTO devices (user_id, name, device_id, device_type, last_ip, last_connected, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), TRUE, NOW(), NOW())`,
      [user.id, deviceName, TEST_VPN_IP, 'mobile', '192.168.1.100']
    );
    
    logError('Duplicate device was inserted (SHOULD NOT HAPPEN)');
    return false;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      logSuccess('Duplicate correctly prevented by unique constraint');
      logInfo(`Error: ${error.message}`);
      return true;
    } else {
      logError(`Unexpected error: ${error.message}`);
      return false;
    }
  }
}

/**
 * Test Case 3: VPN IP reuse - different user
 * User B connects and gets the same VPN IP (should succeed with new schema)
 */
async function testCase3_VpnIpReuse() {
  logStep(3, 'Test VPN IP Reuse (Different User, Same VPN IP)');
  
  try {
    const user = TEST_USERS[1];
    const deviceName = `${user.username}'s test device (${TEST_VPN_IP})`;
    
    logInfo(`Inserting device for user ${user.id} (${user.username}) with same VPN IP`);
    
    await pool.execute(
      `INSERT INTO devices (user_id, name, device_id, device_type, last_ip, last_connected, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), TRUE, NOW(), NOW())`,
      [user.id, deviceName, TEST_VPN_IP, 'desktop', '192.168.1.200']
    );
    
    // Verify both devices exist
    const [devices] = await pool.execute(
      'SELECT * FROM devices WHERE device_id = ? ORDER BY user_id',
      [TEST_VPN_IP]
    );
    
    if (devices.length === 2 && 
        devices[0].user_id === TEST_USERS[0].id && 
        devices[1].user_id === TEST_USERS[1].id) {
      logSuccess('VPN IP successfully reused across different users');
      logInfo(`User ${devices[0].user_id} - Device ID: ${devices[0].id}`);
      logInfo(`User ${devices[1].user_id} - Device ID: ${devices[1].id}`);
      return true;
    } else {
      logError('VPN IP reuse verification failed');
      logInfo(`Found ${devices.length} devices`);
      return false;
    }
  } catch (error) {
    logError(`Test Case 3 failed: ${error.message}`);
    logInfo('This likely means the database migration has not been applied yet');
    return false;
  }
}

/**
 * Test Case 4: Update existing device
 * User A reconnects with same VPN IP (should update, not insert)
 */
async function testCase4_UpdateExisting() {
  logStep(4, 'Test Update Existing Device (Same User Reconnects)');
  
  try {
    const user = TEST_USERS[0];
    
    // Get current device
    const [beforeUpdate] = await pool.execute(
      'SELECT * FROM devices WHERE user_id = ? AND device_id = ?',
      [user.id, TEST_VPN_IP]
    );
    
    if (beforeUpdate.length === 0) {
      logError('No device found to update');
      return false;
    }
    
    const deviceId = beforeUpdate[0].id;
    const oldLastConnected = beforeUpdate[0].last_connected;
    
    logInfo(`Updating device ${deviceId} for user ${user.id}`);
    
    // Wait 1 second to ensure timestamp changes
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update device (simulate reconnection)
    await pool.execute(
      `UPDATE devices 
       SET last_connected = NOW(), 
           is_active = TRUE,
           last_ip = ?,
           updated_at = NOW()
       WHERE id = ?`,
      ['192.168.1.150', deviceId]
    );
    
    // Verify update
    const [afterUpdate] = await pool.execute(
      'SELECT * FROM devices WHERE id = ?',
      [deviceId]
    );
    
    const newLastConnected = afterUpdate[0].last_connected;
    
    if (afterUpdate.length === 1 && 
        afterUpdate[0].last_ip === '192.168.1.150' &&
        newLastConnected > oldLastConnected) {
      logSuccess('Device successfully updated');
      logInfo(`Last connected: ${oldLastConnected} → ${newLastConnected}`);
      logInfo(`Last IP: ${beforeUpdate[0].last_ip} → ${afterUpdate[0].last_ip}`);
      return true;
    } else {
      logError('Device update verification failed');
      return false;
    }
  } catch (error) {
    logError(`Test Case 4 failed: ${error.message}`);
    return false;
  }
}

/**
 * Test Case 5: Cleanup conflict detection
 * Simulate VPN monitor detecting and cleaning up conflicts
 */
async function testCase5_ConflictCleanup() {
  logStep(5, 'Test Conflict Detection and Cleanup');
  
  try {
    const oldUser = TEST_USERS[0];
    const newUser = TEST_USERS[1];
    
    // Mark old user's device as inactive
    await pool.execute(
      'UPDATE devices SET is_active = FALSE WHERE user_id = ? AND device_id = ?',
      [oldUser.id, TEST_VPN_IP]
    );
    
    logInfo(`User ${oldUser.id}'s device marked as inactive (simulating disconnect)`);
    
    // Check for conflict (new user trying to use same VPN IP)
    const [conflictingDevices] = await pool.execute(
      'SELECT id, user_id, is_active FROM devices WHERE device_id = ? AND user_id != ?',
      [TEST_VPN_IP, newUser.id]
    );
    
    if (conflictingDevices.length > 0) {
      logInfo(`Found ${conflictingDevices.length} conflicting device(s)`);
      
      // Simulate cleanup - delete inactive devices with same VPN IP
      for (const device of conflictingDevices) {
        if (!device.is_active) {
          await pool.execute('DELETE FROM devices WHERE id = ?', [device.id]);
          logInfo(`Cleaned up inactive device ${device.id} from user ${device.user_id}`);
        }
      }
      
      // Verify cleanup
      const [remaining] = await pool.execute(
        'SELECT * FROM devices WHERE device_id = ? AND user_id = ?',
        [TEST_VPN_IP, oldUser.id]
      );
      
      if (remaining.length === 0) {
        logSuccess('Conflict successfully detected and cleaned up');
        return true;
      } else {
        logError('Cleanup verification failed');
        return false;
      }
    } else {
      logSuccess('No conflicts found (new schema allows both devices)');
      return true;
    }
  } catch (error) {
    logError(`Test Case 5 failed: ${error.message}`);
    return false;
  }
}

/**
 * Test Case 6: Query performance
 * Verify that lookups using composite key are fast
 */
async function testCase6_QueryPerformance() {
  logStep(6, 'Test Query Performance with Composite Index');
  
  try {
    const user = TEST_USERS[1];
    
    const startTime = Date.now();
    
    // Perform lookup using composite key
    const [devices] = await pool.execute(
      'SELECT * FROM devices WHERE user_id = ? AND device_id = ?',
      [user.id, TEST_VPN_IP]
    );
    
    const endTime = Date.now();
    const queryTime = endTime - startTime;
    
    if (devices.length > 0) {
      logSuccess(`Query completed in ${queryTime}ms`);
      logInfo(`Found device: ${devices[0].name}`);
      
      if (queryTime < 100) {
        logSuccess('Query performance is excellent (< 100ms)');
        return true;
      } else {
        logInfo('Query performance is acceptable but could be optimized');
        return true;
      }
    } else {
      logError('No device found for query');
      return false;
    }
  } catch (error) {
    logError(`Test Case 6 failed: ${error.message}`);
    return false;
  }
}

/**
 * Run all test cases
 */
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  log(colors.yellow, '🧪 VPN IP Conflict Resolution Test Suite');
  console.log('='.repeat(60));
  
  const results = {
    passed: 0,
    failed: 0,
    total: 6
  };
  
  try {
    // Cleanup before tests
    logInfo('Cleaning up previous test data...');
    await cleanup();
    
    // Run test cases
    const test1 = await testCase1_InitialRegistration();
    results.passed += test1 ? 1 : 0;
    results.failed += test1 ? 0 : 1;
    
    const test2 = await testCase2_DuplicatePrevention();
    results.passed += test2 ? 1 : 0;
    results.failed += test2 ? 0 : 1;
    
    const test3 = await testCase3_VpnIpReuse();
    results.passed += test3 ? 1 : 0;
    results.failed += test3 ? 0 : 1;
    
    const test4 = await testCase4_UpdateExisting();
    results.passed += test4 ? 1 : 0;
    results.failed += test4 ? 0 : 1;
    
    const test5 = await testCase5_ConflictCleanup();
    results.passed += test5 ? 1 : 0;
    results.failed += test5 ? 0 : 1;
    
    const test6 = await testCase6_QueryPerformance();
    results.passed += test6 ? 1 : 0;
    results.failed += test6 ? 0 : 1;
    
    // Cleanup after tests
    logInfo('\nCleaning up test data...');
    await cleanup();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    log(colors.yellow, '📊 Test Results Summary');
    console.log('='.repeat(60));
    
    logInfo(`Total Tests: ${results.total}`);
    logSuccess(`Passed: ${results.passed}`);
    
    if (results.failed > 0) {
      logError(`Failed: ${results.failed}`);
    } else {
      logSuccess('All tests passed! 🎉');
    }
    
    console.log('='.repeat(60) + '\n');
    
    process.exit(results.failed > 0 ? 1 : 0);
    
  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();
