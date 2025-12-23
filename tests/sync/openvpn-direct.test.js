/**
 * Direct OpenVPN Integration Test
 * Tests OpenVPN Access Server without loading backend application
 */

const { expect } = require('chai');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const CONTAINER_NAME = 'openvpn-server';

async function sacli(command) {
  const { stdout } = await execAsync(`docker exec ${CONTAINER_NAME} sacli ${command}`);
  try {
    return JSON.parse(stdout);
  } catch {
    return stdout.trim();
  }
}

async function userExists(username) {
  try {
    const users = await sacli('UserPropGet');
    return Object.keys(users).includes(username);
  } catch {
    return false;
  }
}

describe('OpenVPN Direct Integration Test', function() {
  this.timeout(30000);

  const timestamp = Date.now();
  const testUser = `test_${timestamp}`;

  describe('Container Connectivity', function() {
    it('should connect to OpenVPN container', async function() {
      const config = await sacli('ConfigQuery');
      expect(config).to.be.an('object');
      console.log('      ✓ OpenVPN container accessible');
    });

    it('should list existing users', async function() {
      const users = await sacli('UserPropGet');
      const usernames = Object.keys(users);
      console.log(`      ✓ Found ${usernames.length} users: ${usernames.slice(0, 3).join(', ')}${usernames.length > 3 ? '...' : ''}`);
      expect(usernames).to.include('openvpn'); // Admin user should exist
    });
  });

  describe('User Lifecycle', function() {
    after(async function() {
      try {
        await sacli(`--user "${testUser}" UserPropDelAll`);
      } catch (e) {
        // Cleanup - ignore errors
      }
    });

    it('should create new user', async function() {
      const result = await sacli(`--user "${testUser}" --new_pass "TestPass123!" SetLocalPassword`);
      expect(result.status).to.equal(true);
      expect(result.reason).to.include('Password changed successfully');
      console.log(`      ✓ Created user: ${testUser}`);
    });

    it('should verify user exists', async function() {
      const exists = await userExists(testUser);
      expect(exists).to.be.true;
    });

    it('should set email property', async function() {
      await sacli(`--user "${testUser}" --key prop_email --value "${testUser}@example.com" UserPropPut`);
      const props = await sacli(`--user "${testUser}" UserPropGet`);
      expect(props.prop_email).to.equal(`${testUser}@example.com`);
      console.log('      ✓ Email property set');
    });

    it('should set display name', async function() {
      await sacli(`--user "${testUser}" --key prop_c_name --value "Test User" UserPropPut`);
      const props = await sacli(`--user "${testUser}" UserPropGet`);
      expect(props.prop_c_name).to.equal('Test User');
      console.log('      ✓ Display name set');
    });

    it('should grant admin privileges', async function() {
      await sacli(`--user "${testUser}" --key prop_superuser --value true UserPropPut`);
      const props = await sacli(`--user "${testUser}" UserPropGet`);
      expect(props.prop_superuser).to.equal('true');
      console.log('      ✓ Admin privileges granted');
    });

    it('should revoke admin privileges', async function() {
      await sacli(`--user "${testUser}" --key prop_superuser --value false UserPropPut`);
      const props = await sacli(`--user "${testUser}" UserPropGet`);
      expect(props.prop_superuser).to.not.equal('true');
      console.log('      ✓ Admin privileges revoked');
    });

    it('should change password', async function() {
      const result = await sacli(`--user "${testUser}" --new_pass "NewPass456!" SetLocalPassword`);
      expect(result.status).to.equal(true);
      expect(result.reason).to.include('changed successfully');
      console.log('      ✓ Password changed');
    });

    it('should delete user', async function() {
      await sacli(`--user "${testUser}" UserPropDelAll`);
      const exists = await userExists(testUser);
      expect(exists).to.be.false;
      console.log(`      ✓ User deleted: ${testUser}`);
    });
  });

  describe('Bulk Operations', function() {
    const bulkUsers = Array.from({ length: 3 }, (_, i) => `bulk${i}_${timestamp}`);

    after(async function() {
      for (const user of bulkUsers) {
        try {
          await sacli(`--user "${user}" UserPropDelAll`);
        } catch (e) {
          // Ignore
        }
      }
    });

    it('should create multiple users', async function() {
      for (const user of bulkUsers) {
        await sacli(`--user "${user}" --new_pass "BulkPass123!" SetLocalPassword`);
      }

      for (const user of bulkUsers) {
        const exists = await userExists(user);
        expect(exists).to.be.true;
      }

      console.log(`      ✓ Created ${bulkUsers.length} bulk users`);
    });

    it('should delete all bulk users', async function() {
      for (const user of bulkUsers) {
        await sacli(`--user "${user}" UserPropDelAll`);
      }

      for (const user of bulkUsers) {
        const exists = await userExists(user);
        expect(exists).to.be.false;
      }

      console.log(`      ✓ Deleted ${bulkUsers.length} bulk users`);
    });
  });

  describe('Server Status', function() {
    it('should get server status', async function() {
      const status = await sacli('Status');
      expect(status).to.be.an('object');
      console.log('      ✓ Server status retrieved');
    });

    it('should get VPN summary', async function() {
      const summary = await sacli('VPNSummary');
      expect(summary).to.be.an('object');
      console.log('      ✓ VPN summary retrieved');
    });
  });
});
