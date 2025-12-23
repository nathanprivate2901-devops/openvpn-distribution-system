const pool = require('../config/database');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');
const openvpnUserSync = require('../services/openvpnUserSync');

/**
 * User Model
 * Handles all database operations related to users
 */
class User {
  /**
   * Create a new user
   * @param {Object} userData - User data object
   * @param {string} userData.email - User email
   * @param {string} userData.password - Hashed password
   * @param {string} userData.name - User name
   * @param {string} [userData.role='user'] - User role (user/admin)
   * @returns {Promise<Object>} Created user object
   */
  static async create(userData) {
    try {
      const { email, password, username, name, role = 'user' } = userData;

      const query = `
        INSERT INTO users (email, password, username, name, role, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, FALSE, NOW(), NOW())
      `;

      const [result] = await pool.execute(query, [email, password, username, name, role]);

      logger.info(`User created successfully: ${email}`);

      const createdUser = {
        id: result.insertId,
        email,
        username,
        name,
        role,
        email_verified: false
      };

      // Sync to OpenVPN if email is already verified (edge case)
      // Note: Normally users aren't verified on creation, but this handles pre-verified imports
      if (userData.email_verified && userData.username) {
        try {
          await openvpnUserSync.createOpenVPNUser(
            userData.username,
            null,
            {
              email: email,
              name: name,
              role: role
            }
          );
          logger.info(`User ${email} synced to OpenVPN after creation`);
        } catch (syncError) {
          logger.error(`Failed to sync user ${email} to OpenVPN after creation:`, syncError);
          // Don't throw - user creation succeeded, sync is supplementary
        }
      }

      return createdUser;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async findByEmail(email) {
    try {
      const query = `
        SELECT id, email, password, name, role, email_verified, created_at, updated_at
        FROM users
        WHERE email = ? AND deleted_at IS NULL
      `;

      const [rows] = await pool.execute(query, [email]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  /**
   * Find user by username
   * @param {string} username - Username
   * @returns {Promise<Object|null>} User object with password or null if not found
   */
  static async findByUsername(username) {
    try {
      const query = `
        SELECT id, email, password, name, role, email_verified, created_at, updated_at
        FROM users
        WHERE name = ? AND deleted_at IS NULL
      `;

      const [rows] = await pool.execute(query, [username]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async findById(id) {
    try {
      const query = `
        SELECT id, username, email, name, role, email_verified, created_at, updated_at
        FROM users
        WHERE id = ? AND deleted_at IS NULL
      `;

      const [rows] = await pool.execute(query, [id]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Verify user password
   * @param {number} userId - User ID
   * @param {string} password - Plain text password to verify
   * @returns {Promise<boolean>} True if password matches, false otherwise
   */
  static async verifyPassword(userId, password) {
    try {
      const query = `
        SELECT password
        FROM users
        WHERE id = ? AND deleted_at IS NULL
      `;

      const [rows] = await pool.execute(query, [userId]);

      if (rows.length === 0) {
        logger.warn(`Password verification failed: User ID ${userId} not found`);
        return false;
      }

      const hashedPassword = rows[0].password;
      const isMatch = await bcrypt.compare(password, hashedPassword);

      if (!isMatch) {
        logger.warn(`Password verification failed for user ID: ${userId}`);
      }

      return isMatch;
    } catch (error) {
      logger.error('Error verifying password:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {number} id - User ID
   * @param {Object} data - Update data
   * @param {string} [data.username] - Username
   * @param {string} [data.name] - User name
   * @param {string} [data.full_name] - Full name
   * @param {string} [data.email] - User email
   * @param {string} [data.role] - User role (user/admin)
   * @param {boolean} [data.email_verified] - Email verification status
   * @returns {Promise<Object>} Updated user object
   */
  static async updateProfile(id, data) {
    try {
      // Get current user state before update to detect email_verified change
      const currentUser = await this.findById(id);
      if (!currentUser) {
        throw new Error('User not found');
      }

      const allowedFields = ['username', 'name', 'full_name', 'email', 'role', 'email_verified'];
      const updates = [];
      const values = [];

      Object.keys(data).forEach(key => {
        if (allowedFields.includes(key) && data[key] !== undefined) {
          updates.push(`${key} = ?`);
          // Convert boolean to integer for TINYINT fields
          if (key === 'email_verified' && typeof data[key] === 'boolean') {
            values.push(data[key] ? 1 : 0);
          } else {
            values.push(data[key]);
          }
        }
      });

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      updates.push('updated_at = NOW()');
      values.push(id);

      const query = `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = ? AND deleted_at IS NULL
      `;

      await pool.execute(query, values);

      logger.info(`User profile updated: ID ${id}`);

      const updatedUser = await this.findById(id);

      // Sync to OpenVPN if email_verified changed from false to true OR if username/name changed
      const emailVerifiedChanged = !currentUser.email_verified && data.email_verified === true;
      const usernameChanged = (data.username && data.username !== currentUser.username) ||
                              (data.name && data.name !== currentUser.name);

      if ((emailVerifiedChanged || usernameChanged) && updatedUser.username && updatedUser.email_verified) {
        try {
          await openvpnUserSync.syncSingleUser(id);
          logger.info(`User ${updatedUser.email} synced to OpenVPN after profile update`);
        } catch (syncError) {
          logger.error(`Failed to sync user ${updatedUser.email} to OpenVPN after profile update:`, syncError);
          // Don't throw - profile update succeeded, sync is supplementary
        }
      }

      return updatedUser;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Update user password
   * @param {number} id - User ID
   * @param {string} hashedPassword - New hashed password
   * @returns {Promise<boolean>} Success status
   */
  static async updatePassword(id, hashedPassword) {
    try {
      const query = `
        UPDATE users
        SET password = ?, updated_at = NOW()
        WHERE id = ? AND deleted_at IS NULL
      `;

      const [result] = await pool.execute(query, [hashedPassword, id]);

      if (result.affectedRows === 0) {
        throw new Error('User not found or already deleted');
      }

      logger.info(`Password updated for user ID: ${id}`);

      return true;
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  /**
   * Soft delete user (mark as deleted)
   * @param {number} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async softDelete(id) {
    try {
      // Get user info before deletion for OpenVPN sync
      const user = await this.findById(id);
      if (!user) {
        throw new Error('User not found or already deleted');
      }

      // Append timestamp to email and username to free them for reuse
      const timestamp = Date.now();
      const query = `
        UPDATE users
        SET deleted_at = NOW(),
            email = CONCAT(email, '.deleted.', ?),
            username = CASE 
              WHEN username IS NOT NULL THEN CONCAT(username, '.deleted.', ?)
              ELSE NULL
            END
        WHERE id = ? AND deleted_at IS NULL
      `;

      const [result] = await pool.execute(query, [timestamp, timestamp, id]);

      if (result.affectedRows === 0) {
        throw new Error('User not found or already deleted');
      }

      logger.info(`User soft deleted: ID ${id}`);

      // Remove user from OpenVPN
      if (user.username) {
        try {
          await openvpnUserSync.removeUser(user.username);
          logger.info(`User ${user.username} removed from OpenVPN after soft delete`);
        } catch (syncError) {
          logger.error(`Failed to remove user ${user.username} from OpenVPN after deletion:`, syncError);
          // Don't throw - user deletion succeeded, sync is supplementary
        }
      }

      return true;
    } catch (error) {
      logger.error('Error soft deleting user:', error);
      throw error;
    }
  }

  /**
   * Hard delete user (permanent deletion)
   * @param {number} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async hardDelete(id) {
    try {
      const query = 'DELETE FROM users WHERE id = ?';

      const [result] = await pool.execute(query, [id]);

      if (result.affectedRows === 0) {
        throw new Error('User not found');
      }

      logger.info(`User hard deleted: ID ${id}`);

      return true;
    } catch (error) {
      logger.error('Error hard deleting user:', error);
      throw error;
    }
  }

  /**
   * Find all users with pagination and filters
   * @param {number} [page=1] - Page number
   * @param {number} [limit=10] - Items per page
   * @param {Object} [filters={}] - Filter options
   * @param {string} [filters.role] - Filter by role
   * @param {boolean} [filters.email_verified] - Filter by email verification status
   * @param {string} [filters.search] - Search in name or email
   * @returns {Promise<Object>} Paginated user list with metadata
   */
  static async findAll(page = 1, limit = 10, filters = {}) {
    try {
      // Ensure page and limit are integers
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);

      // Validate that parsing succeeded
      if (isNaN(pageNum) || isNaN(limitNum)) {
        throw new Error(`Invalid pagination parameters: page=${page}, limit=${limit}`);
      }

      const offset = (pageNum - 1) * limitNum;
      const conditions = ['deleted_at IS NULL'];
      const values = [];

      // Apply filters
      if (filters.role) {
        conditions.push('role = ?');
        values.push(filters.role);
      }

      if (filters.email_verified !== undefined) {
        conditions.push('email_verified = ?');
        // Convert boolean to integer for TINYINT field
        values.push(typeof filters.email_verified === 'boolean'
          ? (filters.email_verified ? 1 : 0)
          : filters.email_verified);
      }

      if (filters.search) {
        conditions.push('(name LIKE ? OR email LIKE ? OR username LIKE ?)');
        const searchPattern = `%${filters.search}%`;
        values.push(searchPattern, searchPattern, searchPattern);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
      const [countResult] = await pool.execute(countQuery, values);
      const total = countResult[0].total;

      // Get paginated results
      // Build query dynamically based on whether we need OFFSET
      let dataQuery;
      let dataParams;

      // Ensure LIMIT and OFFSET are safe positive integers
      const safeLimitNum = Math.max(1, Math.floor(Math.abs(limitNum)));
      const safeOffset = Math.max(0, Math.floor(Math.abs(offset)));

      // Build query with LIMIT/OFFSET as literal values (they're already validated as safe integers)
      // This avoids MySQL2 prepared statement parameter type issues
      if (safeOffset > 0) {
        dataQuery = `
          SELECT id, username, email, name, role, email_verified, created_at, updated_at
          FROM users
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${safeLimitNum} OFFSET ${safeOffset}
        `;
        dataParams = values;
      } else {
        dataQuery = `
          SELECT id, username, email, name, role, email_verified, created_at, updated_at
          FROM users
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${safeLimitNum}
        `;
        dataParams = values;
      }

      const queryParams = dataParams;

      // Log parameters for debugging
      logger.debug('User.findAll query parameters:', {
        queryParams,
        types: queryParams.map(v => typeof v),
        isNaN: queryParams.map(v => Number.isNaN(v))
      });

      // Execute query - use query() if no params, execute() if params
      let rows;
      if (queryParams.length > 0) {
        [rows] = await pool.execute(dataQuery, queryParams);
      } else {
        // When no parameters, pool.query returns array directly
        rows = await pool.query(dataQuery);
      }

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
      logger.error('Error finding all users:', error);
      throw error;
    }
  }
}

module.exports = User;
