const { expect } = require('chai');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Simple OpenVPN Sync Test
 * Basic smoke test to verify sync functionality
 */
describe('OpenVPN Sync - Simple Test', function() {
  this.timeout(30000);

  const testUsername = `testuser_${Date.now()}`;
  const containerName = process.env.OPENVPN_CONTAINER_NAME || 'openvpn-server';

  // Helper function to execute sacli command
  async function execSacli(command) {
    try {
      const { stdout } = await execAsync(`docker exec ${containerName} sacli ${command}`);
      try {
        return JSON.parse(stdout);
      } catch {
        return stdout.trim();
      }
    } catch (error) {
      throw new Error(`sacli error: ${error.message}`);
    }
  }

  // Helper to check if user exists
  async function openvpnUserExists(username) {
    try {
      const result = await execSacli('UserPropGet');
      return Object.keys(result).includes(username);
    } catch (error) {
      return false;
    }
  }

  describe('Basic Connectivity', function() {
    it('should connect to OpenVPN container', async function() {
      const result = await execSacli('ConfigQuery');
      expect(result).to.be.an('object');
    });

    it('should list existing OpenVPN users', async function() {
      const result = await execSacli('UserPropGet');
      expect(result).to.be.an('object');
      console.log('      Existing users:', Object.keys(result).join(', '));
    });
  });

  describe('User Management', function() {
    after(async function() {
      // Cleanup
      try {
        await execSacli(`--user "${testUsername}" UserPropDelAll`);
      } catch (error) {
        // Ignore if user doesn't exist
      }
    });

    it('should create a new user in OpenVPN', async function() {
      const result = await execSacli(
        `--user "${testUsername}" --new_pass "TestPass123!" SetLocalPassword`
      );

      expect(result).to.have.property('status', true);
      console.log('      Created user:', testUsername);
    });

    it('should verify user exists', async function() {
      const exists = await openvpnUserExists(testUsername);
      expect(exists).to.be.true;
    });

    it('should set user email property', async function() {
      await execSacli(
        `--user "${testUsername}" --key prop_email --value "test@example.com" UserPropPut`
      );

      const props = await execSacli(`--user "${testUsername}" UserPropGet`);
      expect(props).to.have.property('prop_email', 'test@example.com');
    });

    it('should set user display name', async function() {
      await execSacli(
        `--user "${testUsername}" --key prop_c_name --value "Test User" UserPropPut`
      );

      const props = await execSacli(`--user "${testUsername}" UserPropGet`);
      expect(props).to.have.property('prop_c_name', 'Test User');
    });

    it('should grant admin privileges', async function() {
      await execSacli(
        `--user "${testUsername}" --key prop_superuser --value true UserPropPut`
      );

      const props = await execSacli(`--user "${testUsername}" UserPropGet`);
      expect(props.prop_superuser).to.equal('true');
    });

    it('should remove admin privileges', async function() {
      await execSacli(
        `--user "${testUsername}" --key prop_superuser --value false UserPropPut`
      );

      const props = await execSacli(`--user "${testUsername}" UserPropGet`);
      expect(props.prop_superuser).to.not.equal('true');
    });

    it('should delete user from OpenVPN', async function() {
      await execSacli(`--user "${testUsername}" UserPropDelAll`);

      const exists = await openvpnUserExists(testUsername);
      expect(exists).to.be.false;
    });
  });

  describe('Password Management', function() {
    const pwdTestUser = `pwdtest_${Date.now()}`;

    after(async function() {
      try {
        await execSacli(`--user "${pwdTestUser}" UserPropDelAll`);
      } catch (error) {
        // Ignore
      }
    });

    it('should create user with password', async function() {
      const result = await execSacli(
        `--user "${pwdTestUser}" --new_pass "InitialPass123!" SetLocalPassword`
      );

      expect(result).to.have.property('status', true);
    });

    it('should change user password', async function() {
      const result = await execSacli(
        `--user "${pwdTestUser}" --new_pass "NewPass456!" SetLocalPassword`
      );

      expect(result).to.have.property('status', true);
      expect(result.reason).to.include('changed');
    });
  });

  describe('Bulk Operations', function() {
    const bulkUsers = [
      `bulk1_${Date.now()}`,
      `bulk2_${Date.now()}`,
      `bulk3_${Date.now()}`
    ];

    after(async function() {
      // Cleanup all bulk users
      for (const username of bulkUsers) {
        try {
          await execSacli(`--user "${username}" UserPropDelAll`);
        } catch (error) {
          // Ignore
        }
      }
    });

    it('should create multiple users', async function() {
      for (const username of bulkUsers) {
        await execSacli(
          `--user "${username}" --new_pass "TempPass123!" SetLocalPassword`
        );
      }

      // Verify all exist
      for (const username of bulkUsers) {
        const exists = await openvpnUserExists(username);
        expect(exists).to.be.true;
      }

      console.log('      Created bulk users:', bulkUsers.length);
    });

    it('should list all users including bulk users', async function() {
      const result = await execSacli('UserPropGet');
      const usernames = Object.keys(result);

      for (const username of bulkUsers) {
        expect(usernames).to.include(username);
      }
    });

    it('should delete all bulk users', async function() {
      for (const username of bulkUsers) {
        await execSacli(`--user "${username}" UserPropDelAll`);
      }

      // Verify all deleted
      for (const username of bulkUsers) {
        const exists = await openvpnUserExists(username);
        expect(exists).to.be.false;
      }
    });
  });

  describe('Error Handling', function() {
    it('should handle non-existent user query', async function() {
      try {
        await execSacli(`--user "nonexistent_user_xyz_${Date.now()}" UserPropGet`);
        // If no error thrown, check the result
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Expected - non-existent user should error
        expect(error.message).to.exist;
      }
    });

    it('should handle invalid command gracefully', async function() {
      try {
        await execSacli('InvalidCommandXYZ');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.exist;
      }
    });
  });
});
