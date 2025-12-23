/**
 * Model Testing and Demonstration Script
 *
 * This script demonstrates how to use each model and tests basic functionality.
 * Run with: node src/models/test-models.js
 *
 * IMPORTANT: Ensure database is set up before running this script:
 * mysql -u root -p < database-setup.sql
 */

const { User, VerificationToken, ConfigFile, QosPolicy } = require('./index');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function testUserModel() {
  section('Testing User Model');

  try {
    // 1. Create a new user
    log('1. Creating new user...', 'blue');
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    const newUser = await User.create({
      email: 'testuser@example.com',
      password: hashedPassword,
      name: 'Test User',
      role: 'user'
    });
    log(`✓ User created with ID: ${newUser.id}`, 'green');

    // 2. Find user by email
    log('\n2. Finding user by email...', 'blue');
    const foundUser = await User.findByEmail('testuser@example.com');
    log(`✓ Found user: ${foundUser.name} (${foundUser.email})`, 'green');

    // 3. Update user profile
    log('\n3. Updating user profile...', 'blue');
    await User.updateProfile(newUser.id, { name: 'Updated Test User' });
    log('✓ Profile updated successfully', 'green');

    // 4. Find all users with pagination
    log('\n4. Getting paginated user list...', 'blue');
    const userList = await User.findAll(1, 10);
    log(`✓ Found ${userList.data.length} users (Total: ${userList.pagination.total})`, 'green');

    // 5. Soft delete user
    log('\n5. Soft deleting test user...', 'blue');
    await User.softDelete(newUser.id);
    log('✓ User soft deleted', 'green');

    return newUser.id;
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    throw error;
  }
}

async function testVerificationTokenModel(userId) {
  section('Testing VerificationToken Model');

  try {
    // 1. Create verification token
    log('1. Creating verification token...', 'blue');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await VerificationToken.create(userId, token, expiresAt);
    log(`✓ Token created: ${token.substring(0, 16)}...`, 'green');

    // 2. Find token
    log('\n2. Finding token...', 'blue');
    const foundToken = await VerificationToken.findByToken(token);
    if (foundToken) {
      log(`✓ Token found for user: ${foundToken.email}`, 'green');
    } else {
      log('✗ Token not found (user might be deleted)', 'yellow');
    }

    // 3. Check if token is valid
    log('\n3. Checking token validity...', 'blue');
    const isValid = await VerificationToken.isValid(token);
    log(`✓ Token is ${isValid ? 'valid' : 'invalid'}`, 'green');

    // 4. Delete token
    log('\n4. Deleting token...', 'blue');
    await VerificationToken.deleteByToken(token);
    log('✓ Token deleted', 'green');

    return token;
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    throw error;
  }
}

async function testQosPolicyModel() {
  section('Testing QosPolicy Model');

  try {
    // 1. Create QoS policy
    log('1. Creating QoS policy...', 'blue');
    const policy = await QosPolicy.create({
      name: 'Test Premium Plan',
      bandwidth_limit: '100Mbps',
      priority: 'high',
      description: 'Test premium bandwidth plan'
    });
    log(`✓ Policy created with ID: ${policy.id}`, 'green');

    // 2. Find all policies
    log('\n2. Getting all policies...', 'blue');
    const allPolicies = await QosPolicy.findAll();
    log(`✓ Found ${allPolicies.length} policies`, 'green');

    // 3. Find by priority
    log('\n3. Finding high-priority policies...', 'blue');
    const highPriority = await QosPolicy.findByPriority('high');
    log(`✓ Found ${highPriority.length} high-priority policies`, 'green');

    // 4. Update policy
    log('\n4. Updating policy...', 'blue');
    await QosPolicy.update(policy.id, {
      bandwidth_limit: '200Mbps',
      description: 'Updated premium plan'
    });
    log('✓ Policy updated', 'green');

    // 5. Get statistics
    log('\n5. Getting QoS statistics...', 'blue');
    const stats = await QosPolicy.getStats();
    log(`✓ Total policies: ${stats.total_policies}`, 'green');
    log(`  - High priority: ${stats.high_priority}`, 'green');
    log(`  - Medium priority: ${stats.medium_priority}`, 'green');
    log(`  - Low priority: ${stats.low_priority}`, 'green');

    // 6. Delete policy
    log('\n6. Deleting test policy...', 'blue');
    await QosPolicy.delete(policy.id);
    log('✓ Policy deleted', 'green');

    return allPolicies[0]; // Return first policy for config test
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    throw error;
  }
}

async function testConfigFileModel(userId, policyId) {
  section('Testing ConfigFile Model');

  try {
    // 1. Create config file
    log('1. Creating config file...', 'blue');
    const configContent = `
# OpenVPN Client Configuration
client
dev tun
proto udp
remote vpn.example.com 1194
resolv-retry infinite
nobind
persist-key
persist-tun
ca ca.crt
cert client.crt
key client.key
cipher AES-256-CBC
comp-lzo
verb 3
    `.trim();

    const config = await ConfigFile.create(
      userId,
      policyId,
      `test_config_${Date.now()}.ovpn`,
      configContent
    );
    log(`✓ Config created with ID: ${config.id}`, 'green');

    // 2. Find configs by user
    log('\n2. Finding configs for user...', 'blue');
    const userConfigs = await ConfigFile.findByUserId(userId);
    log(`✓ Found ${userConfigs.length} config(s) for user`, 'green');

    // 3. Mark as downloaded
    log('\n3. Marking config as downloaded...', 'blue');
    await ConfigFile.markDownloaded(config.id);
    log('✓ Config marked as downloaded', 'green');

    // 4. Get statistics
    log('\n4. Getting config statistics...', 'blue');
    const stats = await ConfigFile.getStats();
    log(`✓ Total configs: ${stats.total_configs}`, 'green');
    log(`  - Active: ${stats.active_configs}`, 'green');
    log(`  - Revoked: ${stats.revoked_configs}`, 'green');
    log(`  - Downloaded: ${stats.downloaded_configs}`, 'green');

    // 5. Revoke config
    log('\n5. Revoking config...', 'blue');
    await ConfigFile.revoke(config.id);
    log('✓ Config revoked', 'green');

    // 6. Delete config
    log('\n6. Deleting config...', 'blue');
    await ConfigFile.deleteById(config.id);
    log('✓ Config deleted', 'green');

    return config.id;
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    throw error;
  }
}

async function runAllTests() {
  log('Starting Model Tests...', 'yellow');
  log('Make sure the database is set up before running these tests!\n', 'yellow');

  try {
    // Test User Model
    const userId = await testUserModel();

    // Test VerificationToken Model
    await testVerificationTokenModel(userId);

    // Test QosPolicy Model
    const policy = await testQosPolicyModel();

    // Test ConfigFile Model (if we have a valid policy)
    if (policy && policy.id) {
      await testConfigFileModel(userId, policy.id);
    }

    section('All Tests Completed Successfully!');
    log('All model tests passed!', 'green');

    // Exit cleanly
    process.exit(0);
  } catch (error) {
    section('Test Failed');
    log(`Error during testing: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testUserModel,
  testVerificationTokenModel,
  testQosPolicyModel,
  testConfigFileModel,
  runAllTests
};
