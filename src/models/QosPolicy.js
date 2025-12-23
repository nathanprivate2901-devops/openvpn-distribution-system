const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * QosPolicy Model
 * Handles Quality of Service (QoS) policy management
 */
class QosPolicy {
  /**
   * Create a new QoS policy
   * @param {Object} policyData - Policy data object
   * @param {string} policyData.name - Policy name
   * @param {string} policyData.bandwidth_limit - Bandwidth limit (e.g., "10Mbps")
   * @param {string} [policyData.priority='medium'] - Priority level (low/medium/high)
   * @param {string} [policyData.description] - Policy description
   * @returns {Promise<Object>} Created policy object
   */
  static async create(policyData) {
    try {
      const { name, bandwidth_limit, priority = 'medium', description = null } = policyData;

      const query = `
        INSERT INTO qos_policies (name, bandwidth_limit, priority, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `;

      const [result] = await pool.execute(query, [name, bandwidth_limit, priority, description]);

      logger.info(`QoS policy created: ${name}`);

      return {
        id: result.insertId,
        name,
        bandwidth_limit,
        priority,
        description,
        created_at: new Date()
      };
    } catch (error) {
      logger.error('Error creating QoS policy:', error);
      throw error;
    }
  }

  /**
   * Find all QoS policies
   * @returns {Promise<Array>} Array of all policies
   */
  static async findAll() {
    try {
      const query = `
        SELECT id, name, bandwidth_limit, priority, description, created_at, updated_at
        FROM qos_policies
        ORDER BY priority DESC, name ASC
      `;

      const [rows] = await pool.execute(query);

      return rows;
    } catch (error) {
      logger.error('Error finding all QoS policies:', error);
      throw error;
    }
  }

  /**
   * Find QoS policy by ID
   * @param {number} id - Policy ID
   * @returns {Promise<Object|null>} Policy object or null if not found
   */
  static async findById(id) {
    try {
      const query = `
        SELECT id, name, bandwidth_limit, priority, description, created_at, updated_at
        FROM qos_policies
        WHERE id = ?
      `;

      const [rows] = await pool.execute(query, [id]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error finding QoS policy by ID:', error);
      throw error;
    }
  }

  /**
   * Update QoS policy
   * @param {number} id - Policy ID
   * @param {Object} data - Update data
   * @param {string} [data.name] - Policy name
   * @param {string} [data.bandwidth_limit] - Bandwidth limit
   * @param {string} [data.priority] - Priority level
   * @param {string} [data.description] - Description
   * @returns {Promise<Object>} Updated policy object
   */
  static async update(id, data) {
    try {
      const allowedFields = ['name', 'bandwidth_limit', 'priority', 'description'];
      const updates = [];
      const values = [];

      Object.keys(data).forEach(key => {
        if (allowedFields.includes(key) && data[key] !== undefined) {
          updates.push(`${key} = ?`);
          values.push(data[key]);
        }
      });

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      updates.push('updated_at = NOW()');
      values.push(id);

      const query = `
        UPDATE qos_policies
        SET ${updates.join(', ')}
        WHERE id = ?
      `;

      const [result] = await pool.execute(query, values);

      if (result.affectedRows === 0) {
        throw new Error('QoS policy not found');
      }

      logger.info(`QoS policy updated: ID ${id}`);

      return await this.findById(id);
    } catch (error) {
      logger.error('Error updating QoS policy:', error);
      throw error;
    }
  }

  /**
   * Delete QoS policy
   * @param {number} id - Policy ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    try {
      // Check if policy is assigned to any users
      const checkQuery = 'SELECT COUNT(*) as count FROM user_qos WHERE qos_policy_id = ?';
      const [checkResult] = await pool.execute(checkQuery, [id]);

      if (checkResult[0].count > 0) {
        throw new Error('Cannot delete policy: It is assigned to users. Remove assignments first.');
      }

      const query = 'DELETE FROM qos_policies WHERE id = ?';

      const [result] = await pool.execute(query, [id]);

      if (result.affectedRows === 0) {
        throw new Error('QoS policy not found');
      }

      logger.info(`QoS policy deleted: ID ${id}`);

      return true;
    } catch (error) {
      logger.error('Error deleting QoS policy:', error);
      throw error;
    }
  }

  /**
   * Assign QoS policy to a user
   * @param {number} userId - User ID
   * @param {number} policyId - Policy ID
   * @returns {Promise<Object>} Assignment result
   */
  static async assignToUser(userId, policyId) {
    try {
      // Check if policy exists
      const policy = await this.findById(policyId);
      if (!policy) {
        throw new Error('QoS policy not found');
      }

      // Check if user already has this policy assigned
      const existingQuery = 'SELECT id FROM user_qos WHERE user_id = ? AND qos_policy_id = ?';
      const [existing] = await pool.execute(existingQuery, [userId, policyId]);

      if (existing.length > 0) {
        logger.info(`User ${userId} already has policy ${policyId} assigned`);
        return {
          user_id: userId,
          qos_policy_id: policyId,
          already_exists: true
        };
      }

      // Remove any existing policy assignments for this user (one policy per user)
      await this.removeFromUser(userId);

      // Assign new policy
      const query = `
        INSERT INTO user_qos (user_id, qos_policy_id, assigned_at)
        VALUES (?, ?, NOW())
      `;

      const [result] = await pool.execute(query, [userId, policyId]);

      logger.info(`QoS policy ${policyId} assigned to user ${userId}`);

      return {
        id: result.insertId,
        user_id: userId,
        qos_policy_id: policyId,
        assigned_at: new Date()
      };
    } catch (error) {
      logger.error('Error assigning QoS policy to user:', error);
      throw error;
    }
  }

  /**
   * Remove QoS policy from a user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async removeFromUser(userId) {
    try {
      const query = 'DELETE FROM user_qos WHERE user_id = ?';

      const [result] = await pool.execute(query, [userId]);

      if (result.affectedRows > 0) {
        logger.info(`QoS policy removed from user ${userId}`);
      }

      return true;
    } catch (error) {
      logger.error('Error removing QoS policy from user:', error);
      throw error;
    }
  }

  /**
   * Find QoS policy assigned to a user
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Policy object or null if not assigned
   */
  static async findByUserId(userId) {
    try {
      const query = `
        SELECT
          qp.id,
          qp.name,
          qp.bandwidth_limit,
          qp.priority,
          qp.description,
          qp.created_at,
          qp.updated_at,
          uq.assigned_at
        FROM user_qos uq
        INNER JOIN qos_policies qp ON uq.qos_policy_id = qp.id
        WHERE uq.user_id = ?
      `;

      const [rows] = await pool.execute(query, [userId]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error finding QoS policy by user ID:', error);
      throw error;
    }
  }

  /**
   * Get all users assigned to a specific policy
   * @param {number} policyId - Policy ID
   * @returns {Promise<Array>} Array of users
   */
  static async getUsersByPolicy(policyId) {
    try {
      const query = `
        SELECT
          u.id,
          u.email,
          u.name,
          u.role,
          uq.assigned_at
        FROM user_qos uq
        INNER JOIN users u ON uq.user_id = u.id
        WHERE uq.qos_policy_id = ? AND u.deleted_at IS NULL
        ORDER BY uq.assigned_at DESC
      `;

      const [rows] = await pool.execute(query, [policyId]);

      return rows;
    } catch (error) {
      logger.error('Error getting users by policy:', error);
      throw error;
    }
  }

  /**
   * Get QoS policy statistics
   * @returns {Promise<Object>} Statistics object
   */
  static async getStats() {
    try {
      const query = `
        SELECT
          COUNT(*) as total_policies,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as \`high_priority\`,
          COUNT(CASE WHEN priority = 'medium' THEN 1 END) as \`medium_priority\`,
          COUNT(CASE WHEN priority = 'low' THEN 1 END) as \`low_priority\`,
          (SELECT COUNT(DISTINCT user_id) FROM user_qos) as users_with_policies
        FROM qos_policies
      `;

      const [rows] = await pool.execute(query);

      return rows[0];
    } catch (error) {
      logger.error('Error getting QoS policy stats:', error);
      throw error;
    }
  }

  /**
   * Find policies by priority level
   * @param {string} priority - Priority level (low/medium/high)
   * @returns {Promise<Array>} Array of policies
   */
  static async findByPriority(priority) {
    try {
      const query = `
        SELECT id, name, bandwidth_limit, priority, description, created_at, updated_at
        FROM qos_policies
        WHERE priority = ?
        ORDER BY name ASC
      `;

      const [rows] = await pool.execute(query, [priority]);

      return rows;
    } catch (error) {
      logger.error('Error finding policies by priority:', error);
      throw error;
    }
  }

  /**
   * ============================================================================
   * DEVICE QoS POLICY METHODS
   * Methods for managing QoS policies assigned to individual devices
   * ============================================================================
   */

  /**
   * Assign QoS policy to a device
   * @param {number} deviceId - Device ID
   * @param {number} policyId - Policy ID
   * @param {number} [assignedBy] - Admin user ID who assigned the policy
   * @param {string} [notes] - Optional notes about the assignment
   * @returns {Promise<Object>} Assignment result
   */
  static async assignToDevice(deviceId, policyId, assignedBy = null, notes = null) {
    try {
      // Check if policy exists
      const policy = await this.findById(policyId);
      if (!policy) {
        throw new Error('QoS policy not found');
      }

      // Check if device already has this policy assigned
      const existingQuery = 'SELECT id FROM device_qos WHERE device_id = ? AND qos_policy_id = ?';
      const [existing] = await pool.execute(existingQuery, [deviceId, policyId]);

      if (existing.length > 0) {
        logger.info(`Device ${deviceId} already has policy ${policyId} assigned`);
        return {
          device_id: deviceId,
          qos_policy_id: policyId,
          already_exists: true
        };
      }

      // Remove any existing policy assignments for this device (one policy per device)
      await this.removeFromDevice(deviceId);

      // Assign new policy
      const query = `
        INSERT INTO device_qos (device_id, qos_policy_id, assigned_at, assigned_by, notes)
        VALUES (?, ?, NOW(), ?, ?)
      `;

      const [result] = await pool.execute(query, [deviceId, policyId, assignedBy, notes]);

      logger.info(`QoS policy ${policyId} assigned to device ${deviceId}${assignedBy ? ` by user ${assignedBy}` : ''}`);

      return {
        id: result.insertId,
        device_id: deviceId,
        qos_policy_id: policyId,
        assigned_by: assignedBy,
        notes: notes,
        assigned_at: new Date()
      };
    } catch (error) {
      logger.error('Error assigning QoS policy to device:', error);
      throw error;
    }
  }

  /**
   * Remove QoS policy from a device
   * @param {number} deviceId - Device ID
   * @returns {Promise<boolean>} Success status
   */
  static async removeFromDevice(deviceId) {
    try {
      const query = 'DELETE FROM device_qos WHERE device_id = ?';

      const [result] = await pool.execute(query, [deviceId]);

      if (result.affectedRows > 0) {
        logger.info(`QoS policy removed from device ${deviceId}`);
      }

      return true;
    } catch (error) {
      logger.error('Error removing QoS policy from device:', error);
      throw error;
    }
  }

  /**
   * Find QoS policy assigned to a device
   * @param {number} deviceId - Device ID
   * @returns {Promise<Object|null>} Policy object or null if not assigned
   */
  static async findByDeviceId(deviceId) {
    try {
      const query = `
        SELECT
          qp.id,
          qp.name,
          qp.bandwidth_limit,
          qp.priority,
          qp.description,
          qp.created_at,
          qp.updated_at,
          dq.assigned_at,
          dq.assigned_by,
          dq.notes,
          u.name as assigned_by_name,
          u.email as assigned_by_email
        FROM device_qos dq
        INNER JOIN qos_policies qp ON dq.qos_policy_id = qp.id
        LEFT JOIN users u ON dq.assigned_by = u.id
        WHERE dq.device_id = ?
      `;

      const [rows] = await pool.execute(query, [deviceId]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error finding QoS policy by device ID:', error);
      throw error;
    }
  }

  /**
   * Get all devices assigned to a specific policy
   * @param {number} policyId - Policy ID
   * @returns {Promise<Array>} Array of devices with user info
   */
  static async getDevicesByPolicy(policyId) {
    try {
      const query = `
        SELECT
          d.id,
          d.name,
          d.device_id,
          d.device_type,
          d.user_id,
          d.last_connected,
          d.last_ip,
          d.is_active,
          u.name as user_name,
          u.email as user_email,
          dq.assigned_at,
          dq.assigned_by,
          dq.notes
        FROM device_qos dq
        INNER JOIN devices d ON dq.device_id = d.id
        INNER JOIN users u ON d.user_id = u.id
        WHERE dq.qos_policy_id = ? AND u.deleted_at IS NULL
        ORDER BY dq.assigned_at DESC
      `;

      const [rows] = await pool.execute(query, [policyId]);

      return rows;
    } catch (error) {
      logger.error('Error getting devices by policy:', error);
      throw error;
    }
  }

  /**
   * Get effective QoS policy for a device (device-level or user-level)
   * @param {number} deviceId - Device ID
   * @returns {Promise<Object|null>} Effective policy object with source info
   */
  static async getEffectiveDevicePolicy(deviceId) {
    try {
      // First, try to get device-specific policy
      const devicePolicy = await this.findByDeviceId(deviceId);
      
      if (devicePolicy) {
        return {
          ...devicePolicy,
          policy_source: 'device'
        };
      }

      // If no device-specific policy, get user's policy
      const query = `
        SELECT
          qp.id,
          qp.name,
          qp.bandwidth_limit,
          qp.priority,
          qp.description,
          qp.created_at,
          qp.updated_at,
          uq.assigned_at,
          'user' as policy_source
        FROM devices d
        INNER JOIN users u ON d.user_id = u.id
        INNER JOIN user_qos uq ON u.id = uq.user_id
        INNER JOIN qos_policies qp ON uq.qos_policy_id = qp.id
        WHERE d.id = ? AND u.deleted_at IS NULL
      `;

      const [rows] = await pool.execute(query, [deviceId]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error getting effective device policy:', error);
      throw error;
    }
  }

  /**
   * Get device QoS statistics
   * @returns {Promise<Object>} Statistics object
   */
  static async getDeviceQosStats() {
    try {
      const query = `
        SELECT
          COUNT(DISTINCT dq.device_id) as devices_with_policies,
          COUNT(DISTINCT dq.qos_policy_id) as policies_in_use,
          COUNT(*) as total_device_assignments
        FROM device_qos dq
      `;

      const [rows] = await pool.execute(query);

      return rows[0];
    } catch (error) {
      logger.error('Error getting device QoS stats:', error);
      throw error;
    }
  }
}

module.exports = QosPolicy;
