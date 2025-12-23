const ConfigFile = require('../models/ConfigFile');
const QosPolicy = require('../models/QosPolicy');
const User = require('../models/User');
const UserLanNetwork = require('../models/UserLanNetwork');
const { sendConfigGeneratedEmail } = require('../utils/emailService');
const config = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Sanitize user-controlled values for safe inclusion in OpenVPN configuration files
 * Prevents template injection attacks by removing control characters and limiting length
 * @param {any} value - Value to sanitize
 * @returns {string} Sanitized string safe for OpenVPN config comments
 */
function sanitizeConfigValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    // Remove newlines, carriage returns, and tabs to prevent multi-line injection
    .replace(/[\r\n\t]/g, ' ')
    // Remove non-printable ASCII characters (keep only printable chars 0x20-0x7E)
    .replace(/[^\x20-\x7E]/g, '')
    // Remove OpenVPN directive characters that could be dangerous
    .replace(/[<>]/g, '')
    // Collapse multiple spaces into single space
    .replace(/\s+/g, ' ')
    // Trim whitespace from ends
    .trim()
    // Limit length to prevent DOS via extremely long comments
    .substring(0, 255);
}

/**
 * Generate OpenVPN configuration template
 * @param {Object} user - User object
 * @param {Object} qosPolicy - QoS policy object (can be null)
 * @param {Array} lanNetworks - Array of LAN network objects (can be empty)
 * @returns {string} OpenVPN configuration content
 */
function generateConfigTemplate(user, qosPolicy, lanNetworks = []) {
  const { openvpn } = config;

  // Sanitize all user-controlled values to prevent template injection
  const sanitizedEmail = sanitizeConfigValue(user.email);
  const sanitizedName = sanitizeConfigValue(user.name);

  // Base configuration
  let configContent = `client
dev tun
proto ${openvpn.protocol || 'udp'}
remote ${openvpn.server} ${openvpn.port}
resolv-retry infinite
nobind
persist-key
persist-tun
cipher AES-256-CBC
auth SHA256
comp-lzo
verb 3

# User: ${sanitizedEmail}
# Generated: ${new Date().toISOString()}
`;

  // Add QoS policy information as comments
  if (qosPolicy) {
    const sanitizedPolicyName = sanitizeConfigValue(qosPolicy.policy_name || qosPolicy.name || 'Default');
    const sanitizedPriority = sanitizeConfigValue(qosPolicy.priority || 'medium');
    const sanitizedMaxDownload = sanitizeConfigValue(qosPolicy.max_download_speed || qosPolicy.bandwidth_limit || 'unlimited');
    const sanitizedMaxUpload = sanitizeConfigValue(qosPolicy.max_upload_speed || qosPolicy.bandwidth_limit || 'unlimited');

    configContent += `
# QoS Policy: ${sanitizedPolicyName}
# Priority: ${sanitizedPriority}
# Max Download Speed: ${sanitizedMaxDownload} Kbps
# Max Upload Speed: ${sanitizedMaxUpload} Kbps
`;
  } else {
    configContent += `
# QoS Policy: None (Default)
# Priority: medium
# Bandwidth: Unlimited
`;
  }

  // Add LAN network routes
  if (lanNetworks && lanNetworks.length > 0) {
    configContent += `
# ============================================
# LAN Network Routes
# ============================================
# The following networks will be accessible through the VPN tunnel
`;
    
    const enabledNetworks = lanNetworks.filter(network => network.enabled);
    
    if (enabledNetworks.length > 0) {
      enabledNetworks.forEach(network => {
        const sanitizedDescription = sanitizeConfigValue(network.description || 'Custom Network');
        configContent += `# ${sanitizedDescription}: ${network.network_cidr}\n`;
        configContent += `route ${network.network_ip} ${network.subnet_mask}\n`;
      });
      
      configContent += `# Total LAN networks configured: ${enabledNetworks.length}\n`;
    } else {
      configContent += `# No enabled LAN networks configured\n`;
    }
    
    configContent += `# ============================================\n`;
  }

  // Add certificate placeholders
  configContent += `
<ca>
-----BEGIN CERTIFICATE-----
[CA_CERT_PLACEHOLDER]
Replace this with your Certificate Authority certificate
-----END CERTIFICATE-----
</ca>

<cert>
-----BEGIN CERTIFICATE-----
[CLIENT_CERT_PLACEHOLDER]
Replace this with user-specific client certificate
User: ${sanitizedEmail}
-----END CERTIFICATE-----
</cert>

<key>
-----BEGIN PRIVATE KEY-----
[CLIENT_KEY_PLACEHOLDER]
Replace this with user-specific private key
-----END PRIVATE KEY-----
</key>

<tls-auth>
-----BEGIN OpenVPN Static key V1-----
[TLS_AUTH_KEY_PLACEHOLDER]
Replace this with TLS authentication key
-----END OpenVPN Static key V1-----
</tls-auth>
`;

  return configContent;
}

/**
 * Generate OpenVPN configuration for user
 * POST /api/openvpn/generate-config
 */
exports.generateConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    logger.info(`Generating config for user: ${userEmail} (ID: ${userId})`);

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user's email is verified
    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Email must be verified before generating OpenVPN configuration'
      });
    }

    // Get user's assigned QoS policy (if any)
    let qosPolicy = null;
    try {
      qosPolicy = await QosPolicy.findByUserId(userId);
    } catch (error) {
      logger.warn(`No QoS policy found for user ${userId}, proceeding with default`);
    }

    // Get user's LAN networks (enabled only)
    let lanNetworks = [];
    try {
      lanNetworks = await UserLanNetwork.findByUserId(userId, true); // true = enabled only
      logger.info(`Found ${lanNetworks.length} enabled LAN networks for user ${userId}`);
    } catch (error) {
      logger.warn(`Error fetching LAN networks for user ${userId}, proceeding without networks:`, error.message);
    }

    // Generate configuration content
    const configContent = generateConfigTemplate(user, qosPolicy, lanNetworks);

    // Generate filename - sanitize username component
    const timestamp = Date.now();
    const username = user.username || user.email.split('@')[0];
    const sanitizedUsername = sanitizeConfigValue(username).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${sanitizedUsername}_${timestamp}.ovpn`;

    // Save configuration to database
    const configFile = await ConfigFile.create(
      userId,
      qosPolicy ? qosPolicy.id : null,
      filename,
      configContent
    );

    // Send email notification
    try {
      await sendConfigGeneratedEmail(user.email, filename, configContent);
      logger.info(`Config notification sent to ${user.email} with attachment`);
    } catch (emailError) {
      logger.error('Failed to send config notification email:', emailError);
      // Continue even if email fails
    }

    logger.info(`Config generated successfully: ${filename} for user ${userEmail}`);

    res.status(201).json({
      success: true,
      message: 'OpenVPN configuration generated successfully',
      data: {
        id: configFile.id,
        filename: filename,
        qos_policy: qosPolicy ? {
          name: qosPolicy.policy_name || qosPolicy.name,
          priority: qosPolicy.priority,
          bandwidth_limit: qosPolicy.max_download_speed || qosPolicy.bandwidth_limit
        } : null,
        created_at: configFile.created_at
      }
    });

  } catch (error) {
    logger.error('Error generating config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate OpenVPN configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all configuration files for authenticated user
 * GET /api/openvpn/configs
 */
exports.getUserConfigs = async (req, res) => {
  try {
    const userId = req.user.id;

    logger.info(`Fetching configs for user ID: ${userId}`);

    const configs = await ConfigFile.findByUserId(userId);

    // Filter out revoked configs and format response
    const activeConfigs = configs.filter(config => !config.revoked_at);

    res.status(200).json({
      success: true,
      message: 'Configuration files retrieved successfully',
      data: {
        total: activeConfigs.length,
        configs: activeConfigs.map(config => ({
          id: config.id,
          filename: config.filename,
          qos_policy: config.qos_policy_name ? {
            name: config.qos_policy_name,
            priority: config.priority,
            bandwidth_limit: config.bandwidth_limit
          } : null,
          downloaded_at: config.downloaded_at,
          created_at: config.created_at
        }))
      }
    });

  } catch (error) {
    logger.error('Error fetching user configs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve configuration files',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get latest configuration file for authenticated user
 * GET /api/openvpn/config/latest
 */
exports.getLatestConfig = async (req, res) => {
  try {
    const userId = req.user.id;

    logger.info(`Fetching latest config for user ID: ${userId}`);

    const configs = await ConfigFile.findActiveByUserId(userId);

    if (!configs || configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No configuration files found'
      });
    }

    // Get the most recent config
    const latestConfig = configs[0];

    res.status(200).json({
      success: true,
      message: 'Latest configuration retrieved successfully',
      data: {
        id: latestConfig.id,
        filename: latestConfig.filename,
        qos_policy: latestConfig.qos_policy_name ? {
          name: latestConfig.qos_policy_name,
          priority: latestConfig.priority,
          bandwidth_limit: latestConfig.bandwidth_limit
        } : null,
        downloaded_at: latestConfig.downloaded_at,
        created_at: latestConfig.created_at
      }
    });

  } catch (error) {
    logger.error('Error fetching latest config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve latest configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get configuration file info (metadata only, without content)
 * GET /api/openvpn/config/:id/info
 */
exports.getConfigInfo = async (req, res) => {
  try {
    const configId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(configId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration ID'
      });
    }

    logger.info(`Fetching config info: ${configId} for user ID: ${userId}`);

    const config = await ConfigFile.findById(configId);

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration file not found'
      });
    }

    // Check if config belongs to user or user is admin
    if (config.user_id !== userId && req.user.role !== 'admin') {
      logger.warn(`Unauthorized config access attempt by user ${userId} for config ${configId}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this configuration'
      });
    }

    // Check if config is revoked
    if (config.revoked_at) {
      return res.status(410).json({
        success: false,
        message: 'Configuration file has been revoked',
        data: {
          id: config.id,
          revoked_at: config.revoked_at
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Configuration info retrieved successfully',
      data: {
        id: config.id,
        filename: config.filename,
        qos_policy: config.qos_policy_name ? {
          name: config.qos_policy_name,
          priority: config.priority,
          bandwidth_limit: config.bandwidth_limit
        } : null,
        downloaded_at: config.downloaded_at,
        created_at: config.created_at,
        user: req.user.role === 'admin' ? {
          email: config.user_email,
          name: config.user_name
        } : undefined
      }
    });

  } catch (error) {
    logger.error('Error fetching config info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve configuration info',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Download configuration file
 * GET /api/openvpn/config/:id
 */
exports.downloadConfig = async (req, res) => {
  try {
    const configId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(configId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration ID'
      });
    }

    logger.info(`Downloading config: ${configId} for user ID: ${userId}`);

    const config = await ConfigFile.findById(configId);

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration file not found'
      });
    }

    // Check if config belongs to user or user is admin
    if (config.user_id !== userId && req.user.role !== 'admin') {
      logger.warn(`Unauthorized download attempt by user ${userId} for config ${configId}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to download this configuration'
      });
    }

    // Check if config is revoked
    if (config.revoked_at) {
      return res.status(410).json({
        success: false,
        message: 'Configuration file has been revoked and cannot be downloaded',
        data: {
          id: config.id,
          revoked_at: config.revoked_at
        }
      });
    }

    // Mark as downloaded if first download
    if (!config.downloaded_at) {
      try {
        await ConfigFile.markDownloaded(configId);
      } catch (markError) {
        logger.error('Failed to mark config as downloaded:', markError);
        // Continue with download even if marking fails
      }
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/x-openvpn-profile');
    res.setHeader('Content-Disposition', `attachment; filename="${config.filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(config.content));

    logger.info(`Config downloaded: ${config.filename} by user ${userId}`);

    res.status(200).send(config.content);

  } catch (error) {
    logger.error('Error downloading config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download configuration file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Revoke configuration file (soft delete)
 * DELETE /api/openvpn/config/:id
 */
exports.revokeConfig = async (req, res) => {
  try {
    const configId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(configId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration ID'
      });
    }

    logger.info(`Revoking config: ${configId} by user ID: ${userId}`);

    const config = await ConfigFile.findById(configId);

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration file not found'
      });
    }

    // Check if config belongs to user or user is admin
    if (config.user_id !== userId && req.user.role !== 'admin') {
      logger.warn(`Unauthorized revoke attempt by user ${userId} for config ${configId}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to revoke this configuration'
      });
    }

    // Check if already revoked
    if (config.revoked_at) {
      return res.status(400).json({
        success: false,
        message: 'Configuration file has already been revoked',
        data: {
          id: config.id,
          revoked_at: config.revoked_at
        }
      });
    }

    // Revoke the config
    await ConfigFile.revoke(configId);

    logger.info(`Config revoked successfully: ${configId} by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Configuration file revoked successfully',
      data: {
        id: configId,
        filename: config.filename,
        revoked_at: new Date()
      }
    });

  } catch (error) {
    logger.error('Error revoking config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke configuration file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
