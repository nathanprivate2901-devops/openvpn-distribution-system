const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * PasswordResetToken Model
 * Handles password reset token operations
 */
class PasswordResetToken {
  /**
   * Create a new password reset token
   * @param {number} userId - User ID
   * @param {string} token - Reset token
   * @param {Date} expiresAt - Token expiration date
   * @returns {Promise<object>} Created token data
   */
  static async create(userId, token, expiresAt) {
    try {
      // Format the expiration date to MySQL-compatible datetime string
      // Use UTC to avoid timezone issues
      const expiresAtUTC = new Date(expiresAt.getTime()).toISOString().slice(0, 19).replace('T', ' ');

      const query = `
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `;

      const [result] = await pool.execute(query, [userId, token, expiresAtUTC]);

      logger.info(`Password reset token created for user ID: ${userId}, expires at: ${expiresAtUTC}`);

      return {
        id: result.insertId,
        user_id: userId,
        token,
        expires_at: expiresAt,
      };
    } catch (error) {
      logger.error('Error creating password reset token:', error);
      throw error;
    }
  }

  /**
   * Find a valid (non-expired, unused) password reset token
   * @param {string} token - Reset token
   * @returns {Promise<object|null>} Token data or null
   */
  static async findValidToken(token) {
    try {
      const query = `
        SELECT * FROM password_reset_tokens
        WHERE token = ?
          AND expires_at > UTC_TIMESTAMP()
          AND used_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const [rows] = await pool.execute(query, [token]);

      if (rows.length === 0) {
        return null;
      }

      return rows[0];
    } catch (error) {
      logger.error('Error finding password reset token:', error);
      throw error;
    }
  }

  /**
   * Mark a token as used
   * @param {string} token - Reset token
   * @returns {Promise<boolean>} Success status
   */
  static async markAsUsed(token) {
    try {
      const query = `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE token = ?
      `;

      const [result] = await pool.execute(query, [token]);

      if (result.affectedRows === 0) {
        throw new Error('Token not found');
      }

      logger.info(`Password reset token marked as used`);

      return true;
    } catch (error) {
      logger.error('Error marking token as used:', error);
      throw error;
    }
  }

  /**
   * Delete all password reset tokens for a user
   * @param {number} userId - User ID
   * @returns {Promise<number>} Number of tokens deleted
   */
  static async deleteByUserId(userId) {
    try {
      const query = `
        DELETE FROM password_reset_tokens
        WHERE user_id = ?
      `;

      const [result] = await pool.execute(query, [userId]);

      logger.info(`Deleted ${result.affectedRows} password reset tokens for user ID: ${userId}`);

      return result.affectedRows;
    } catch (error) {
      logger.error('Error deleting password reset tokens:', error);
      throw error;
    }
  }

  /**
   * Clean up expired tokens
   * @returns {Promise<number>} Number of tokens deleted
   */
  static async cleanupExpired() {
    try {
      const query = `
        DELETE FROM password_reset_tokens
        WHERE expires_at < NOW()
      `;

      const [result] = await pool.execute(query);

      logger.info(`Cleaned up ${result.affectedRows} expired password reset tokens`);

      return result.affectedRows;
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
      throw error;
    }
  }
}

module.exports = PasswordResetToken;
