#!/usr/bin/env node
/**
 * Direct test runner - bypasses mocha's module loading
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const CONTAINER = 'openvpn-server';

let passed = 0;
let failed = 0;

async function sacli(cmd) {
  const { stdout } = await execAsync(`docker exec ${CONTAINER} sacli ${cmd}`);
  try {
    return JSON.parse(stdout);
  } catch {
    return stdout.trim();
  }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 OpenVPN User Sync Integration Tests\n');

  const timestamp = Date.now();
  const testUser = `test_${timestamp}`;

  // Test 1: Container connectivity
  console.log('📦 Container Connectivity');
  await test('Connect to OpenVPN container', async () => {
    const config = await sacli('ConfigQuery');
    if (typeof config !== 'object') throw new Error('Invalid response');
  });

  await test('List existing users', async () => {
    const users = await sacli('UserPropGet');
    const usernames = Object.keys(users);
    console.log(`      Found ${usernames.length} users`);
    if (!usernames.includes('openvpn')) throw new Error('Admin user not found');
  });

  // Test 2: User lifecycle
  console.log('\n👤 User Lifecycle');

  await test(`Create user: ${testUser}`, async () => {
    const result = await sacli(`--user "${testUser}" --new_pass "TestPass123!" SetLocalPassword`);
    if (!result.status) throw new Error('Failed to create user');
  });

  await test('Verify user exists', async () => {
    const users = await sacli('UserPropGet');
    if (!Object.keys(users).includes(testUser)) throw new Error('User not found');
  });

  await test('Set email property', async () => {
    await sacli(`--user "${testUser}" --key prop_email --value "${testUser}@test.com" UserPropPut`);
    const allProps = await sacli(`--user "${testUser}" UserPropGet`);
    const props = allProps[testUser] || {};
    if (props.prop_email !== `${testUser}@test.com`) throw new Error('Email not set');
  });

  await test('Set display name', async () => {
    await sacli(`--user "${testUser}" --key prop_c_name --value "Test User" UserPropPut`);
    const allProps = await sacli(`--user "${testUser}" UserPropGet`);
    const props = allProps[testUser] || {};
    if (props.prop_c_name !== 'Test User') throw new Error('Name not set');
  });

  await test('Grant admin privileges', async () => {
    await sacli(`--user "${testUser}" --key prop_superuser --value true UserPropPut`);
    const allProps = await sacli(`--user "${testUser}" UserPropGet`);
    const props = allProps[testUser] || {};
    if (props.prop_superuser !== 'true') throw new Error('Admin not granted');
  });

  await test('Revoke admin privileges', async () => {
    await sacli(`--user "${testUser}" --key prop_superuser --value false UserPropPut`);
    const allProps = await sacli(`--user "${testUser}" UserPropGet`);
    const props = allProps[testUser] || {};
    if (props.prop_superuser === 'true') throw new Error('Admin not revoked');
  });

  await test('Change password', async () => {
    const result = await sacli(`--user "${testUser}" --new_pass "NewPass456!" SetLocalPassword`);
    if (!result.status || !result.reason.includes('changed')) throw new Error('Password not changed');
  });

  await test('Delete user', async () => {
    await sacli(`--user "${testUser}" UserPropDelAll`);
    const users = await sacli('UserPropGet');
    if (Object.keys(users).includes(testUser)) throw new Error('User still exists');
  });

  // Test 3: Bulk operations
  console.log('\n📋 Bulk Operations');

  const bulkUsers = [`bulk1_${timestamp}`, `bulk2_${timestamp}`, `bulk3_${timestamp}`];

  await test('Create 3 bulk users', async () => {
    for (const user of bulkUsers) {
      await sacli(`--user "${user}" --new_pass "BulkPass123!" SetLocalPassword`);
    }
    const users = await sacli('UserPropGet');
    const usernames = Object.keys(users);
    for (const user of bulkUsers) {
      if (!usernames.includes(user)) throw new Error(`User ${user} not created`);
    }
  });

  await test('Delete bulk users', async () => {
    for (const user of bulkUsers) {
      await sacli(`--user "${user}" UserPropDelAll`);
    }
    const users = await sacli('UserPropGet');
    const usernames = Object.keys(users);
    for (const user of bulkUsers) {
      if (usernames.includes(user)) throw new Error(`User ${user} still exists`);
    }
  });

  // Test 4: Server status
  console.log('\n📊 Server Status');

  await test('Get server status', async () => {
    const status = await sacli('Status');
    if (typeof status !== 'object') throw new Error('Invalid status response');
  });

  await test('Get VPN summary', async () => {
    const summary = await sacli('VPNSummary');
    if (typeof summary !== 'object') throw new Error('Invalid summary response');
  });

  // Results
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total:  ${passed + failed}`);
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
