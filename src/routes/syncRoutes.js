const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

/**
 * Sync Routes
 * Handles OpenVPN user synchronization operations and scheduler control
 * All routes require authentication and admin role
 * Base path: /api/sync
 */

// Apply authentication and admin check to all routes
router.use(verifyToken);
router.use(isAdmin);

/**
 * @route   POST /api/sync/users
 * @desc    Sync all users from MySQL to OpenVPN Access Server (manual trigger)
 * @access  Admin only
 * @body    {boolean} [dryRun] - If true, simulate sync without making changes
 * @body    {boolean} [deleteOrphaned] - If true, delete OpenVPN users not in MySQL
 * @returns {Object} Sync results with created, updated, deleted counts
 */
router.post('/users', syncController.syncAllUsers);

/**
 * @route   POST /api/sync/users/:userId
 * @desc    Sync single user from MySQL to OpenVPN Access Server
 * @access  Admin only
 * @param   {string} userId - MySQL user ID to sync
 * @returns {Object} Sync result with action (created/updated) and username
 */
router.post('/users/:userId', syncController.syncSingleUser);

/**
 * @route   DELETE /api/sync/users/:username
 * @desc    Remove user from OpenVPN Access Server
 * @access  Admin only
 * @param   {string} username - Username to remove from OpenVPN
 * @returns {Object} Deletion result
 */
router.delete('/users/:username', syncController.removeUser);

/**
 * @route   GET /api/sync/status
 * @desc    Get synchronization status, user comparison, and scheduler statistics
 * @access  Admin only
 * @returns {Object} Comprehensive sync status including:
 *          - MySQL and OpenVPN user counts
 *          - User comparison (in sync, missing, orphaned)
 *          - Scheduler status and statistics
 *          - Recent sync history
 */
router.get('/status', syncController.getSyncStatus);

/**
 * @route   POST /api/sync/scheduler/control
 * @desc    Start or stop the automatic sync scheduler
 * @access  Admin only
 * @body    {string} action - 'start' or 'stop'
 * @returns {Object} Scheduler status after action
 */
router.post('/scheduler/control', syncController.controlScheduler);

/**
 * @route   PUT /api/sync/scheduler/interval
 * @desc    Update the sync scheduler interval
 * @access  Admin only
 * @body    {number} intervalMinutes - New interval in minutes (1-60)
 * @returns {Object} Updated scheduler configuration
 */
router.put('/scheduler/interval', syncController.updateInterval);

module.exports = router;
