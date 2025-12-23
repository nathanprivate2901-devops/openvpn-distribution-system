const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * ConfigFile Model
 * Handles OpenVPN configuration file management
 */
class ConfigFile {
  /**
   * Create a new configuration file
   * @param {number} userId - User ID
   * @param {number} qosPolicyId - QoS Policy ID
   * @param {string} filename - Configuration filename
   * @param {string} content - Configuration file content
   * @returns {Promise<Object>} Created config file object
   */
  static async create(userId, qosPolicyId, filename, content) {
    try {
      const query = `
        INSERT INTO config_files (user_id, qos_policy_id, filename, content, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `;

      const [result] = await pool.execute(query, [userId, qosPolicyId, filename, content]);

      logger.info(`Config file created: ${filename} for user ID: ${userId}`);

      return {
        id: result.insertId,
        user_id: userId,
        qos_policy_id: qosPolicyId,
        filename,
        created_at: new Date()
      };
    } catch (error) {
      logger.error('Error creating config file:', error);
      throw error;
    }
  }

  /**
   * Find all config files for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of config file objects
   */
  static async findByUserId(userId) {
    try {
      const query = `
        SELECT
          cf.id,
          cf.user_id,
          cf.qos_policy_id,
          cf.filename,
          cf.downloaded_at,
          cf.revoked_at,
          cf.created_at,
          qp.name as qos_policy_name,
          qp.bandwidth_limit,
          qp.priority
        FROM config_files cf
        LEFT JOIN qos_policies qp ON cf.qos_policy_id = qp.id
        WHERE cf.user_id = ?
        ORDER BY cf.created_at DESC
      `;

      const [rows] = await pool.execute(query, [userId]);

      return rows;
    } catch (error) {
      logger.error('Error finding config files by user ID:', error);
      throw error;
    }
  }

  /**
   * Find the latest config file for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Latest config file or null
   */
  static async findLatestByUserId(userId) {
    try {
      const query = `
        SELECT
          cf.id,
          cf.user_id,
          cf.qos_policy_id,
          cf.filename,
          cf.downloaded_at,
          cf.revoked_at,
          cf.created_at,
          qp.name as qos_policy_name,
          qp.bandwidth_limit as max_download_speed,
          qp.bandwidth_limit as max_upload_speed,
          qp.priority
        FROM config_files cf
        LEFT JOIN qos_policies qp ON cf.qos_policy_id = qp.id
        WHERE cf.user_id = ?
        ORDER BY cf.created_at DESC
        LIMIT 1
      `;

      const [rows] = await pool.execute(query, [userId]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error finding latest config file by user ID:', error);
      throw error;
    }
  }

  /**
   * Find config file by ID
   * @param {number} id - Config file ID
   * @returns {Promise<Object|null>} Config file object with content or null if not found
   */
  static async findById(id) {
    try {
      const query = `
        SELECT
          cf.id,
          cf.user_id,
          cf.qos_policy_id,
          cf.filename,
          cf.content,
          cf.downloaded_at,
          cf.revoked_at,
          cf.created_at,
          u.email as user_email,
          u.name as user_name,
          qp.name as qos_policy_name,
          qp.bandwidth_limit,
          qp.priority
        FROM config_files cf
        INNER JOIN users u ON cf.user_id = u.id
        LEFT JOIN qos_policies qp ON cf.qos_policy_id = qp.id
        WHERE cf.id = ?
      `;

      const [rows] = await pool.execute(query, [id]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error finding config file by ID:', error);
      throw error;
    }
  }

  /**
   * Mark config file as downloaded
   * @param {number} id - Config file ID
   * @returns {Promise<boolean>} Success status
   */
  static async markDownloaded(id) {
    try {
      const query = `
        UPDATE config_files
        SET downloaded_at = NOW()
        WHERE id = ?
      `;

      const [result] = await pool.execute(query, [id]);

      if (result.affectedRows === 0) {
        throw new Error('Config file not found');
      }

      logger.info(`Config file marked as downloaded: ID ${id}`);

      return true;
    } catch (error) {
      logger.error('Error marking config as downloaded:', error);
      throw error;
    }
  }

  /**
   * Revoke config file (soft delete)
   * @param {number} id - Config file ID
   * @returns {Promise<boolean>} Success status
   */
  static async revoke(id) {
    try {
      const query = `
        UPDATE config_files
        SET revoked_at = NOW()
        WHERE id = ? AND revoked_at IS NULL
      `;

      const [result] = await pool.execute(query, [id]);

      if (result.affectedRows === 0) {
        throw new Error('Config file not found or already revoked');
      }

      logger.info(`Config file revoked: ID ${id}`);

      return true;
    } catch (error) {
      logger.error('Error revoking config file:', error);
      throw error;
    }
  }

  /**
   * Delete config file permanently
   * @param {number} id - Config file ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteById(id) {
    try {
      const query = 'DELETE FROM config_files WHERE id = ?';

      const [result] = await pool.execute(query, [id]);

      if (result.affectedRows === 0) {
        throw new Error('Config file not found');
      }

      logger.info(`Config file deleted: ID ${id}`);

      return true;
    } catch (error) {
      logger.error('Error deleting config file:', error);
      throw error;
    }
  }

  /**
   * Find all active (non-revoked) config files for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of active config files
   */
  static async findActiveByUserId(userId) {
    try {
      const query = `
        SELECT
          cf.id,
          cf.user_id,
          cf.qos_policy_id,
          cf.filename,
          cf.downloaded_at,
          cf.created_at,
          qp.name as qos_policy_name,
          qp.bandwidth_limit,
          qp.priority
        FROM config_files cf
        LEFT JOIN qos_policies qp ON cf.qos_policy_id = qp.id
        WHERE cf.user_id = ? AND cf.revoked_at IS NULL
        ORDER BY cf.created_at DESC
      `;

      const [rows] = await pool.execute(query, [userId]);

      return rows;
    } catch (error) {
      logger.error('Error finding active config files:', error);
      throw error;
    }
  }

  /**
   * Get config file statistics
   * @returns {Promise<Object>} Statistics object
   */
  static async getStats() {
    try {
      const query = `
        SELECT
          COUNT(*) as total_configs,
          COUNT(CASE WHEN revoked_at IS NULL THEN 1 END) as active_configs,
          COUNT(CASE WHEN revoked_at IS NOT NULL THEN 1 END) as revoked_configs,
          COUNT(CASE WHEN downloaded_at IS NOT NULL THEN 1 END) as downloaded_configs,
          COUNT(DISTINCT user_id) as users_with_configs
        FROM config_files
      `;

      const [rows] = await pool.execute(query);

      return rows[0];
    } catch (error) {
      logger.error('Error getting config file stats:', error);
      throw error;
    }
  }

  /**
   * Get config file statistics for a specific user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User-specific statistics object
   */
  static async getUserStats(userId) {
    try {
      const query = `
        SELECT
          COUNT(*) as total_configs,
          COUNT(CASE WHEN revoked_at IS NULL THEN 1 END) as active_configs,
          COUNT(CASE WHEN revoked_at IS NOT NULL THEN 1 END) as revoked_configs,
          COUNT(CASE WHEN downloaded_at IS NOT NULL THEN 1 END) as downloaded_configs
        FROM config_files
        WHERE user_id = ?
      `;

      const [rows] = await pool.execute(query, [userId]);

      return rows[0];
    } catch (error) {
      logger.error('Error getting user config file stats:', error);
      throw error;
    }
  }

  /**
   * Delete all config files for a user
   * @param {number} userId - User ID
   * @returns {Promise<number>} Number of files deleted
   */
  static async deleteByUserId(userId) {
    try {
      const query = 'DELETE FROM config_files WHERE user_id = ?';

      const [result] = await pool.execute(query, [userId]);

      logger.info(`Deleted ${result.affectedRows} config files for user ID: ${userId}`);

      return result.affectedRows;
    } catch (error) {
      logger.error('Error deleting user config files:', error);
      throw error;
    }
  }

  /**
   * Find all configs with pagination
   * @param {number} [page=1] - Page number
   * @param {number} [limit=10] - Items per page
   * @returns {Promise<Object>} Paginated config list
   */
  static async findAll(page = 1, limit = 10) {
    try {
      // Ensure page and limit are integers
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      // Get total count
      const countQuery = 'SELECT COUNT(*) as total FROM config_files';
      const [countResult] = await pool.execute(countQuery);
      const total = countResult[0].total;

      // Ensure LIMIT and OFFSET are safe positive integers
      const safeLimitNum = Math.max(1, Math.floor(Math.abs(limitNum)));
      const safeOffset = Math.max(0, Math.floor(Math.abs(offset)));

      // Get paginated results (use literal values for LIMIT/OFFSET to avoid MySQL2 prepared statement issues)
      const dataQuery = `
        SELECT
          cf.id,
          cf.user_id,
          cf.qos_policy_id,
          cf.filename,
          cf.downloaded_at,
          cf.revoked_at,
          cf.created_at,
          u.email as user_email,
          u.name as user_name,
          qp.name as qos_policy_name
        FROM config_files cf
        INNER JOIN users u ON cf.user_id = u.id
        LEFT JOIN qos_policies qp ON cf.qos_policy_id = qp.id
        ORDER BY cf.created_at DESC
        LIMIT ${safeLimitNum} OFFSET ${safeOffset}
      `;

      const [rows] = await pool.query(dataQuery);

      return {
        data: rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      };
    } catch (error) {
      logger.error('Error finding all config files:', error);
      throw error;
    }
  }
}

module.exports = ConfigFile;
