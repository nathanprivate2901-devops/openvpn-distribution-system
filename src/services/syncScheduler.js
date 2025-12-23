/**
 * OpenVPN User Sync Scheduler Service
 *
 * Automatically synchronizes users between MySQL and OpenVPN Access Server
 * at configurable intervals using node-cron.
 *
 * Features:
 * - Periodic sync execution with configurable interval
 * - Manual sync trigger via runNow()
 * - Sync status tracking and history
 * - Comprehensive error handling and logging
 * - Start/stop control for operational flexibility
 *
 * @module services/syncScheduler
 */

const cron = require('node-cron');
const openvpnUserSync = require('./openvpnUserSync');
const logger = require('../utils/logger');

/**
 * Sync Scheduler Class
 * Manages automated synchronization of users between MySQL and OpenVPN AS
 */
class SyncScheduler {
  constructor() {
    // Cron job instance
    this.scheduledTask = null;

    // Scheduler state
    this.isRunning = false;
    this.isSyncing = false;

    // Sync interval configuration (default: 15 minutes)
    this.syncIntervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES) || 15;

    // Validate interval range (1-60 minutes)
    if (this.syncIntervalMinutes < 1 || this.syncIntervalMinutes > 60) {
      logger.warn(`Invalid SYNC_INTERVAL_MINUTES: ${this.syncIntervalMinutes}. Using default: 15`);
      this.syncIntervalMinutes = 15;
    }

    // Generate cron expression for the interval
    this.cronExpression = `*/${this.syncIntervalMinutes} * * * *`;

    // Sync history and status tracking
    this.lastSyncTime = null;
    this.lastSyncResult = null;
    this.lastSyncError = null;
    this.syncCount = 0;
    this.successfulSyncs = 0;
    this.failedSyncs = 0;

    // Sync history (keep last 10 sync results)
    this.syncHistory = [];
    this.maxHistorySize = 10;

    logger.info('Sync Scheduler initialized', {
      intervalMinutes: this.syncIntervalMinutes,
      cronExpression: this.cronExpression
    });
  }

  /**
   * Start the scheduled synchronization
   * Creates and starts a cron job based on the configured interval
   *
   * @returns {boolean} Success status
   */
  start() {
    if (this.isRunning) {
      logger.warn('Sync scheduler is already running');
      return false;
    }

    try {
      // Validate cron expression
      if (!cron.validate(this.cronExpression)) {
        logger.error(`Invalid cron expression: ${this.cronExpression}`);
        return false;
      }

      // Create scheduled task
      this.scheduledTask = cron.schedule(this.cronExpression, async () => {
        await this.executeSync();
      }, {
        scheduled: true,
        timezone: process.env.TZ || 'UTC'
      });

      this.isRunning = true;

      logger.info('Sync scheduler started successfully', {
        intervalMinutes: this.syncIntervalMinutes,
        cronExpression: this.cronExpression,
        nextSyncIn: `${this.syncIntervalMinutes} minutes`
      });

      return true;
    } catch (error) {
      logger.error('Failed to start sync scheduler:', error);
      this.isRunning = false;
      return false;
    }
  }

  /**
   * Stop the scheduled synchronization
   * Gracefully stops the cron job
   *
   * @returns {boolean} Success status
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Sync scheduler is not running');
      return false;
    }

    try {
      if (this.scheduledTask) {
        this.scheduledTask.stop();
        this.scheduledTask = null;
      }

      this.isRunning = false;

      logger.info('Sync scheduler stopped successfully');

      return true;
    } catch (error) {
      logger.error('Failed to stop sync scheduler:', error);
      return false;
    }
  }

  /**
   * Execute synchronization task
   * Internal method called by cron scheduler or manual trigger
   *
   * @private
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync results
   */
  async executeSync(options = {}) {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      logger.warn('Sync already in progress, skipping this execution');
      return {
        skipped: true,
        reason: 'Sync already in progress'
      };
    }

    this.isSyncing = true;
    const syncStartTime = Date.now();

    logger.info('Starting scheduled user synchronization...', {
      syncCount: this.syncCount + 1,
      trigger: options.manual ? 'manual' : 'scheduled'
    });

    try {
      // Execute user synchronization
      const syncResult = await openvpnUserSync.syncUsers({
        dryRun: options.dryRun || false,
        deleteOrphaned: options.deleteOrphaned || false
      });

      const syncDuration = Date.now() - syncStartTime;

      // Update sync statistics
      this.syncCount++;
      this.successfulSyncs++;
      this.lastSyncTime = new Date();
      this.lastSyncResult = syncResult;
      this.lastSyncError = null;

      // Add to history
      this.addToHistory({
        timestamp: this.lastSyncTime,
        success: true,
        duration: syncDuration,
        result: syncResult,
        trigger: options.manual ? 'manual' : 'scheduled'
      });

      logger.info('User synchronization completed successfully', {
        duration: `${syncDuration}ms`,
        created: syncResult.created.length,
        updated: syncResult.updated.length,
        deleted: syncResult.deleted.length,
        errors: syncResult.errors.length,
        skipped: syncResult.skipped.length
      });

      return syncResult;
    } catch (error) {
      const syncDuration = Date.now() - syncStartTime;

      // Update error statistics
      this.syncCount++;
      this.failedSyncs++;
      this.lastSyncTime = new Date();
      this.lastSyncError = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
      };

      // Add to history
      this.addToHistory({
        timestamp: this.lastSyncTime,
        success: false,
        duration: syncDuration,
        error: {
          message: error.message,
          stack: error.stack
        },
        trigger: options.manual ? 'manual' : 'scheduled'
      });

      logger.error('User synchronization failed:', {
        error: error.message,
        duration: `${syncDuration}ms`
      });

      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Run synchronization immediately (manual trigger)
   * Allows on-demand sync execution outside of scheduled times
   *
   * @param {Object} options - Sync options
   * @param {boolean} [options.dryRun=false] - If true, don't make changes
   * @param {boolean} [options.deleteOrphaned=false] - If true, delete OpenVPN users not in MySQL
   * @returns {Promise<Object>} Sync results
   */
  async runNow(options = {}) {
    logger.info('Manual sync triggered');

    return await this.executeSync({
      ...options,
      manual: true
    });
  }

  /**
   * Get current scheduler status and statistics
   *
   * @returns {Object} Scheduler status
   */
  getStatus() {
    const status = {
      scheduler: {
        isRunning: this.isRunning,
        isSyncing: this.isSyncing,
        intervalMinutes: this.syncIntervalMinutes,
        cronExpression: this.cronExpression
      },
      statistics: {
        totalSyncs: this.syncCount,
        successfulSyncs: this.successfulSyncs,
        failedSyncs: this.failedSyncs,
        successRate: this.syncCount > 0
          ? ((this.successfulSyncs / this.syncCount) * 100).toFixed(2) + '%'
          : '0%'
      },
      lastSync: {
        timestamp: this.lastSyncTime,
        result: this.lastSyncResult,
        error: this.lastSyncError
      },
      nextSync: this.isRunning && this.scheduledTask
        ? this.calculateNextSyncTime()
        : null,
      history: this.syncHistory
    };

    return status;
  }

  /**
   * Calculate next scheduled sync time
   *
   * @private
   * @returns {Date|null} Next sync time
   */
  calculateNextSyncTime() {
    if (!this.lastSyncTime) {
      // If never synced, next sync is within the interval
      const next = new Date();
      next.setMinutes(next.getMinutes() + this.syncIntervalMinutes);
      return next;
    }

    // Calculate next sync based on last sync time
    const next = new Date(this.lastSyncTime);
    next.setMinutes(next.getMinutes() + this.syncIntervalMinutes);

    // If next sync is in the past, calculate from now
    const now = new Date();
    if (next < now) {
      next.setTime(now.getTime());
      next.setMinutes(next.getMinutes() + this.syncIntervalMinutes);
    }

    return next;
  }

  /**
   * Add sync result to history
   * Maintains a rolling history of sync executions
   *
   * @private
   * @param {Object} historyEntry - Sync history entry
   */
  addToHistory(historyEntry) {
    this.syncHistory.unshift(historyEntry);

    // Trim history to max size
    if (this.syncHistory.length > this.maxHistorySize) {
      this.syncHistory = this.syncHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Reset scheduler statistics
   * Useful for testing or after maintenance
   *
   * @returns {boolean} Success status
   */
  resetStats() {
    try {
      this.syncCount = 0;
      this.successfulSyncs = 0;
      this.failedSyncs = 0;
      this.syncHistory = [];
      this.lastSyncResult = null;
      this.lastSyncError = null;

      logger.info('Scheduler statistics reset');

      return true;
    } catch (error) {
      logger.error('Failed to reset scheduler statistics:', error);
      return false;
    }
  }

  /**
   * Update sync interval
   * Reconfigures the scheduler with a new interval
   *
   * @param {number} minutes - New interval in minutes (1-60)
   * @returns {boolean} Success status
   */
  updateInterval(minutes) {
    if (minutes < 1 || minutes > 60) {
      logger.error(`Invalid interval: ${minutes}. Must be between 1 and 60 minutes`);
      return false;
    }

    const wasRunning = this.isRunning;

    try {
      // Stop current scheduler if running
      if (this.isRunning) {
        this.stop();
      }

      // Update interval and cron expression
      this.syncIntervalMinutes = minutes;
      this.cronExpression = `*/${minutes} * * * *`;

      logger.info('Sync interval updated', {
        newInterval: minutes,
        cronExpression: this.cronExpression
      });

      // Restart scheduler if it was running
      if (wasRunning) {
        this.start();
      }

      return true;
    } catch (error) {
      logger.error('Failed to update sync interval:', error);
      return false;
    }
  }
}

// Export singleton instance
const syncScheduler = new SyncScheduler();

module.exports = syncScheduler;
