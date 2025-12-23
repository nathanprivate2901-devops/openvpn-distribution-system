const bcrypt = require('bcrypt');
const User = require('../models/User');
const ConfigFile = require('../models/ConfigFile');
const QosPolicy = require('../models/QosPolicy');
const logger = require('../utils/logger');
const openvpnUserSync = require('../services/openvpnUserSync');

/**
 * Get user profile
 * @route GET /api/users/profile
 * @access Private
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Remove sensitive data
    delete user.password;

    // Ensure username field is populated (fallback to name if username is NULL)
    if (!user.username && user.name) {
      user.username = user.name;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Error getting profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile',
    });
  }
};

/**
 * Update user profile
 * @route PUT /api/users/profile
 * @access Private
 */
const updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;
    const updates = {};

    // Only include provided fields
    // Update both username and name columns for consistency
    if (username) {
      updates.username = username;
      updates.name = username;
    }
    if (email) updates.email = email;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    // Check if email already exists (if updating email)
    if (email && email !== req.user.email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use',
        });
      }
      // If email is changed, mark as unverified
      updates.email_verified = false;
    }

    // Check if username already exists (if updating username)
    if (username && username !== req.user.username) {
      const existingUser = await User.findByUsername(username);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(409).json({
          success: false,
          message: 'Username already in use',
        });
      }
    }

    const updatedUser = await User.updateProfile(req.user.id, updates);

    logger.info(`User ${req.user.id} updated profile`, { updates });

    // Ensure username field is populated in response (fallback to name if username is NULL)
    if (updatedUser && !updatedUser.username && updatedUser.name) {
      updatedUser.username = updatedUser.name;
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};

/**
 * Change password
 * @route PUT /api/users/password
 * @access Private
 *
 * SECURITY FIX: Now properly hashes new password before storing
 */
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Verify old password
    const isValidPassword = await User.verifyPassword(req.user.id, oldPassword);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Check if new password is same as old password
    if (oldPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
    }

    // SECURITY FIX: Hash the new password with bcrypt (12 rounds for better security)
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password with hashed version
    await User.updatePassword(req.user.id, hashedPassword);

    // Sync password to OpenVPN Access Server
    try {
      const user = await User.findById(req.user.id);
      if (user && user.username && user.email_verified) {
        await openvpnUserSync.updateOpenVPNPassword(user.username, newPassword);
        logger.info(`OpenVPN password synced for user: ${user.username}`);
      }
    } catch (syncError) {
      // Log but don't fail the password change if OpenVPN sync fails
      logger.error(`Failed to sync password to OpenVPN for user ID ${req.user.id}:`, syncError);
    }

    logger.info(`User ${req.user.id} changed password`);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
    });
  }
};

/**
 * Get user's VPN configs with pagination
 * @route GET /api/users/configs
 * @access Private
 */
const getConfigs = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters',
      });
    }

    // Get all configs for user
    const allConfigs = await ConfigFile.findByUserId(req.user.id);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedConfigs = allConfigs.slice(startIndex, endIndex);

    const result = {
      configs: paginatedConfigs,
      total: allConfigs.length,
      page,
      limit,
      totalPages: Math.ceil(allConfigs.length / limit),
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error getting configs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve configs',
    });
  }
};

/**
 * Get user dashboard statistics
 * @route GET /api/users/dashboard
 * @access Private
 */
const getDashboard = async (req, res) => {
  try {
    // Get user info
    const user = await User.findById(req.user.id);

    // Get user-specific config statistics using the new getUserStats method
    const configStats = await ConfigFile.getUserStats(req.user.id);

    // Get the latest config file for the user
    const latestConfig = await ConfigFile.findLatestByUserId(req.user.id);

    // Get assigned QoS policy
    const qosPolicy = await QosPolicy.findByUserId(req.user.id);

    // Build dashboard data
    const dashboardData = {
      user: {
        id: user.id,
        username: user.name,
        email: user.email,
        role: user.role,
        email_verified: user.email_verified,
        member_since: user.created_at,
      },
      stats: {
        total_configs: configStats.total_configs || 0,
        active_configs: configStats.active_configs || 0,
        revoked_configs: configStats.revoked_configs || 0,
        total_downloads: configStats.downloaded_configs || 0,
        latest_config: latestConfig || null,
      },
      qos_policy: qosPolicy
        ? {
            id: qosPolicy.id,
            policy_name: qosPolicy.policy_name,
            max_download_speed: qosPolicy.max_download_speed,
            max_upload_speed: qosPolicy.max_upload_speed,
            priority: qosPolicy.priority,
          }
        : null,
    };

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    logger.error('Error getting dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data',
    });
  }
};

/**
 * Soft delete user account
 * @route DELETE /api/users/account
 * @access Private
 */
const deleteAccount = async (req, res) => {
  try {
    // Soft delete the user
    await User.softDelete(req.user.id);

    logger.info(`User ${req.user.id} deleted their account`);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getConfigs,
  getDashboard,
  deleteAccount,
};
