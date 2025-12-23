const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * VerificationToken Model
 * Handles email verification tokens and password reset tokens
 */
class VerificationToken {
  /**
   * Create a new verification token
   * @param {number} userId - User ID
   * @param {string} token - Generated token string
   * @param {Date} expiresAt - Token expiration timestamp
   * @returns {Promise<Object>} Created token object
   */
  static async create(userId, token, expiresAt) {
    try {
      const query = `
        INSERT INTO verification_tokens (user_id, token, expires_at, created_at)
        VALUES (?, ?, ?, NOW())
      `;

      const [result] = await pool.execute(query, [userId, token, expiresAt]);

      logger.info(`Verification token created for user ID: ${userId}`);

      return {
        id: result.insertId,
        user_id: userId,
        token,
        expires_at: expiresAt
      };
    } catch (error) {
      logger.error('Error creating verification token:', error);
      throw error;
    }
  }

  /**
   * Find token by token string
   * @param {string} token - Token string
   * @returns {Promise<Object|null>} Token object with user data or null if not found/expired
   */
  static async findByToken(token) {
    try {
      const query = `
        SELECT
          vt.id,
          vt.user_id,
          vt.token,
          vt.expires_at,
          vt.created_at,
          u.email,
          u.name,
          u.email_verified
        FROM verification_tokens vt
        INNER JOIN users u ON vt.user_id = u.id
        WHERE vt.token = ? AND vt.expires_at > NOW() AND u.deleted_at IS NULL
      `;

      const [rows] = await pool.execute(query, [token]);

      if (rows.length === 0) {
        logger.warn(`Token not found or expired: ${token.substring(0, 10)}...`);
        return null;
      }

      return rows[0];
    } catch (error) {
      logger.error('Error finding token:', error);
      throw error;
    }
  }

  /**
   * Delete token by token string
   * @param {string} token - Token string
   * @returns {Promise<boolean>} Success status
   */
  static async deleteByToken(token) {
    try {
      const query = 'DELETE FROM verification_tokens WHERE token = ?';

      const [result] = await pool.execute(query, [token]);

      if (result.affectedRows > 0) {
        logger.info(`Verification token deleted: ${token.substring(0, 10)}...`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error deleting token:', error);
      throw error;
    }
  }

  /**
   * Delete all expired tokens (cleanup utility)
   * @returns {Promise<number>} Number of tokens deleted
   */
  static async deleteExpired() {
    try {
      const query = 'DELETE FROM verification_tokens WHERE expires_at <= NOW()';

      const [result] = await pool.execute(query);

      logger.info(`Deleted ${result.affectedRows} expired verification tokens`);

      return result.affectedRows;
    } catch (error) {
      logger.error('Error deleting expired tokens:', error);
      throw error;
    }
  }

  /**
   * Delete all tokens for a specific user
   * @param {number} userId - User ID
   * @returns {Promise<number>} Number of tokens deleted
   */
  static async deleteByUserId(userId) {
    try {
      const query = 'DELETE FROM verification_tokens WHERE user_id = ?';

      const [result] = await pool.execute(query, [userId]);

      if (result.affectedRows > 0) {
        logger.info(`Deleted ${result.affectedRows} tokens for user ID: ${userId}`);
      }

      return result.affectedRows;
    } catch (error) {
      logger.error('Error deleting user tokens:', error);
      throw error;
    }
  }

  /**
   * Find all valid tokens for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of valid tokens
   */
  static async findByUserId(userId) {
    try {
      const query = `
        SELECT id, user_id, token, expires_at, created_at
        FROM verification_tokens
        WHERE user_id = ? AND expires_at > NOW()
        ORDER BY created_at DESC
      `;

      const [rows] = await pool.execute(query, [userId]);

      return rows;
    } catch (error) {
      logger.error('Error finding tokens by user ID:', error);
      throw error;
    }
  }

  /**
   * Check if token is valid and not expired
   * @param {string} token - Token string
   * @returns {Promise<boolean>} Validation status
   */
  static async isValid(token) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM verification_tokens
        WHERE token = ? AND expires_at > NOW()
      `;

      const [rows] = await pool.execute(query, [token]);

      return rows[0].count > 0;
    } catch (error) {
      logger.error('Error validating token:', error);
      throw error;
    }
  }
}

module.exports = VerificationToken;
