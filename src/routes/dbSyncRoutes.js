const express = require('express');
const router = express.Router();
const dbSyncController = require('../controllers/dbSyncController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

/**
 * Database Sync Routes
 * All routes require admin authentication
 */

// Apply authentication middleware to all routes
router.use(verifyToken);
router.use(isAdmin);

/**
 * @route   POST /api/admin/db-sync/full
 * @desc    Trigger full database synchronization
 * @access  Admin only
 */
router.post('/full', dbSyncController.syncFull);

/**
 * @route   POST /api/admin/db-sync/incremental
 * @desc    Trigger incremental database synchronization
 * @access  Admin only
 */
router.post('/incremental', dbSyncController.syncIncremental);

/**
 * @route   GET /api/admin/db-sync/stats
 * @desc    Get database synchronization statistics
 * @access  Admin only
 */
router.get('/stats', dbSyncController.getSyncStats);

/**
 * @route   GET /api/admin/db-sync/test-connection
 * @desc    Test remote database connection
 * @access  Admin only
 */
router.get('/test-connection', dbSyncController.testConnection);

module.exports = router;
