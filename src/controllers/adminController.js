const User = require('../models/User');
const ConfigFile = require('../models/ConfigFile');
const VerificationToken = require('../models/VerificationToken');
const PasswordResetToken = require('../models/PasswordResetToken');
const QosPolicy = require('../models/QosPolicy');
const Device = require('../models/Device');
const logger = require('../utils/logger');
const { generatePasswordResetToken } = require('../utils/tokenGenerator');
const { sendPasswordResetEmail } = require('../utils/emailService');

/**
 * Admin Controller
 * Handles administrative operations for the OpenVPN Distribution System
 */

/**
 * Get all users with pagination, search, and filtering
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - search: Search in email and username fields
 * - role: Filter by role (user/admin)
 * - verified: Filter by email_verified status (true/false)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      role = '',
      verified = ''
    } = req.query;

    // Validate and sanitize pagination params
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    // Build filter options
    const filters = {};
    if (search) filters.search = search.trim();
    if (role) filters.role = role.toLowerCase();
    if (verified !== '') filters.email_verified = verified === 'true';

    logger.info(`Admin ${req.user.email} retrieving users list`, {
      page: pageNum,
      limit: limitNum,
      filters
    });

    // Get users using existing User model method
    const result = await User.findAll(pageNum, limitNum, filters);

    res.json({
      success: true,
      data: {
        items: result.data,  // Frontend expects "items" not "users"
        pagination: result.pagination
      }
    });
  } catch (error) {
    logger.error('Error in getAllUsers:', error);
    next(error);
  }
};

/**
 * Get specific user by ID with detailed information
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info(`Admin ${req.user.email} retrieving user details for ID: ${id}`);

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get config file stats for the user
    const configStats = await ConfigFile.getUserStats(id);

    // Get assigned QoS policy
    const assignedPolicy = await QosPolicy.findByUserId(id);

    res.json({
      success: true,
      data: {
        user,
        stats: {
          total_configs: configStats.total_configs || 0,
          active_configs: configStats.active_configs || 0,
          total_downloads: configStats.total_downloads || 0
        },
        qos_policy: assignedPolicy
      }
    });
  } catch (error) {
    logger.error('Error in getUserById:', error);
    next(error);
  }
};

/**
 * Update user information
 * Allows updating: username, email, role, email_verified status, full_name
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username, full_name, email, role, email_verified } = req.body;

    logger.info(`Admin ${req.user.email} updating user ID: ${id}`, {
      updates: { username, full_name, email, role, email_verified }
    });

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from demoting themselves
    if (String(id) === String(req.user.id) && role === 'user' && existingUser.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You cannot demote your own admin role'
      });
    }

    // If email is being changed, check for duplicates
    if (email && email !== existingUser.email) {
      const emailExists = await User.findByEmail(email);
      if (emailExists && String(emailExists.id) !== String(id)) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Build update object (only include defined values)
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (full_name !== undefined) updates.full_name = full_name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be "user" or "admin"'
        });
      }
      updates.role = role;
    }
    if (email_verified !== undefined) {
      updates.email_verified = Boolean(email_verified);
    }

    // Update user profile
    await User.updateProfile(id, updates);

    const updatedUser = await User.findById(id);

    logger.info(`User ${id} successfully updated by admin ${req.user.email}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    logger.error('Error in updateUser:', error);
    next(error);
  }
};

/**
 * Delete user (soft or hard delete)
 * Query param: hard=true for permanent deletion
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hard } = req.query;
    const isHardDelete = hard === 'true';

    logger.info(`Admin ${req.user.email} attempting to delete user ID: ${id}`, {
      hardDelete: isHardDelete
    });

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (String(id) === String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    if (isHardDelete) {
      // Hard delete: permanently remove user and all related data
      // First, delete user's config files
      await ConfigFile.deleteByUserId(id);
      // Delete verification tokens
      await VerificationToken.deleteByUserId(id);
      // Remove QoS policy assignments
      await QosPolicy.removeFromUser(id);
      // Finally, delete the user
      await User.hardDelete(id);

      logger.warn(`User ${id} (${user.email}) permanently deleted by admin ${req.user.email}`);

      res.json({
        success: true,
        message: 'User permanently deleted'
      });
    } else {
      // Soft delete: mark as deleted
      await User.softDelete(id);
      logger.info(`User ${id} (${user.email}) soft deleted by admin ${req.user.email}`);

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    }
  } catch (error) {
    logger.error('Error in deleteUser:', error);
    next(error);
  }
};

/**
 * Get system statistics
 * Returns: total users, active users, total configs, total policies
 */
const getSystemStats = async (req, res, next) => {
  try {
    logger.info(`Admin ${req.user.email} retrieving system stats`);

    // Get config stats
    const configStats = await ConfigFile.getStats();

    // Get users count
    const usersResult = await User.findAll(1, 1, {});
    const totalUsers = usersResult.pagination.total;

    // Get verified users count
    const verifiedUsersResult = await User.findAll(1, 1, { email_verified: true });
    const activeUsers = verifiedUsersResult.pagination.total;

    // Get unverified users count
    const unverifiedUsersResult = await User.findAll(1, 1, { email_verified: false });
    const unverifiedUsers = unverifiedUsersResult.pagination.total;

    // Get admin users count
    const adminUsersResult = await User.findAll(1, 1, { role: 'admin' });
    const adminUsers = adminUsersResult.pagination.total;

    // Get regular users count
    const regularUsersResult = await User.findAll(1, 1, { role: 'user' });
    const regularUsers = regularUsersResult.pagination.total;

    // Get all policies count and stats
    const allPolicies = await QosPolicy.findAll();
    const totalPolicies = allPolicies.length;

    // Get QoS stats
    const qosStats = await QosPolicy.getStats();

    // Get device stats
    const Device = require('../models/Device');
    const devicesResult = await Device.getAllDevices(1, 1);
    const totalDevices = devicesResult.pagination.total;

    // Get recent users (last 5)
    const recentUsersResult = await User.findAll(1, 5, {});
    const recentUsers = recentUsersResult.data;

    const stats = {
      users: {
        total: totalUsers,
        verified: activeUsers,
        unverified: unverifiedUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        admins: adminUsers,
        regularUsers: regularUsers,
        recent: recentUsers
      },
      configs: {
        total: configStats.total_configs || 0,
        active: configStats.active_configs || 0,
        revoked: configStats.revoked_configs || 0,
        downloaded: configStats.downloaded_configs || 0,
        users_with_configs: configStats.users_with_configs || 0
      },
      devices: {
        total: totalDevices,
        connected: totalDevices // All devices in the database are considered connected
      },
      policies: {
        total: totalPolicies,
        high_priority: qosStats.high_priority || 0,
        medium_priority: qosStats.medium_priority || 0,
        low_priority: qosStats.low_priority || 0,
        users_with_policies: qosStats.users_with_policies || 0
      },
      system: {
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error in getSystemStats:', error);
    next(error);
  }
};

/**
 * Get all VPN configurations with pagination
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 */
const getAllConfigs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    logger.info(`Admin ${req.user.email} retrieving configs list`, {
      page: pageNum,
      limit: limitNum
    });

    // Use existing ConfigFile.findAll method
    const result = await ConfigFile.findAll(pageNum, limitNum);

    res.json({
      success: true,
      data: {
        items: result.data,  // Frontend expects "items" for consistency
        pagination: result.pagination
      }
    });
  } catch (error) {
    logger.error('Error in getAllConfigs:', error);
    next(error);
  }
};

/**
 * Delete VPN configuration file
 */
const deleteConfig = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info(`Admin ${req.user.email} attempting to delete config ID: ${id}`);

    const config = await ConfigFile.findById(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }

    await ConfigFile.deleteById(id);

    logger.info(`Config ${id} deleted by admin ${req.user.email}`);

    res.json({
      success: true,
      message: 'Configuration deleted successfully'
    });
  } catch (error) {
    logger.error('Error in deleteConfig:', error);
    next(error);
  }
};

/**
 * Clean up expired verification tokens
 * Removes tokens that are past their expiration date
 */
const cleanupExpiredTokens = async (req, res, next) => {
  try {
    logger.info(`Admin ${req.user.email} initiating token cleanup`);

    const deletedCount = await VerificationToken.deleteExpired();

    logger.info(`Token cleanup complete. ${deletedCount} tokens removed`);

    res.json({
      success: true,
      message: 'Expired tokens cleaned up successfully',
      data: {
        deletedCount
      }
    });
  } catch (error) {
    logger.error('Error in cleanupExpiredTokens:', error);
    next(error);
  }
};

/**
 * Trigger password reset for a user (Admin only)
 * Generates a password reset token and sends reset email to the user
 */
const resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info(`Admin ${req.user.email} initiating password reset for user ID: ${id}`);

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from resetting their own password this way
    if (String(id) === String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Cannot reset your own password through admin panel. Use the regular password reset flow.'
      });
    }

    // Delete any existing password reset tokens for this user
    await PasswordResetToken.deleteByUserId(id);

    // Generate new password reset token
    const resetToken = generatePasswordResetToken();

    // Token expires in 24 hours (to match forgotPassword function)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Save token to database
    await PasswordResetToken.create(id, resetToken, expiresAt);

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(user.email, resetToken);

    if (!emailSent) {
      logger.warn(`Password reset token created but email failed for user ${user.email}`);
      return res.status(500).json({
        success: false,
        message: 'Password reset token generated, but failed to send email. Please check email configuration.'
      });
    }

    logger.info(`Password reset email sent to ${user.email} by admin ${req.user.email}`);

    res.json({
      success: true,
      message: `Password reset email has been sent to ${user.email}`,
      data: {
        email: user.email,
        expiresAt
      }
    });
  } catch (error) {
    logger.error('Error in resetUserPassword:', error);
    next(error);
  }
};

/**
 * Get all devices across all users with pagination
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
const getAllDevices = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    logger.info(`Admin ${req.user.email} retrieving devices list`, {
      page: pageNum,
      limit: limitNum
    });

    // Use Device.getAllDevices which joins with users table
    const result = await Device.getAllDevices(pageNum, limitNum);

    logger.debug('Result from Device.getAllDevices:', {
      resultKeys: Object.keys(result),
      dataType: typeof result.data,
      dataIsArray: Array.isArray(result.data),
      dataLength: result.data ? result.data.length : 'null/undefined',
      firstDevice: result.data && result.data[0] ? Object.keys(result.data[0]) : 'no devices'
    });

    const responseData = {
      success: true,
      data: {
        devices: result.data,
        pagination: result.pagination,
        totalPages: result.pagination.totalPages
      }
    };

    logger.debug('Sending devices response:', {
      deviceCount: result.data ? result.data.length : 0,
      totalPages: result.pagination.totalPages,
      responseKeys: Object.keys(responseData.data),
      devicesIsArray: Array.isArray(responseData.data.devices)
    });

    res.json(responseData);
  } catch (error) {
    logger.error('Error in getAllDevices:', error);
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getSystemStats,
  getAllConfigs,
  deleteConfig,
  cleanupExpiredTokens,
  resetUserPassword,
  getAllDevices
};
