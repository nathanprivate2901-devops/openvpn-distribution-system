const { expect } = require('chai');
const sinon = require('sinon');
const syncScheduler = require('../../src/services/syncScheduler');
const openvpnUserSync = require('../../src/services/openvpnUserSync');

/**
 * Sync Scheduler Unit Tests
 * Tests the scheduler service independently
 */
describe('Sync Scheduler Service', function() {
  this.timeout(10000);

  let syncUsersStub;

  beforeEach(function() {
    // Stub the sync operation
    syncUsersStub = sinon.stub(openvpnUserSync, 'syncUsers').resolves({
      created: [],
      updated: ['admin'],
      deleted: [],
      errors: [],
      skipped: []
    });
  });

  afterEach(function() {
    syncUsersStub.restore();
  });

  describe('Scheduler Control', function() {
    it('should start scheduler', function() {
      syncScheduler.stop(); // Ensure it's stopped first
      syncScheduler.start();

      const status = syncScheduler.getStatus();
      expect(status.running).to.be.true;
    });

    it('should stop scheduler', function() {
      syncScheduler.start(); // Ensure it's running first
      syncScheduler.stop();

      const status = syncScheduler.getStatus();
      expect(status.running).to.be.false;
    });

    it('should not start if already running', function() {
      syncScheduler.start();
      const firstStart = syncScheduler.getStatus().running;

      syncScheduler.start(); // Try to start again
      const secondStart = syncScheduler.getStatus().running;

      expect(firstStart).to.be.true;
      expect(secondStart).to.be.true;
    });

    it('should not stop if already stopped', function() {
      syncScheduler.stop();
      const firstStop = syncScheduler.getStatus().running;

      syncScheduler.stop(); // Try to stop again
      const secondStop = syncScheduler.getStatus().running;

      expect(firstStop).to.be.false;
      expect(secondStop).to.be.false;
    });
  });

  describe('Interval Management', function() {
    it('should update interval', function() {
      syncScheduler.updateInterval(30);

      const status = syncScheduler.getStatus();
      expect(status.interval).to.equal('30 minutes');
    });

    it('should reject interval below minimum', function() {
      expect(() => syncScheduler.updateInterval(0)).to.throw();
    });

    it('should reject interval above maximum', function() {
      expect(() => syncScheduler.updateInterval(100)).to.throw();
    });

    it('should restart scheduler with new interval', function() {
      syncScheduler.start();
      syncScheduler.updateInterval(20);

      const status = syncScheduler.getStatus();
      expect(status.running).to.be.true;
      expect(status.interval).to.equal('20 minutes');
    });
  });

  describe('Manual Sync', function() {
    it('should run manual sync', async function() {
      const result = await syncScheduler.runNow();

      expect(result).to.have.property('success', true);
      expect(syncUsersStub.calledOnce).to.be.true;
    });

    it('should prevent concurrent syncs', async function() {
      // Start a sync
      const sync1Promise = syncScheduler.runNow();

      // Try to start another immediately
      const sync2Promise = syncScheduler.runNow();

      const [result1, result2] = await Promise.all([sync1Promise, sync2Promise]);

      // One should succeed, one should be skipped
      const successCount = [result1.success, result2.success].filter(Boolean).length;
      expect(successCount).to.equal(1);

      // Only one actual sync should have been called
      expect(syncUsersStub.callCount).to.equal(1);
    });

    it('should update last sync time after manual sync', async function() {
      const beforeSync = syncScheduler.getStatus().lastSync;

      await syncScheduler.runNow();

      const afterSync = syncScheduler.getStatus().lastSync;
      expect(afterSync).to.not.equal(beforeSync);
    });
  });

  describe('Status and History', function() {
    it('should return current status', function() {
      const status = syncScheduler.getStatus();

      expect(status).to.have.property('running');
      expect(status).to.have.property('interval');
      expect(status).to.have.property('lastSync');
      expect(status).to.have.property('nextSync');
      expect(status).to.have.property('history');
      expect(status).to.have.property('stats');
    });

    it('should track sync history', async function() {
      const beforeHistory = syncScheduler.getStatus().history.length;

      await syncScheduler.runNow();

      const afterHistory = syncScheduler.getStatus().history.length;
      expect(afterHistory).to.be.greaterThan(beforeHistory);
    });

    it('should limit history to 10 items', async function() {
      // Run multiple syncs
      for (let i = 0; i < 15; i++) {
        await syncScheduler.runNow();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const history = syncScheduler.getStatus().history;
      expect(history.length).to.be.at.most(10);
    });

    it('should calculate success rate', async function() {
      // Clear history first
      syncScheduler.stop();
      syncScheduler.start();

      // Run successful sync
      await syncScheduler.runNow();

      const stats = syncScheduler.getStatus().stats;
      expect(stats).to.have.property('successRate');
      expect(stats.successRate).to.equal(100);
    });

    it('should track failed syncs', async function() {
      // Make sync fail
      syncUsersStub.rejects(new Error('Sync failed'));

      try {
        await syncScheduler.runNow();
      } catch (error) {
        // Expected to fail
      }

      const stats = syncScheduler.getStatus().stats;
      expect(stats.totalSyncs).to.be.at.least(1);
      expect(stats.failedSyncs).to.be.at.least(1);
    });
  });

  describe('Error Handling', function() {
    it('should handle sync errors gracefully', async function() {
      syncUsersStub.rejects(new Error('Docker not available'));

      const result = await syncScheduler.runNow();

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
    });

    it('should continue scheduler after error', async function() {
      syncUsersStub.rejects(new Error('Temporary error'));

      await syncScheduler.runNow();

      // Scheduler should still be running
      const status = syncScheduler.getStatus();
      expect(status.running).to.be.true;
    });

    it('should log errors to history', async function() {
      syncUsersStub.rejects(new Error('Test error'));

      try {
        await syncScheduler.runNow();
      } catch (error) {
        // Expected
      }

      const history = syncScheduler.getStatus().history;
      const lastSync = history[0];

      expect(lastSync.success).to.be.false;
      expect(lastSync).to.have.property('error');
    });
  });

  describe('Next Sync Calculation', function() {
    it('should calculate next sync time', function() {
      syncScheduler.updateInterval(15);

      const status = syncScheduler.getStatus();
      expect(status.nextSync).to.be.a('string');

      const nextSyncTime = new Date(status.nextSync);
      const now = new Date();

      expect(nextSyncTime.getTime()).to.be.greaterThan(now.getTime());
    });

    it('should update next sync after manual run', async function() {
      const beforeNextSync = syncScheduler.getStatus().nextSync;

      await syncScheduler.runNow();

      const afterNextSync = syncScheduler.getStatus().nextSync;
      expect(afterNextSync).to.not.equal(beforeNextSync);
    });
  });

  describe('Statistics', function() {
    it('should count total users synced', async function() {
      syncUsersStub.resolves({
        created: ['user1', 'user2'],
        updated: ['user3'],
        deleted: [],
        errors: [],
        skipped: []
      });

      await syncScheduler.runNow();

      const stats = syncScheduler.getStatus().stats;
      expect(stats.totalUsersCreated).to.be.at.least(2);
      expect(stats.totalUsersUpdated).to.be.at.least(1);
    });

    it('should count total errors', async function() {
      syncUsersStub.resolves({
        created: [],
        updated: [],
        deleted: [],
        errors: [{ username: 'user1', error: 'Failed' }],
        skipped: []
      });

      await syncScheduler.runNow();

      const stats = syncScheduler.getStatus().stats;
      expect(stats.totalErrors).to.be.at.least(1);
    });

    it('should calculate average sync time', async function() {
      await syncScheduler.runNow();

      const stats = syncScheduler.getStatus().stats;
      expect(stats).to.have.property('averageSyncTime');
      expect(stats.averageSyncTime).to.be.a('number');
    });
  });
});
