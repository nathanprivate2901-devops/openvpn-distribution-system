const openvpnProfileService = require('../services/openvpnProfileService');
const User = require('../models/User');
const ConfigFile = require('../models/ConfigFile');
const UserLanNetwork = require('../models/UserLanNetwork');
const { sendConfigGeneratedEmail } = require('../utils/emailService');
const logger = require('../utils/logger');

/**
 * VPN Profile Controller
 * Handles VPN profile generation and download
 */

/**
 * Download user's VPN profile
 * GET /api/vpn/profile/download
 */
exports.downloadProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user from database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.username) {
      return res.status(400).json({
        success: false,
        message: 'User does not have a username. Please contact administrator.'
      });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before downloading VPN profile'
      });
    }

    logger.info(`User ${user.username} (${user.email}) requesting VPN profile`);

    // Generate profile from OpenVPN AS
    const profile = await openvpnProfileService.getUserloginProfile(user.username);

    // Get user's enabled LAN networks and inject routes into profile
    let modifiedProfile = profile;
    try {
      const lanNetworks = await UserLanNetwork.findByUserId(userId, true); // Get enabled only
      if (lanNetworks && lanNetworks.length > 0) {
        logger.info(`Injecting ${lanNetworks.length} LAN network routes for user ${user.username}`);
        
        // Build route directives
        let routeSection = '\n# ============================================\n';
        routeSection += '# LAN Network Routes\n';
        routeSection += '# ============================================\n';
        routeSection += '# The following networks will be accessible through the VPN tunnel\n';
        
        lanNetworks.forEach(network => {
          if (network.description) {
            routeSection += `# ${network.description}: ${network.network_cidr}\n`;
          }
          routeSection += `route ${network.network_ip} ${network.subnet_mask}\n`;
        });
        
        routeSection += `# Total LAN networks configured: ${lanNetworks.length}\n`;
        routeSection += '# ============================================\n';
        
        // Inject routes after the push-peer-info directive (before certificates)
        const insertPoint = profile.indexOf('<ca>');
        if (insertPoint !== -1) {
          modifiedProfile = profile.substring(0, insertPoint) + routeSection + '\n' + profile.substring(insertPoint);
        } else {
          // Fallback: append at the end if <ca> not found
          modifiedProfile = profile + '\n' + routeSection;
        }
        
        logger.info(`LAN network routes injected successfully into profile for user ${user.username}`);
      }
    } catch (lanError) {
      logger.error('Failed to inject LAN network routes:', lanError);
      // Continue with original profile if LAN networks fail
      modifiedProfile = profile;
    }

    // Generate filename with timestamp
    const timestamp = Date.now();
    const filename = `${user.username}_${timestamp}.ovpn`;

    // Save profile to database for tracking
    try {
      await ConfigFile.create(
        userId,
        null, // No QoS policy for OpenVPN AS profiles
        filename,
        modifiedProfile
      );
      // Mark as downloaded immediately since user is downloading it now
      const configs = await ConfigFile.findByUserId(userId);
      const latestConfig = configs[0]; // Most recent one
      if (latestConfig && !latestConfig.downloaded_at) {
        await ConfigFile.markDownloaded(latestConfig.id);
      }
      logger.info(`VPN profile saved to database: ${filename} for user ${user.username}`);
    } catch (dbError) {
      logger.error('Failed to save profile to database:', dbError);
      // Continue with download even if database save fails
    }

    // Send email notification to user
    try {
      await sendConfigGeneratedEmail(user.email, filename, modifiedProfile);
      logger.info(`Profile notification email sent to ${user.email} with attachment`);
    } catch (emailError) {
      logger.error('Failed to send profile notification email:', emailError);
      // Continue with download even if email fails
    }

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/x-openvpn-profile');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(modifiedProfile));

    logger.info(`VPN profile downloaded successfully: ${filename}`);

    return res.send(modifiedProfile);
  } catch (error) {
    logger.error('Error downloading VPN profile:', error);

    if (error.message.includes('does not exist')) {
      return res.status(404).json({
        success: false,
        message: 'Your account is not synced to VPN server. Please contact administrator.',
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to generate VPN profile',
      error: error.message
    });
  }
};

/**
 * Get profile metadata (without downloading)
 * GET /api/vpn/profile/info
 */
exports.getProfileInfo = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user exists in OpenVPN
    const exists = await openvpnProfileService.userExists(user.username);

    return res.json({
      success: true,
      data: {
        username: user.username,
        email: user.email,
        emailVerified: user.email_verified,
        vpnAccountExists: exists,
        canDownload: user.email_verified && exists,
        profileType: 'userlogin',
        requiresPassword: true
      }
    });
  } catch (error) {
    logger.error('Error getting profile info:', error);
    next(error);
  }
};

/**
 * Download autologin profile (admin only)
 * GET /api/vpn/profile/autologin/:username
 */
exports.downloadAutologinProfile = async (req, res, next) => {
  try {
    const { username } = req.params;

    logger.info(`Admin requesting autologin profile for: ${username}`);

    // Generate autologin profile
    const profile = await openvpnProfileService.getAutologinProfile(username);

    const filename = `${username}_autologin.ovpn`;
    res.setHeader('Content-Type', 'application/x-openvpn-profile');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(profile));

    logger.info(`Autologin profile downloaded: ${filename}`);

    return res.send(profile);
  } catch (error) {
    logger.error('Error downloading autologin profile:', error);
    next(error);
  }
};

/**
 * Generate profile for specific user (admin only)
 * POST /api/vpn/profile/generate/:userId
 */
exports.generateUserProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { profileType = 'userlogin' } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.username) {
      return res.status(400).json({
        success: false,
        message: 'User does not have a username'
      });
    }

    logger.info(`Admin generating ${profileType} profile for user: ${user.username}`);

    const result = await openvpnProfileService.generateAndTrackProfile(
      userId,
      user.username
    );

    // Send email notification to user with attachment
    try {
      await sendConfigGeneratedEmail(user.email, result.metadata.filename, result.profile);
      logger.info(`Profile notification email sent to ${user.email} with attachment`);
    } catch (emailError) {
      logger.error('Failed to send profile notification email:', emailError);
      // Continue even if email fails
    }

    return res.json({
      success: true,
      message: 'Profile generated successfully',
      data: {
        username: user.username,
        filename: result.metadata.filename,
        size: result.metadata.size,
        type: result.metadata.type,
        generatedAt: result.metadata.generatedAt
      }
    });
  } catch (error) {
    logger.error('Error generating user profile:', error);
    next(error);
  }
};
