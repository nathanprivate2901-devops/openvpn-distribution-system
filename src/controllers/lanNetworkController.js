const UserLanNetwork = require('../models/UserLanNetwork');
const logger = require('../utils/logger');
const openvpnClientConnect = require('../services/openvpnClientConnect');

/**
 * LAN Network Controller
 * Handles CRUD operations for user-defined LAN networks
 */

/**
 * Get all LAN networks for the authenticated user
 * GET /api/lan-networks
 */
exports.getUserNetworks = async (req, res) => {
  try {
    const userId = req.user.id;
    const networks = await UserLanNetwork.findByUserId(userId);

    // Ensure networks is an array
    const networkList = Array.isArray(networks) ? networks : [];

    res.status(200).json({
      success: true,
      message: 'LAN networks retrieved successfully',
      data: {
        total: networkList.length,
        networks: networkList
      }
    });
  } catch (error) {
    logger.error('Error fetching user LAN networks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve LAN networks',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get only enabled LAN networks for the authenticated user
 * GET /api/lan-networks/enabled
 */
exports.getEnabledNetworks = async (req, res) => {
  try {
    const userId = req.user.id;
    const networks = await UserLanNetwork.findByUserId(userId, true); // true = enabledOnly

    // Ensure networks is an array
    const networkList = Array.isArray(networks) ? networks : [];

    res.status(200).json({
      success: true,
      message: 'Enabled LAN networks retrieved successfully',
      data: {
        total: networkList.length,
        networks: networkList
      }
    });
  } catch (error) {
    logger.error('Error fetching enabled LAN networks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve enabled LAN networks',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get a specific LAN network by ID
 * GET /api/lan-networks/:id
 */
exports.getNetworkById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const network = await UserLanNetwork.findById(id);

    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'LAN network not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && network.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'LAN network retrieved successfully',
      data: network
    });
  } catch (error) {
    logger.error('Error fetching LAN network:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve LAN network',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create a new LAN network
 * POST /api/lan-networks
 */
exports.createNetwork = async (req, res) => {
  try {
    const userId = req.user.id;
    const { network_cidr, description } = req.body;

    // Validate CIDR notation
    if (!UserLanNetwork.isValidCIDR(network_cidr)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network CIDR notation. Expected format: 192.168.1.0/24'
      });
    }

    // Check for private network ranges (optional security check)
    const isPrivate = isPrivateNetwork(network_cidr);
    if (!isPrivate) {
      logger.warn(`User ${userId} attempting to add non-private network: ${network_cidr}`);
      return res.status(400).json({
        success: false,
        message: 'Only private network ranges are allowed (10.x.x.x, 172.16-31.x.x, 192.168.x.x)'
      });
    }

    // Create network
    const network = await UserLanNetwork.create(userId, network_cidr, description);

    logger.info(`User ${userId} created LAN network: ${network_cidr}`);

    // Update OpenVPN server routing (async, don't wait)
    openvpnClientConnect.updateServerRouting().catch(err => {
      logger.error('Failed to update OpenVPN routing after network creation:', err);
    });

    res.status(201).json({
      success: true,
      message: 'LAN network created successfully',
      data: network
    });
  } catch (error) {
    // Handle duplicate network error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'This network already exists for your account'
      });
    }

    logger.error('Error creating LAN network:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create LAN network',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update a LAN network
 * PUT /api/lan-networks/:id
 */
exports.updateNetwork = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { network_cidr, description, enabled } = req.body;

    // Check if network exists and belongs to user
    const network = await UserLanNetwork.findById(id);
    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'LAN network not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && network.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate new CIDR if provided
    if (network_cidr && !UserLanNetwork.isValidCIDR(network_cidr)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network CIDR notation'
      });
    }

    // Check for private network if CIDR is being updated
    if (network_cidr && !isPrivateNetwork(network_cidr)) {
      return res.status(400).json({
        success: false,
        message: 'Only private network ranges are allowed'
      });
    }

    // Build updates object
    const updates = {};
    if (network_cidr !== undefined) updates.network_cidr = network_cidr;
    if (description !== undefined) updates.description = description;
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;

    // Update network
    const success = await UserLanNetwork.update(id, updates);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    logger.info(`User ${userId} updated LAN network ${id}`);

    // Update OpenVPN server routing if CIDR or enabled status changed (async, don't wait)
    if (updates.network_cidr !== undefined || updates.enabled !== undefined) {
      openvpnClientConnect.updateServerRouting().catch(err => {
        logger.error('Failed to update OpenVPN routing after network update:', err);
      });
    }

    res.status(200).json({
      success: true,
      message: 'LAN network updated successfully'
    });
  } catch (error) {
    logger.error('Error updating LAN network:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update LAN network',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a LAN network
 * DELETE /api/lan-networks/:id
 */
exports.deleteNetwork = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if network exists and belongs to user
    const network = await UserLanNetwork.findById(id);
    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'LAN network not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && network.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete network
    await UserLanNetwork.delete(id);

    logger.info(`User ${userId} deleted LAN network ${id}`);

    // Update OpenVPN server routing (async, don't wait)
    openvpnClientConnect.updateServerRouting().catch(err => {
      logger.error('Failed to update OpenVPN routing after network deletion:', err);
    });

    res.status(200).json({
      success: true,
      message: 'LAN network deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting LAN network:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete LAN network',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Toggle network enabled status
 * PATCH /api/lan-networks/:id/toggle
 */
exports.toggleNetwork = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if network exists and belongs to user
    const network = await UserLanNetwork.findById(id);
    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'LAN network not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && network.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Toggle enabled status
    const newStatus = !network.enabled;
    await UserLanNetwork.setEnabled(id, newStatus);

    logger.info(`User ${userId} toggled LAN network ${id} to ${newStatus ? 'enabled' : 'disabled'}`);

    // Update OpenVPN server routing (async, don't wait)
    openvpnClientConnect.updateServerRouting().catch(err => {
      logger.error('Failed to update OpenVPN routing after network toggle:', err);
    });

    res.status(200).json({
      success: true,
      message: `LAN network ${newStatus ? 'enabled' : 'disabled'} successfully`,
      data: { enabled: newStatus }
    });
  } catch (error) {
    logger.error('Error toggling LAN network:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle LAN network',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user's LAN network statistics
 * GET /api/lan-networks/stats
 */
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await UserLanNetwork.getUserStats(userId);

    res.status(200).json({
      success: true,
      message: 'Statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching LAN network stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get common network suggestions
 * GET /api/lan-networks/suggestions
 */
exports.getCommonNetworks = async (req, res) => {
  try {
    const suggestions = UserLanNetwork.getCommonNetworks();

    res.status(200).json({
      success: true,
      message: 'Network suggestions retrieved successfully',
      data: suggestions
    });
  } catch (error) {
    logger.error('Error fetching network suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve network suggestions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all LAN networks (admin only)
 * GET /api/admin/lan-networks
 */
exports.getAllNetworks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const result = await UserLanNetwork.findAll(page, limit);

    res.status(200).json({
      success: true,
      message: 'All LAN networks retrieved successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error fetching all LAN networks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve LAN networks',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Helper function to check if a network is in private IP range
 * @param {string} cidr - Network in CIDR notation
 * @returns {boolean} True if private network
 */
function isPrivateNetwork(cidr) {
  const [ip] = cidr.split('/');
  const octets = ip.split('.').map(Number);

  // 10.0.0.0/8
  if (octets[0] === 10) return true;

  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;

  // 192.168.0.0/16
  if (octets[0] === 192 && octets[1] === 168) return true;

  return false;
}

module.exports = exports;
