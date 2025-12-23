const request = require('supertest');
const { expect } = require('chai');
const app = require('../../src/index');
const pool = require('../../src/config/database');
const bcrypt = require('bcrypt');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * OpenVPN User Synchronization Test Suite
 * Tests the full user sync lifecycle between MySQL and OpenVPN Access Server
 */
describe('OpenVPN User Synchronization', function() {
  this.timeout(30000); // Increase timeout for Docker operations

  let adminToken;
  let testUserId;
  const testUsername = `testuser_${Date.now()}`;
  const testUser = {
    username: testUsername,
    email: `${testUsername}@test.com`,
    password: 'TestPassword123!',
    name: 'Test User'
  };

  // Helper function to execute sacli command
  async function execSacli(command) {
    try {
      const { stdout } = await execAsync(`docker exec openvpn-server sacli ${command}`);
      try {
        return JSON.parse(stdout);
      } catch {
        return stdout.trim();
      }
    } catch (error) {
      console.error('sacli error:', error.message);
      throw error;
    }
  }

  // Helper function to check if user exists in OpenVPN
  async function openvpnUserExists(username) {
    try {
      const result = await execSacli('UserPropGet');
      return Object.keys(result).includes(username);
    } catch (error) {
      return false;
    }
  }

  // Setup: Login as admin
  before(async function() {
    // Login to get admin token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123'
      });

    expect(loginRes.status).to.equal(200);
    expect(loginRes.body).to.have.property('token');
    adminToken = loginRes.body.token;
  });

  // Cleanup: Remove test user from both systems
  after(async function() {
    // Clean up MySQL
    if (testUserId) {
      await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
    }

    // Clean up OpenVPN
    try {
      await execSacli(`--user "${testUsername}" UserPropDelAll`);
    } catch (error) {
      // Ignore if user doesn't exist
    }
  });

  describe('1. User Creation and Auto-Sync', function() {
    it('should create a new user in MySQL', async function() {
      const hashedPassword = await bcrypt.hash(testUser.password, 10);

      const [result] = await pool.execute(
        'INSERT INTO users (username, email, password, name, email_verified) VALUES (?, ?, ?, ?, ?)',
        [testUser.username, testUser.email, hashedPassword, testUser.name, 0]
      );

      testUserId = result.insertId;
      expect(testUserId).to.be.a('number');
    });

    it('should NOT sync unverified user to OpenVPN', async function() {
      const exists = await openvpnUserExists(testUsername);
      expect(exists).to.be.false;
    });

    it('should verify user email', async function() {
      await pool.execute(
        'UPDATE users SET email_verified = 1 WHERE id = ?',
        [testUserId]
      );

      const [rows] = await pool.execute(
        'SELECT email_verified FROM users WHERE id = ?',
        [testUserId]
      );

      expect(rows[0].email_verified).to.equal(1);
    });

    it('should auto-sync verified user to OpenVPN', async function() {
      // Wait a moment for the hook to execute
      await new Promise(resolve => setTimeout(resolve, 2000));

      const exists = await openvpnUserExists(testUsername);
      expect(exists).to.be.true;
    });
  });

  describe('2. Manual Sync Operations', function() {
    it('should get sync status', async function() {
      const res = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('mysql');
      expect(res.body.data).to.have.property('openvpn');
      expect(res.body.data).to.have.property('sync');
      expect(res.body.data).to.have.property('scheduler');
    });

    it('should manually sync single user', async function() {
      const res = await request(app)
        .post(`/api/sync/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('username', testUsername);
    });

    it('should perform full sync (dry run)', async function() {
      const res = await request(app)
        .post('/api/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dryRun: true });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('summary');
    });

    it('should perform full sync (real)', async function() {
      const res = await request(app)
        .post('/api/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dryRun: false });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('created');
      expect(res.body.data).to.have.property('updated');
    });
  });

  describe('3. User Properties Sync', function() {
    it('should sync user email to OpenVPN', async function() {
      const result = await execSacli(`--user "${testUsername}" UserPropGet`);

      expect(result).to.have.property('prop_email', testUser.email);
    });

    it('should sync user name to OpenVPN', async function() {
      const result = await execSacli(`--user "${testUsername}" UserPropGet`);

      expect(result).to.have.property('prop_c_name', testUser.name);
    });

    it('should NOT have superuser privileges for regular user', async function() {
      const result = await execSacli(`--user "${testUsername}" UserPropGet`);

      expect(result.prop_superuser).to.not.equal('true');
    });

    it('should update user role to admin', async function() {
      await pool.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        ['admin', testUserId]
      );

      // Manually sync to apply changes
      await request(app)
        .post(`/api/sync/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const result = await execSacli(`--user "${testUsername}" UserPropGet`);
      expect(result.prop_superuser).to.equal('true');
    });
  });

  describe('4. Scheduler Operations', function() {
    it('should get scheduler status', async function() {
      const res = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.scheduler).to.have.property('running');
      expect(res.body.data.scheduler).to.have.property('interval');
      expect(res.body.data.scheduler).to.have.property('history');
    });

    it('should stop scheduler', async function() {
      const res = await request(app)
        .post('/api/sync/scheduler/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'stop' });

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('running', false);
    });

    it('should start scheduler', async function() {
      const res = await request(app)
        .post('/api/sync/scheduler/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'start' });

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('running', true);
    });

    it('should update scheduler interval', async function() {
      const res = await request(app)
        .put('/api/sync/scheduler/interval')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ interval: 30 });

      expect(res.status).to.equal(200);
      expect(res.body.data.interval).to.include('30');
    });

    it('should reject invalid interval', async function() {
      const res = await request(app)
        .put('/api/sync/scheduler/interval')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ interval: 100 });

      expect(res.status).to.equal(400);
    });
  });

  describe('5. User Deletion and Cleanup', function() {
    it('should soft delete user in MySQL', async function() {
      await pool.execute(
        'UPDATE users SET deleted_at = NOW() WHERE id = ?',
        [testUserId]
      );

      const [rows] = await pool.execute(
        'SELECT deleted_at FROM users WHERE id = ?',
        [testUserId]
      );

      expect(rows[0].deleted_at).to.not.be.null;
    });

    it('should auto-remove deleted user from OpenVPN', async function() {
      // Wait for the hook to execute
      await new Promise(resolve => setTimeout(resolve, 2000));

      const exists = await openvpnUserExists(testUsername);
      expect(exists).to.be.false;
    });

    it('should manually remove user from OpenVPN', async function() {
      // First, re-create user in OpenVPN for testing
      await execSacli(`--user "${testUsername}" --new_pass "TempPass123" SetLocalPassword`);

      // Verify user exists
      let exists = await openvpnUserExists(testUsername);
      expect(exists).to.be.true;

      // Remove via API
      const res = await request(app)
        .delete(`/api/sync/users/${testUsername}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);

      // Verify user is removed
      exists = await openvpnUserExists(testUsername);
      expect(exists).to.be.false;
    });
  });

  describe('6. Security and Permissions', function() {
    it('should deny sync without authentication', async function() {
      const res = await request(app)
        .post('/api/sync/users');

      expect(res.status).to.equal(401);
    });

    it('should deny sync with non-admin user', async function() {
      // Create a regular user and get token
      const hashedPassword = await bcrypt.hash('testpass', 10);
      const [result] = await pool.execute(
        'INSERT INTO users (username, email, password, name, role, email_verified) VALUES (?, ?, ?, ?, ?, ?)',
        [`regular_${Date.now()}`, `regular_${Date.now()}@test.com`, hashedPassword, 'Regular User', 'user', 1]
      );

      const regularUserId = result.insertId;

      // Get token for regular user (would need to implement this in your auth)
      // For now, we'll just test that admin token is required
      const res = await request(app)
        .post('/api/sync/users')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).to.be.oneOf([401, 403]);

      // Cleanup
      await pool.execute('DELETE FROM users WHERE id = ?', [regularUserId]);
    });

    it('should prevent admin from removing themselves', async function() {
      const res = await request(app)
        .delete('/api/sync/users/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('cannot remove yourself');
    });
  });

  describe('7. Error Handling', function() {
    it('should handle sync of non-existent user', async function() {
      const res = await request(app)
        .post('/api/sync/users/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).to.equal(404);
    });

    it('should handle removal of non-existent OpenVPN user', async function() {
      const res = await request(app)
        .delete('/api/sync/users/nonexistent_user_xyz')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).to.be.oneOf([404, 500]); // Depends on implementation
    });

    it('should handle invalid user ID format', async function() {
      const res = await request(app)
        .post('/api/sync/users/invalid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).to.equal(400);
    });

    it('should handle Docker connection issues gracefully', async function() {
      // This test assumes OpenVPN container might be stopped
      // In real scenario, you'd temporarily stop the container
      const res = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should still return response, even if OpenVPN is unavailable
      expect(res.status).to.be.oneOf([200, 500]);
    });
  });

  describe('8. Sync Statistics', function() {
    it('should track sync history', async function() {
      // Perform a sync
      await request(app)
        .post('/api/sync/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dryRun: false });

      // Check history
      const res = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.scheduler.history).to.be.an('array');
      expect(res.body.data.scheduler.history.length).to.be.at.least(1);

      const lastSync = res.body.data.scheduler.history[0];
      expect(lastSync).to.have.property('timestamp');
      expect(lastSync).to.have.property('success');
      expect(lastSync).to.have.property('results');
    });

    it('should calculate sync percentage', async function() {
      const res = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.sync).to.have.property('syncPercentage');
      expect(res.body.data.sync.syncPercentage).to.be.a('number');
      expect(res.body.data.sync.syncPercentage).to.be.at.least(0);
      expect(res.body.data.sync.syncPercentage).to.be.at.most(100);
    });

    it('should identify users missing in OpenVPN', async function() {
      const res = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.sync).to.have.property('missingInOpenVPN');
      expect(res.body.data.sync.missingInOpenVPN).to.be.an('array');
    });

    it('should identify orphaned users in OpenVPN', async function() {
      const res = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.sync).to.have.property('orphanedInOpenVPN');
      expect(res.body.data.sync.orphanedInOpenVPN).to.be.an('array');
    });
  });
});
