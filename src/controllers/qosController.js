const QosPolicy = require('../models/QosPolicy');
const User = require('../models/User');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * QoS Controller
 * Handles all QoS policy management operations
 */

/**
 * Transform policy data from database format to frontend format
 * @param {Object} policy - Policy object from database
 * @returns {Object} Transformed policy object
 */
const transformPolicyForFrontend = (policy) => {
  if (!policy) return null;

  // Convert Kbps to Mbps for frontend display
  const bandwidthMbps = Math.floor(policy.bandwidth_limit / 1000);

  return {
    id: policy.id,
    policy_name: policy.name,
    max_download_speed: bandwidthMbps,
    max_upload_speed: bandwidthMbps,
    priority: policy.priority,
    description: policy.description,
    created_at: policy.created_at,
    updated_at: policy.updated_at
  };
};

/**
 * Get all QoS policies
 * @route GET /api/qos/policies
 * @access Authenticated
 */
const getAllPolicies = async (req, res) => {
  try {
    logger.info(`Fetching all QoS policies requested by user: ${req.user.email}`);

    const policies = await QosPolicy.findAll();
    const transformedPolicies = policies.map(transformPolicyForFrontend);

    logger.info(`Successfully retrieved ${policies.length} QoS policies`);

    return res.status(200).json({
      success: true,
      message: 'QoS policies retrieved successfully',
      data: {
        policies: transformedPolicies,
        count: transformedPolicies.length
      }
    });

  } catch (error) {
    logger.error('Error in getAllPolicies:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve QoS policies',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get specific QoS policy by ID
 * @route GET /api/qos/policies/:id
 * @access Authenticated
 */
const getPolicyById = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`Fetching QoS policy ID: ${id} by user: ${req.user.email}`);

    const policy = await QosPolicy.findById(id);

    if (!policy) {
      logger.warn(`QoS policy not found: ID ${id}`);
      return res.status(404).json({
        success: false,
        message: 'QoS policy not found'
      });
    }

    logger.info(`Successfully retrieved QoS policy: ${policy.policy_name}`);

    return res.status(200).json({
      success: true,
      message: 'QoS policy retrieved successfully',
      data: {
        policy
      }
    });

  } catch (error) {
    logger.error('Error in getPolicyById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve QoS policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create new QoS policy
 * @route POST /api/qos/policies
 * @access Admin only
 */
const createPolicy = async (req, res) => {
  try {
    const { policy_name, max_download_speed, max_upload_speed, priority, description } = req.body;

    logger.info(`Creating new QoS policy: ${policy_name} by admin: ${req.user.email}`);

    // Check if policy with same name already exists
    const policies = await QosPolicy.findAll();
    const existingPolicy = policies.find(p => p.name && p.name.toLowerCase() === policy_name.toLowerCase());

    if (existingPolicy) {
      logger.warn(`QoS policy creation failed: Policy name already exists - ${policy_name}`);
      return res.status(409).json({
        success: false,
        message: 'A QoS policy with this name already exists'
      });
    }

    // Map frontend field names to database field names
    // Convert Mbps to Kbps and use the max of download/upload
    const policyData = {
      name: policy_name,
      bandwidth_limit: Math.max(max_download_speed, max_upload_speed) * 1000, // Convert Mbps to Kbps
      priority: priority || 'medium',
      description: description || null
    };

    const newPolicy = await QosPolicy.create(policyData);
    const transformedPolicy = transformPolicyForFrontend(newPolicy);

    logger.info(`QoS policy created successfully: ${newPolicy.name} (ID: ${newPolicy.id})`);

    return res.status(201).json({
      success: true,
      message: 'QoS policy created successfully',
      data: {
        policy: transformedPolicy
      }
    });

  } catch (error) {
    logger.error('Error in createPolicy:', error);

    // Handle duplicate key errors
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'A QoS policy with this name already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create QoS policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update existing QoS policy
 * @route PUT /api/qos/policies/:id
 * @access Admin only
 */
const updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const { policy_name, max_download_speed, max_upload_speed, priority, description } = req.body;

    logger.info(`Updating QoS policy ID: ${id} by admin: ${req.user.email}`);

    // Check if policy exists
    const existingPolicy = await QosPolicy.findById(id);
    if (!existingPolicy) {
      logger.warn(`QoS policy update failed: Policy not found - ID ${id}`);
      return res.status(404).json({
        success: false,
        message: 'QoS policy not found'
      });
    }

    // Map frontend field names to database field names
    const updates = {};
    if (policy_name !== undefined) updates.name = policy_name;
    if (max_download_speed !== undefined || max_upload_speed !== undefined) {
      // Convert Mbps to Kbps for database storage
      // Use either the provided value or the existing one
      const downloadMbps = max_download_speed || Math.floor(existingPolicy.bandwidth_limit / 1000);
      const uploadMbps = max_upload_speed || Math.floor(existingPolicy.bandwidth_limit / 1000);
      // Store the average or max of download/upload as single value in Kbps
      updates.bandwidth_limit = Math.max(downloadMbps, uploadMbps) * 1000;
    }
    if (priority !== undefined) updates.priority = priority;
    if (description !== undefined) updates.description = description;

    // If updating name, check for duplicates
    if (updates.name && updates.name !== existingPolicy.name) {
      const policies = await QosPolicy.findAll();
      const duplicatePolicy = policies.find(
        p => p.name && p.name.toLowerCase() === updates.name.toLowerCase() && p.id !== parseInt(id, 10)
      );

      if (duplicatePolicy) {
        logger.warn(`QoS policy update failed: Policy name already exists - ${updates.name}`);
        return res.status(409).json({
          success: false,
          message: 'A QoS policy with this name already exists'
        });
      }
    }

    const updatedPolicy = await QosPolicy.update(id, updates);
    const transformedPolicy = transformPolicyForFrontend(updatedPolicy);

    logger.info(`QoS policy updated successfully: ${updatedPolicy.name} (ID: ${id})`);

    return res.status(200).json({
      success: true,
      message: 'QoS policy updated successfully',
      data: {
        policy: transformedPolicy
      }
    });

  } catch (error) {
    logger.error('Error in updatePolicy:', error);

    // Handle duplicate key errors
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'A QoS policy with this name already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update QoS policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete QoS policy
 * @route DELETE /api/qos/policies/:id
 * @access Admin only
 */
const deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`Deleting QoS policy ID: ${id} by admin: ${req.user.email}`);

    // Check if policy exists
    const existingPolicy = await QosPolicy.findById(id);
    if (!existingPolicy) {
      logger.warn(`QoS policy deletion failed: Policy not found - ID ${id}`);
      return res.status(404).json({
        success: false,
        message: 'QoS policy not found'
      });
    }

    // Check if policy is assigned to any users
    const [assignedUsers] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_qos WHERE qos_policy_id = ?',
      [id]
    );

    if (assignedUsers[0].count > 0) {
      logger.warn(`QoS policy deletion failed: Policy is assigned to ${assignedUsers[0].count} users - ID ${id}`);
      return res.status(409).json({
        success: false,
        message: `Cannot delete policy: It is currently assigned to ${assignedUsers[0].count} user(s). Please remove all assignments first.`,
        data: {
          assignedUserCount: assignedUsers[0].count
        }
      });
    }

    // Check if policy is referenced in any config files
    const [configReferences] = await pool.execute(
      'SELECT COUNT(*) as count FROM config_files WHERE qos_policy_id = ?',
      [id]
    );

    if (configReferences[0].count > 0) {
      logger.warn(`QoS policy deletion blocked: Policy is referenced in ${configReferences[0].count} config files - ID ${id}`);
      return res.status(409).json({
        success: false,
        message: `Cannot delete policy: It is referenced in ${configReferences[0].count} configuration file(s).`,
        data: {
          configFileCount: configReferences[0].count
        }
      });
    }

    await QosPolicy.delete(id);

    logger.info(`QoS policy deleted successfully: ${existingPolicy.policy_name} (ID: ${id})`);

    return res.status(200).json({
      success: true,
      message: 'QoS policy deleted successfully',
      data: {
        deletedPolicy: existingPolicy
      }
    });

  } catch (error) {
    logger.error('Error in deletePolicy:', error);

    // Handle foreign key constraint errors
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete policy: It is still referenced by other records'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete QoS policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Assign QoS policy to user
 * @route POST /api/qos/assign
 * @access Admin only
 */
const assignPolicyToUser = async (req, res) => {
  try {
    const { userId, policyId } = req.body;

    logger.info(`Assigning QoS policy ID: ${policyId} to user ID: ${userId} by admin: ${req.user.email}`);

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`Policy assignment failed: User not found - ID ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify policy exists
    const policy = await QosPolicy.findById(policyId);
    if (!policy) {
      logger.warn(`Policy assignment failed: Policy not found - ID ${policyId}`);
      return res.status(404).json({
        success: false,
        message: 'QoS policy not found'
      });
    }

    // Check if user already has this policy assigned
    const existingPolicy = await QosPolicy.findByUserId(userId);
    if (existingPolicy && existingPolicy.id === policyId) {
      logger.info(`User already has this policy assigned: User ${userId}, Policy ${policyId}`);
      return res.status(200).json({
        success: true,
        message: 'User already has this QoS policy assigned',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email
          },
          policy
        }
      });
    }

    await QosPolicy.assignToUser(userId, policyId);

    logger.info(`QoS policy assigned successfully: User ${user.email} -> Policy ${policy.policy_name}`);

    return res.status(200).json({
      success: true,
      message: 'QoS policy assigned to user successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        policy,
        previousPolicy: existingPolicy
      }
    });

  } catch (error) {
    logger.error('Error in assignPolicyToUser:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign QoS policy to user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Remove QoS policy assignment from user
 * @route DELETE /api/qos/assign/:userId
 * @access Admin only
 */
const removePolicyFromUser = async (req, res) => {
  try {
    const { userId } = req.params;

    logger.info(`Removing QoS policy assignment from user ID: ${userId} by admin: ${req.user.email}`);

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`Policy removal failed: User not found - ID ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has a policy assigned
    const existingPolicy = await QosPolicy.findByUserId(userId);
    if (!existingPolicy) {
      logger.info(`User has no QoS policy assigned: User ID ${userId}`);
      return res.status(200).json({
        success: true,
        message: 'User has no QoS policy assigned',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email
          }
        }
      });
    }

    await QosPolicy.removeFromUser(userId);

    logger.info(`QoS policy removed from user successfully: ${user.email} (was: ${existingPolicy.policy_name})`);

    return res.status(200).json({
      success: true,
      message: 'QoS policy removed from user successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        removedPolicy: existingPolicy
      }
    });

  } catch (error) {
    logger.error('Error in removePolicyFromUser:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove QoS policy from user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get current user's assigned QoS policy
 * @route GET /api/qos/my-policy
 * @access Authenticated
 */
const getMyPolicy = async (req, res) => {
  try {
    const userId = req.user.id;

    logger.info(`Fetching QoS policy for user: ${req.user.email}`);

    const policy = await QosPolicy.findByUserId(userId);

    if (!policy) {
      logger.info(`No QoS policy assigned to user: ${req.user.email}`);
      return res.status(200).json({
        success: true,
        message: 'No QoS policy assigned to your account',
        data: {
          policy: null
        }
      });
    }

    logger.info(`Retrieved QoS policy for user: ${req.user.email} -> ${policy.policy_name}`);

    return res.status(200).json({
      success: true,
      message: 'Your QoS policy retrieved successfully',
      data: {
        policy
      }
    });

  } catch (error) {
    logger.error('Error in getMyPolicy:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve your QoS policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get usage statistics for a specific QoS policy
 * @route GET /api/qos/policies/:id/stats
 * @access Admin only
 */
const getPolicyStats = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`Fetching stats for QoS policy ID: ${id} by admin: ${req.user.email}`);

    // Verify policy exists
    const policy = await QosPolicy.findById(id);
    if (!policy) {
      logger.warn(`Policy stats retrieval failed: Policy not found - ID ${id}`);
      return res.status(404).json({
        success: false,
        message: 'QoS policy not found'
      });
    }

    // Get assigned users count
    const [assignedUsersResult] = await pool.execute(
      `SELECT COUNT(*) as count
       FROM user_qos
       WHERE qos_policy_id = ?`,
      [id]
    );
    const assignedUsersCount = assignedUsersResult[0].count;

    // Get assigned users details
    const [assignedUsers] = await pool.execute(
      `SELECT u.id, u.name, u.email, uq.assigned_at
       FROM users u
       JOIN user_qos uq ON u.id = uq.user_id
       WHERE uq.qos_policy_id = ? AND u.deleted_at IS NULL
       ORDER BY uq.assigned_at DESC`,
      [id]
    );

    // Get config files count using this policy
    const [configFilesResult] = await pool.execute(
      `SELECT COUNT(*) as count
       FROM config_files
       WHERE qos_policy_id = ?`,
      [id]
    );
    const configFilesCount = configFilesResult[0].count;

    // Get recent config file generations
    const [recentConfigs] = await pool.execute(
      `SELECT cf.id, cf.filename, cf.created_at, cf.downloaded_at, cf.revoked,
              u.name as user_name, u.email as user_email
       FROM config_files cf
       JOIN users u ON cf.user_id = u.id
       WHERE cf.qos_policy_id = ?
       ORDER BY cf.created_at DESC
       LIMIT 10`,
      [id]
    );

    logger.info(`Stats retrieved for QoS policy: ${policy.policy_name} (${assignedUsersCount} users assigned)`);

    return res.status(200).json({
      success: true,
      message: 'QoS policy statistics retrieved successfully',
      data: {
        policy,
        statistics: {
          assignedUsersCount,
          configFilesCount,
          assignedUsers: assignedUsers.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            assignedAt: u.assigned_at
          })),
          recentConfigFiles: recentConfigs.map(cf => ({
            id: cf.id,
            filename: cf.filename,
            createdAt: cf.created_at,
            downloadedAt: cf.downloaded_at,
            revoked: cf.revoked,
            user: {
              name: cf.user_name,
              email: cf.user_email
            }
          }))
        }
      }
    });

  } catch (error) {
    logger.error('Error in getPolicyStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve QoS policy statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ============================================================================
 * DEVICE QoS POLICY ENDPOINTS
 * Endpoints for managing QoS policies for individual devices
 * ============================================================================
 */

/**
 * Assign QoS policy to a device
 * @route POST /api/qos/assign-device
 * @access Admin only
 */
const assignPolicyToDevice = async (req, res) => {
  try {
    const { deviceId, policyId, notes } = req.body;
    const adminId = req.user.id;

    logger.info(`Assigning QoS policy ID: ${policyId} to device ID: ${deviceId} by admin: ${req.user.email}`);

    // Verify device exists
    const Device = require('../models/Device');
    const device = await Device.findById(deviceId);
    if (!device) {
      logger.warn(`Policy assignment failed: Device not found - ID ${deviceId}`);
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Verify policy exists
    const policy = await QosPolicy.findById(policyId);
    if (!policy) {
      logger.warn(`Policy assignment failed: Policy not found - ID ${policyId}`);
      return res.status(404).json({
        success: false,
        message: 'QoS policy not found'
      });
    }

    // Check if device already has this policy assigned
    const existingPolicy = await QosPolicy.findByDeviceId(deviceId);
    if (existingPolicy && existingPolicy.id === policyId) {
      logger.info(`Device already has this policy assigned: Device ${deviceId}, Policy ${policyId}`);
      return res.status(200).json({
        success: true,
        message: 'Device already has this QoS policy assigned',
        data: {
          device: {
            id: device.id,
            name: device.name,
            device_type: device.device_type
          },
          policy: transformPolicyForFrontend(policy)
        }
      });
    }

    await QosPolicy.assignToDevice(deviceId, policyId, adminId, notes);

    logger.info(`QoS policy assigned successfully: Device ${device.name} -> Policy ${policy.name}`);

    return res.status(200).json({
      success: true,
      message: 'QoS policy assigned to device successfully',
      data: {
        device: {
          id: device.id,
          name: device.name,
          device_type: device.device_type,
          user_id: device.user_id
        },
        policy: transformPolicyForFrontend(policy),
        previousPolicy: existingPolicy ? transformPolicyForFrontend(existingPolicy) : null,
        assigned_by: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email
        }
      }
    });

  } catch (error) {
    logger.error('Error in assignPolicyToDevice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign QoS policy to device',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Remove QoS policy assignment from a device
 * @route DELETE /api/qos/assign-device/:deviceId
 * @access Admin only
 */
const removePolicyFromDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;

    logger.info(`Removing QoS policy assignment from device ID: ${deviceId} by admin: ${req.user.email}`);

    // Verify device exists
    const Device = require('../models/Device');
    const device = await Device.findById(deviceId);
    if (!device) {
      logger.warn(`Policy removal failed: Device not found - ID ${deviceId}`);
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check if device has a policy assigned
    const existingPolicy = await QosPolicy.findByDeviceId(deviceId);
    if (!existingPolicy) {
      logger.info(`Device has no QoS policy assigned: Device ID ${deviceId}`);
      return res.status(200).json({
        success: true,
        message: 'Device has no QoS policy assigned',
        data: {
          device: {
            id: device.id,
            name: device.name,
            device_type: device.device_type
          }
        }
      });
    }

    await QosPolicy.removeFromDevice(deviceId);

    logger.info(`QoS policy removed from device successfully: ${device.name} (was: ${existingPolicy.name})`);

    return res.status(200).json({
      success: true,
      message: 'QoS policy removed from device successfully',
      data: {
        device: {
          id: device.id,
          name: device.name,
          device_type: device.device_type,
          user_id: device.user_id
        },
        removedPolicy: transformPolicyForFrontend(existingPolicy)
      }
    });

  } catch (error) {
    logger.error('Error in removePolicyFromDevice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove QoS policy from device',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get QoS policy assigned to a specific device
 * @route GET /api/qos/device/:deviceId
 * @access Authenticated (users can view their own devices)
 */
const getDevicePolicy = async (req, res) => {
  try {
    const { deviceId } = req.params;

    logger.info(`Fetching QoS policy for device ID: ${deviceId} by user: ${req.user.email}`);

    // Verify device exists and user has access
    const Device = require('../models/Device');
    const device = await Device.findById(deviceId);
    if (!device) {
      logger.warn(`Device not found: ID ${deviceId}`);
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check if user owns this device (unless admin)
    if (req.user.role !== 'admin' && device.user_id !== req.user.id) {
      logger.warn(`Unauthorized access attempt: User ${req.user.email} tried to access device ${deviceId}`);
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this device'
      });
    }

    // Get effective policy (device-level or user-level)
    const effectivePolicy = await QosPolicy.getEffectiveDevicePolicy(deviceId);

    if (!effectivePolicy) {
      logger.info(`No QoS policy assigned to device: ${device.name}`);
      return res.status(200).json({
        success: true,
        message: 'No QoS policy assigned to this device',
        data: {
          device: {
            id: device.id,
            name: device.name,
            device_type: device.device_type
          },
          policy: null,
          policy_source: null
        }
      });
    }

    logger.info(`Retrieved QoS policy for device: ${device.name} -> ${effectivePolicy.name} (${effectivePolicy.policy_source}-level)`);

    return res.status(200).json({
      success: true,
      message: 'Device QoS policy retrieved successfully',
      data: {
        device: {
          id: device.id,
          name: device.name,
          device_type: device.device_type,
          user_id: device.user_id
        },
        policy: transformPolicyForFrontend(effectivePolicy),
        policy_source: effectivePolicy.policy_source,
        assigned_at: effectivePolicy.assigned_at
      }
    });

  } catch (error) {
    logger.error('Error in getDevicePolicy:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve device QoS policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get statistics for device QoS assignments for a specific policy
 * @route GET /api/qos/policies/:id/device-stats
 * @access Admin only
 */
const getPolicyDeviceStats = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`Fetching device stats for QoS policy ID: ${id} by admin: ${req.user.email}`);

    // Verify policy exists
    const policy = await QosPolicy.findById(id);
    if (!policy) {
      logger.warn(`Policy device stats retrieval failed: Policy not found - ID ${id}`);
      return res.status(404).json({
        success: false,
        message: 'QoS policy not found'
      });
    }

    // Get devices assigned to this policy
    const devices = await QosPolicy.getDevicesByPolicy(id);

    // Get overall device QoS statistics
    const overallStats = await QosPolicy.getDeviceQosStats();

    logger.info(`Device stats retrieved for QoS policy: ${policy.name} (${devices.length} devices assigned)`);

    return res.status(200).json({
      success: true,
      message: 'Device QoS policy statistics retrieved successfully',
      data: {
        policy: transformPolicyForFrontend(policy),
        statistics: {
          assignedDevicesCount: devices.length,
          devices: devices.map(d => ({
            id: d.id,
            name: d.name,
            device_id: d.device_id,
            device_type: d.device_type,
            user: {
              id: d.user_id,
              name: d.user_name,
              email: d.user_email
            },
            last_connected: d.last_connected,
            last_ip: d.last_ip,
            is_active: d.is_active,
            assignedAt: d.assigned_at,
            notes: d.notes
          })),
          overallStats
        }
      }
    });

  } catch (error) {
    logger.error('Error in getPolicyDeviceStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve device QoS policy statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  deletePolicy,
  assignPolicyToUser,
  removePolicyFromUser,
  getMyPolicy,
  getPolicyStats,
  // Device QoS endpoints
  assignPolicyToDevice,
  removePolicyFromDevice,
  getDevicePolicy,
  getPolicyDeviceStats
};
