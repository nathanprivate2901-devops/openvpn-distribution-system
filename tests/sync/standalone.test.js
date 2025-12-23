const { expect } = require('chai');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Standalone OpenVPN Sync Test
 * Tests OpenVPN integration without starting the backend server
 */
describe('OpenVPN Integration - Standalone', function() {
  this.timeout(30000);

  const containerName = process.env.OPENVPN_CONTAINER_NAME || 'openvpn-server';
  const testUsername = `synctest_${Date.now()}`;

  // Helper function
  async function execSacli(command) {
    const { stdout } = await execAsync(`docker exec ${containerName} sacli ${command}`);
    try {
      return JSON.parse(stdout);
    } catch {
      return stdout.trim();
    }
  }

  async function userExists(username) {
    try {
      const result = await execSacli('UserPropGet');
      return Object.keys(result).includes(username);
    } catch {
      return false;
    }
  }

  describe('1. OpenVPN Container Health', function() {
    it('should connect to OpenVPN container', async function() {
      const result = await execSacli('ConfigQuery');
      expect(result).to.be.an('object');
      console.log('      ✓ Container is accessible');
    });

    it('should have admin user', async function() {
      const exists = await userExists('openvpn');
      expect(exists).to.be.true;
      console.log('      ✓ Admin user exists');
    });
  });

  describe('2. User Sync Operations', function() {
    after(async function() {
      try {
        await execSacli(`--user "${testUsername}" UserPropDelAll`);
      } catch (err) {
        // Ignore cleanup errors
      }
    });

    it('should create test user', async function() {
      const result = await execSacli(
        `--user "${testUsername}" --new_pass "TestPassword123!" SetLocalPassword`
      );

      expect(result).to.have.property('status', true);
      console.log(`      ✓ Created user: ${testUsername}`);
    });

    it('should verify user exists', async function() {
      const exists = await userExists(testUsername);
      expect(exists).to.be.true;
    });

    it('should set user properties', async function() {
      // Set email
      await execSacli(
        `--user "${testUsername}" --key prop_email --value "${testUsername}@test.com" UserPropPut`
      );

      // Set name
      await execSacli(
        `--user "${testUsername}" --key prop_c_name --value "Sync Test User" UserPropPut`
      );

      // Verify
      const props = await execSacli(`--user "${testUsername}" UserPropGet`);
      expect(props.prop_email).to.equal(`${testUsername}@test.com`);
      expect(props.prop_c_name).to.equal('Sync Test User');

      console.log('      ✓ User properties set');
    });

    it('should grant and revoke admin privileges', async function() {
      // Grant admin
      await execSacli(
        `--user "${testUsername}" --key prop_superuser --value true UserPropPut`
      );

      let props = await execSacli(`--user "${testUsername}" UserPropGet`);
      expect(props.prop_superuser).to.equal('true');

      // Revoke admin
      await execSacli(
        `--user "${testUsername}" --key prop_superuser --value false UserPropPut`
      );

      props = await execSacli(`--user "${testUsername}" UserPropGet`);
      expect(props.prop_superuser).to.not.equal('true');

      console.log('      ✓ Admin privileges managed');
    });

    it('should change user password', async function() {
      const result = await execSacli(
        `--user "${testUsername}" --new_pass "NewPassword456!" SetLocalPassword`
      );

      expect(result).to.have.property('status', true);
      expect(result.reason).to.include('changed');

      console.log('      ✓ Password changed');
    });

    it('should delete user', async function() {
      await execSacli(`--user "${testUsername}" UserPropDelAll`);

      const exists = await userExists(testUsername);
      expect(exists).to.be.false;

      console.log(`      ✓ Deleted user: ${testUsername}`);
    });
  });

  describe('3. Bulk User Management', function() {
    const bulkPrefix = `bulk_${Date.now()}`;
    const bulkUsers = Array.from({ length: 5 }, (_, i) => `${bulkPrefix}_${i}`);

    after(async function() {
      for (const username of bulkUsers) {
        try {
          await execSacli(`--user "${username}" UserPropDelAll`);
        } catch (err) {
          // Ignore
        }
      }
    });

    it('should create multiple users simultaneously', async function() {
      const promises = bulkUsers.map(username =>
        execSacli(`--user "${username}" --new_pass "BulkPass123!" SetLocalPassword`)
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).to.have.property('status', true);
      });

      console.log(`      ✓ Created ${bulkUsers.length} users`);
    });

    it('should verify all bulk users exist', async function() {
      const allUsers = await execSacli('UserPropGet');
      const usernames = Object.keys(allUsers);

      bulkUsers.forEach(username => {
        expect(usernames).to.include(username);
      });
    });

    it('should delete all bulk users', async function() {
      for (const username of bulkUsers) {
        await execSacli(`--user "${username}" UserPropDelAll`);
      }

      // Verify deletion
      for (const username of bulkUsers) {
        const exists = await userExists(username);
        expect(exists).to.be.false;
      }

      console.log(`      ✓ Deleted ${bulkUsers.length} users`);
    });
  });

  describe('4. Sync Status Check', function() {
    it('should list all current users', async function() {
      const result = await execSacli('UserPropGet');
      const usernames = Object.keys(result);

      console.log(`      ✓ Total users: ${usernames.length}`);
      console.log(`      Users: ${usernames.join(', ')}`);

      expect(usernames).to.be.an('array');
      expect(usernames.length).to.be.at.least(1); // At least admin user
    });

    it('should get VPN server status', async function() {
      const result = await execSacli('Status');

      expect(result).to.be.an('object');
      console.log('      ✓ Server status retrieved');
    });

    it('should query VPN summary', async function() {
      const result = await execSacli('VPNSummary');

      expect(result).to.be.an('object');
      console.log('      ✓ VPN summary retrieved');
    });
  });
});
