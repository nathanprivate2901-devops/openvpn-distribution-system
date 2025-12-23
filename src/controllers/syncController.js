const openvpnUserSync = require('../services/openvpnUserSync');
const syncScheduler = require('../services/syncScheduler');
const logger = require('../utils/logger');

/**
 * Sync Controller
 * Handles OpenVPN user synchronization operations
 */

/**
 * Sync all users from MySQL to OpenVPN Access Server
 * Supports dry run mode and orphaned user deletion
 * @body {boolean} [dryRun] - Simulate sync without making changes
 * @body {boolean} [deleteOrphaned] - Delete OpenVPN users not in MySQL
 */
const syncAllUsers = async (req, res, next) => {
  try {
    const { dryRun = false, deleteOrphaned = false } = req.body;

    logger.info(`Admin ${req.user.email} initiating full user sync`, {
      dryRun,
      deleteOrphaned
    });

    // Validate options
    if (typeof dryRun !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'dryRun must be a boolean value'
      });
    }

    if (typeof deleteOrphaned !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'deleteOrphaned must be a boolean value'
      });
    }

    // Perform synchronization via scheduler (which uses openvpnUserSync)
    const results = await syncScheduler.runNow({
      dryRun,
      deleteOrphaned
    });

    // Prepare response message
    let message = dryRun ?
      'Dry run completed successfully (no changes made)' :
      'User synchronization completed successfully';

    // Add warnings if there were errors
    if (results.errors && results.errors.length > 0) {
      message += ` with ${results.errors.length} error(s)`;
    }

    logger.info(`User sync completed by admin ${req.user.email}`, {
      created: results.created?.length || 0,
      updated: results.updated?.length || 0,
      deleted: results.deleted?.length || 0,
      errors: results.errors?.length || 0,
      skipped: results.skipped?.length || 0
    });

    res.json({
      success: true,
      message,
      data: {
        dryRun,
        summary: {
          created: results.created?.length || 0,
          updated: results.updated?.length || 0,
          deleted: results.deleted?.length || 0,
          errors: results.errors?.length || 0,
          skipped: results.skipped?.length || 0
        },
        details: {
          created: results.created || [],
          updated: results.updated || [],
          deleted: results.deleted || [],
          errors: results.errors || [],
          skipped: results.skipped || []
        }
      }
    });
  } catch (error) {
    logger.error('Error in syncAllUsers:', error);

    // Provide user-friendly error messages
    if (error.message.includes('docker')) {
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to OpenVPN container. Please ensure the container is running.',
        error: error.message
      });
    }

    next(error);
  }
};

/**
 * Sync single user from MySQL to OpenVPN Access Server
 * Creates or updates the user based on existence
 * @param {string} userId - MySQL user ID
 */
const syncSingleUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId || isNaN(parseInt(userId, 10))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID. Must be a numeric value.'
      });
    }

    logger.info(`Admin ${req.user.email} syncing single user: ID ${userId}`);

    // Sync the user
    const result = await openvpnUserSync.syncSingleUser(parseInt(userId, 10));

    const message = result.action === 'created' ?
      `User ${result.username} created in OpenVPN Access Server` :
      `User ${result.username} updated in OpenVPN Access Server`;

    logger.info(`Single user sync completed by admin ${req.user.email}`, {
      userId,
      username: result.username,
      action: result.action
    });

    res.json({
      success: true,
      message,
      data: {
        userId: parseInt(userId, 10),
        username: result.username,
        action: result.action,
        tempPassword: result.tempPassword || null
      }
    });
  } catch (error) {
    logger.error('Error in syncSingleUser:', error);

    // Handle specific errors
    if (error.message.includes('not found') || error.message.includes('not verified')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('no username')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('docker')) {
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to OpenVPN container. Please ensure the container is running.',
        error: error.message
      });
    }

    next(error);
  }
};

/**
 * Remove user from OpenVPN Access Server
 * Deletes the specified user from OpenVPN
 * @param {string} username - Username to remove
 */
const removeUser = async (req, res, next) => {
  try {
    const { username } = req.params;

    // Validate username
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Invalid username. Must be a non-empty string.'
      });
    }

    const cleanUsername = username.trim();

    logger.info(`Admin ${req.user.email} removing OpenVPN user: ${cleanUsername}`);

    // Prevent admin from removing themselves (if username matches)
    if (req.user.username && req.user.username === cleanUsername) {
      return res.status(403).json({
        success: false,
        message: 'You cannot remove your own OpenVPN account'
      });
    }

    // Remove the user
    const result = await openvpnUserSync.removeUser(cleanUsername);

    logger.info(`OpenVPN user removed by admin ${req.user.email}`, {
      username: cleanUsername
    });

    res.json({
      success: true,
      message: `User ${cleanUsername} removed from OpenVPN Access Server`,
      data: {
        username: cleanUsername,
        result
      }
    });
  } catch (error) {
    logger.error('Error in removeUser:', error);

    if (error.message.includes('docker')) {
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to OpenVPN container. Please ensure the container is running.',
        error: error.message
      });
    }

    next(error);
  }
};

/**
 * Get synchronization status
 * Returns current state of MySQL and OpenVPN users for comparison
 * Also includes scheduler status and statistics
 */
const getSyncStatus = async (req, res, next) => {
  try {
    logger.info(`Admin ${req.user.email} requesting sync status`);

    // Get users from both systems
    const mysqlUsers = await openvpnUserSync.getMySQLUsers();
    const openvpnUsers = await openvpnUserSync.getOpenVPNUsers();

    // Get scheduler status
    const schedulerStatus = syncScheduler.getStatus();

    // Create maps for comparison
    const mysqlUsernames = new Set(mysqlUsers.map(u => u.username).filter(Boolean));
    const openvpnUsernamesSet = new Set(openvpnUsers);

    // Find differences
    const missingInOpenVPN = [...mysqlUsernames].filter(u => !openvpnUsernamesSet.has(u));
    const orphanedInOpenVPN = openvpnUsers.filter(u => !mysqlUsernames.has(u));
    const inSync = [...mysqlUsernames].filter(u => openvpnUsernamesSet.has(u));

    // Count users without usernames
    const usersWithoutUsername = mysqlUsers.filter(u => !u.username).length;

    const status = {
      mysql: {
        total: mysqlUsers.length,
        withUsername: mysqlUsers.length - usersWithoutUsername,
        withoutUsername: usersWithoutUsername,
        verified: mysqlUsers.filter(u => u.email_verified).length
      },
      openvpn: {
        total: openvpnUsers.length,
        users: openvpnUsers
      },
      comparison: {
        inSync: inSync.length,
        missingInOpenVPN: missingInOpenVPN.length,
        orphanedInOpenVPN: orphanedInOpenVPN.length,
        syncPercentage: mysqlUsernames.size > 0 ?
          Math.round((inSync.length / mysqlUsernames.size) * 100) : 100
      },
      details: {
        missingInOpenVPN,
        orphanedInOpenVPN,
        inSync
      },
      scheduler: {
        isRunning: schedulerStatus.scheduler.isRunning,
        isSyncing: schedulerStatus.scheduler.isSyncing,
        intervalMinutes: schedulerStatus.scheduler.intervalMinutes,
        cronExpression: schedulerStatus.scheduler.cronExpression,
        statistics: schedulerStatus.statistics,
        lastSync: schedulerStatus.lastSync,
        nextSync: schedulerStatus.nextSync,
        recentHistory: schedulerStatus.history.slice(0, 5) // Last 5 syncs
      },
      lastChecked: new Date().toISOString()
    };

    logger.info('Sync status retrieved', {
      mysqlTotal: status.mysql.total,
      openvpnTotal: status.openvpn.total,
      inSync: status.comparison.inSync,
      missing: status.comparison.missingInOpenVPN,
      orphaned: status.comparison.orphanedInOpenVPN,
      schedulerRunning: status.scheduler.isRunning
    });

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error in getSyncStatus:', error);

    if (error.message.includes('docker')) {
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to OpenVPN container. Please ensure the container is running.',
        error: error.message
      });
    }

    next(error);
  }
};

/**
 * Control scheduler (start/stop)
 * @body {string} action - 'start' or 'stop'
 */
const controlScheduler = async (req, res, next) => {
  try {
    const { action } = req.body;

    if (!action || !['start', 'stop'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "start" or "stop"'
      });
    }

    logger.info(`Admin ${req.user.email} requesting scheduler ${action}`);

    let result;
    if (action === 'start') {
      result = syncScheduler.start();
    } else {
      result = syncScheduler.stop();
    }

    if (!result) {
      return res.status(400).json({
        success: false,
        message: `Scheduler is already ${action === 'start' ? 'running' : 'stopped'}`
      });
    }

    res.json({
      success: true,
      message: `Scheduler ${action}ed successfully`,
      data: {
        isRunning: syncScheduler.isRunning,
        intervalMinutes: syncScheduler.syncIntervalMinutes
      }
    });
  } catch (error) {
    logger.error('Error in controlScheduler:', error);
    next(error);
  }
};

/**
 * Update scheduler interval
 * @body {number} intervalMinutes - New interval in minutes (1-60)
 */
const updateInterval = async (req, res, next) => {
  try {
    const { intervalMinutes } = req.body;

    if (!intervalMinutes || typeof intervalMinutes !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Invalid intervalMinutes. Must be a number between 1 and 60'
      });
    }

    if (intervalMinutes < 1 || intervalMinutes > 60) {
      return res.status(400).json({
        success: false,
        message: 'Interval must be between 1 and 60 minutes'
      });
    }

    logger.info(`Admin ${req.user.email} updating scheduler interval to ${intervalMinutes} minutes`);

    const result = syncScheduler.updateInterval(intervalMinutes);

    if (!result) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update scheduler interval'
      });
    }

    res.json({
      success: true,
      message: `Scheduler interval updated to ${intervalMinutes} minutes`,
      data: {
        intervalMinutes: syncScheduler.syncIntervalMinutes,
        cronExpression: syncScheduler.cronExpression,
        isRunning: syncScheduler.isRunning
      }
    });
  } catch (error) {
    logger.error('Error in updateInterval:', error);
    next(error);
  }
};

module.exports = {
  syncAllUsers,
  syncSingleUser,
  removeUser,
  getSyncStatus,
  controlScheduler,
  updateInterval
};
