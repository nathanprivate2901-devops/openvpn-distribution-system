const databaseSyncService = require('../services/databaseSync');
const logger = require('../utils/logger');

/**
 * Database Sync Controller
 * Handles database synchronization operations between local and remote MySQL databases
 */

/**
 * Trigger full database synchronization
 * @route POST /api/admin/db-sync/full
 * @access Admin only
 */
exports.syncFull = async (req, res, next) => {
  try {
    logger.info(`Admin ${req.user.email} triggered full database sync`);

    const result = await databaseSyncService.syncFull();

    if (result.success) {
      res.json({
        success: true,
        message: 'Full database synchronization completed successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Full database synchronization failed',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error in syncFull controller:', error);
    next(error);
  }
};

/**
 * Trigger incremental database synchronization
 * @route POST /api/admin/db-sync/incremental
 * @access Admin only
 */
exports.syncIncremental = async (req, res, next) => {
  try {
    logger.info(`Admin ${req.user.email} triggered incremental database sync`);

    const result = await databaseSyncService.syncIncremental();

    if (result.success) {
      res.json({
        success: true,
        message: 'Incremental database synchronization completed successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'Incremental database synchronization failed',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error in syncIncremental controller:', error);
    next(error);
  }
};

/**
 * Get database synchronization statistics
 * @route GET /api/admin/db-sync/stats
 * @access Admin only
 */
exports.getSyncStats = async (req, res, next) => {
  try {
    const stats = databaseSyncService.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error in getSyncStats controller:', error);
    next(error);
  }
};

/**
 * Test remote database connection
 * @route GET /api/admin/db-sync/test-connection
 * @access Admin only
 */
exports.testConnection = async (req, res, next) => {
  try {
    logger.info(`Admin ${req.user.email} testing remote database connection`);

    const canConnect = await databaseSyncService.testConnections();

    res.json({
      success: true,
      message: 'Remote database connection successful',
      data: {
        connected: canConnect
      }
    });
  } catch (error) {
    logger.error('Error in testConnection controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to connect to remote database',
      error: error.message
    });
  }
};
