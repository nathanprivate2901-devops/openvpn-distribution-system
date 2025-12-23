/**
 * LAN Network Routes
 * Handles user-defined LAN networks for VPN routing
 * 
 * @module routes/lanNetworkRoutes
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const lanNetworkController = require('../controllers/lanNetworkController');

/**
 * User Routes - Manage personal LAN networks
 */

/**
 * @route   GET /api/lan-networks
 * @desc    Get all LAN networks for authenticated user
 * @access  Private (requires authentication)
 * @returns {Object} List of user's LAN networks
 * 
 * Response format:
 * {
 *   success: true,
 *   message: "LAN networks retrieved successfully",
 *   data: {
 *     total: 2,
 *     networks: [
 *       {
 *         id: 1,
 *         user_id: 1,
 *         network_cidr: "192.168.1.0/24",
 *         network_ip: "192.168.1.0",
 *         subnet_mask: "255.255.255.0",
 *         description: "Home Network",
 *         enabled: 1,
 *         created_at: "2025-11-07T10:00:00.000Z",
 *         updated_at: "2025-11-07T10:00:00.000Z"
 *       }
 *     ]
 *   }
 * }
 */
router.get('/', verifyToken, lanNetworkController.getUserNetworks);

/**
 * @route   GET /api/lan-networks/stats
 * @desc    Get statistics for user's LAN networks
 * @access  Private (requires authentication)
 * @returns {Object} Statistics object
 * 
 * Response format:
 * {
 *   success: true,
 *   message: "Statistics retrieved successfully",
 *   data: {
 *     total_networks: 5,
 *     enabled_networks: 3,
 *     disabled_networks: 2
 *   }
 * }
 */
router.get('/stats', verifyToken, lanNetworkController.getUserStats);

/**
 * @route   GET /api/lan-networks/suggestions
 * @desc    Get common network suggestions for UI
 * @access  Private (requires authentication)
 * @returns {Object} Array of common network objects
 * 
 * Response format:
 * {
 *   success: true,
 *   message: "Network suggestions retrieved successfully",
 *   data: [
 *     { cidr: "192.168.1.0/24", description: "Home Network (192.168.1.x)" },
 *     { cidr: "10.0.0.0/24", description: "Office Network (10.0.0.x)" }
 *   ]
 * }
 */
router.get('/suggestions', verifyToken, lanNetworkController.getCommonNetworks);

/**
 * @route   GET /api/lan-networks/enabled
 * @desc    Get only enabled LAN networks for authenticated user
 * @access  Private (requires authentication)
 * @returns {Object} List of enabled networks
 */
router.get('/enabled', verifyToken, lanNetworkController.getEnabledNetworks);

/**
 * Admin Routes - View all LAN networks
 */

/**
 * @route   GET /api/lan-networks/all
 * @desc    Get all LAN networks from all users (admin only)
 * @access  Private (admin only)
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 50, max: 100)
 * @returns {Object} Paginated list of all LAN networks
 * 
 * Response format:
 * {
 *   success: true,
 *   message: "All LAN networks retrieved successfully",
 *   data: {
 *     networks: [...],
 *     total: 100,
 *     page: 1,
 *     limit: 50,
 *     totalPages: 2
 *   }
 * }
 */
router.get('/all', verifyToken, isAdmin, lanNetworkController.getAllNetworks);

/**
 * @route   GET /api/lan-networks/:id
 * @desc    Get specific LAN network by ID
 * @access  Private (requires authentication, owner or admin)
 * @param   {number} id - Network ID
 * @returns {Object} Network object
 * 
 * Response format:
 * {
 *   success: true,
 *   message: "LAN network retrieved successfully",
 *   data: {
 *     id: 1,
 *     user_id: 1,
 *     network_cidr: "192.168.1.0/24",
 *     network_ip: "192.168.1.0",
 *     subnet_mask: "255.255.255.0",
 *     description: "Home Network",
 *     enabled: 1,
 *     created_at: "2025-11-07T10:00:00.000Z",
 *     updated_at: "2025-11-07T10:00:00.000Z"
 *   }
 * }
 */
router.get('/:id', verifyToken, lanNetworkController.getNetworkById);

/**
 * @route   POST /api/lan-networks
 * @desc    Create a new LAN network
 * @access  Private (requires authentication)
 * @body    {string} network_cidr - Network in CIDR notation (e.g., "192.168.1.0/24")
 * @body    {string} description - User-friendly description (optional)
 * @returns {Object} Created network object
 * 
 * Request body:
 * {
 *   "network_cidr": "192.168.1.0/24",
 *   "description": "Home Network"
 * }
 * 
 * Response format:
 * {
 *   success: true,
 *   message: "LAN network created successfully",
 *   data: {
 *     id: 1,
 *     user_id: 1,
 *     network_cidr: "192.168.1.0/24",
 *     network_ip: "192.168.1.0",
 *     subnet_mask: "255.255.255.0",
 *     description: "Home Network",
 *     enabled: true
 *   }
 * }
 */
router.post('/', verifyToken, lanNetworkController.createNetwork);

/**
 * @route   PUT /api/lan-networks/:id
 * @desc    Update a LAN network
 * @access  Private (requires authentication, owner or admin)
 * @param   {number} id - Network ID
 * @body    {string} network_cidr - Network in CIDR notation (optional)
 * @body    {string} description - User-friendly description (optional)
 * @body    {boolean} enabled - Enable/disable status (optional)
 * @returns {Object} Success confirmation
 * 
 * Request body:
 * {
 *   "network_cidr": "192.168.2.0/24",
 *   "description": "Updated Home Network",
 *   "enabled": true
 * }
 * 
 * Response format:
 * {
 *   success: true,
 *   message: "LAN network updated successfully"
 * }
 */
router.put('/:id', verifyToken, lanNetworkController.updateNetwork);

/**
 * @route   DELETE /api/lan-networks/:id
 * @desc    Delete a LAN network
 * @access  Private (requires authentication, owner or admin)
 * @param   {number} id - Network ID
 * @returns {Object} Success confirmation
 * 
 * Response format:
 * {
 *   success: true,
 *   message: "LAN network deleted successfully"
 * }
 */
router.delete('/:id', verifyToken, lanNetworkController.deleteNetwork);

/**
 * @route   PATCH /api/lan-networks/:id/toggle
 * @desc    Toggle network enabled/disabled status
 * @access  Private (requires authentication, owner or admin)
 * @param   {number} id - Network ID
 * @returns {Object} Success confirmation with new status
 * 
 * Response format:
 * {
 *   success: true,
 *   message: "LAN network enabled successfully",
 *   data: { enabled: true }
 * }
 */
router.patch('/:id/toggle', verifyToken, lanNetworkController.toggleNetwork);

/**
 * Error handling for invalid routes
 * Catches any unmatched routes within the /api/lan-networks namespace
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'LAN network endpoint not found',
    path: req.originalUrl
  });
});

module.exports = router;
