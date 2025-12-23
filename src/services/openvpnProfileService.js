const http = require('http');
const https = require('https');
const logger = require('../utils/logger');

/**
 * OpenVPN Profile Service
 * Generates VPN profiles via profile proxy service
 */
class OpenVPNProfileService {
  constructor() {
    // Profile proxy service configuration
    this.proxyHost = process.env.PROFILE_PROXY_HOST || 'host.docker.internal';
    this.proxyPort = process.env.PROFILE_PROXY_PORT || 3001;
    this.proxyUrl = `http://${this.proxyHost}:${this.proxyPort}`;
  }

  /**
   * Make HTTP request to proxy service
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {object} data - Request body (for POST)
   * @returns {Promise<string>} Response data
   */
  async makeProxyRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.proxyUrl);
      const protocol = url.protocol === 'https:' ? https : http;

      const options = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = protocol.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
          } else {
            try {
              const error = JSON.parse(responseData);
              reject(new Error(error.error || `HTTP ${res.statusCode}`));
            } catch {
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            }
          }
        });
      });

      req.on('error', (error) => {
        logger.error('Proxy request error:', error);
        reject(new Error(`Profile proxy unreachable: ${error.message}. Ensure profile-proxy.js is running on host.`));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * Check if user exists in OpenVPN
   * @param {string} username - Username
   * @returns {Promise<boolean>} True if user exists
   */
  async userExists(username) {
    try {
      const response = await this.makeProxyRequest('GET', `/user/exists?username=${encodeURIComponent(username)}`);
      const data = JSON.parse(response);
      return data.exists;
    } catch (error) {
      logger.error('Error checking if user exists:', error);
      return false;
    }
  }

  /**
   * Generate VPN profile for a user
   * @param {string} username - Username in OpenVPN AS
   * @param {string} profileType - 'userlogin' or 'autologin'
   * @returns {Promise<string>} OVPN profile content
   */
  async generateProfile(username, profileType = 'userlogin') {
    try {
      logger.info(`Generating ${profileType} profile for user: ${username}`);

      const endpoint = profileType === 'autologin' ? '/profile/autologin' : '/profile/userlogin';
      const profile = await this.makeProxyRequest('POST', endpoint, { username });

      if (!profile || profile.includes('ERROR')) {
        throw new Error(`Failed to generate profile: ${profile}`);
      }

      logger.info(`Profile generated successfully for: ${username}`);
      return profile;
    } catch (error) {
      logger.error(`Error generating profile for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Generate profile and save to database (optional)
   * @param {number} userId - User ID from database
   * @param {string} username - OpenVPN username
   * @returns {Promise<Object>} Profile metadata
   */
  async generateAndTrackProfile(userId, username) {
    try {
      const profile = await this.generateProfile(username, 'userlogin');

      const metadata = {
        userId,
        username,
        filename: `${username}_${Date.now()}.ovpn`,
        generatedAt: new Date(),
        size: Buffer.byteLength(profile, 'utf8'),
        type: 'userlogin'
      };

      logger.info('Profile generated with metadata:', metadata);

      return {
        profile,
        metadata
      };
    } catch (error) {
      logger.error('Error in generateAndTrackProfile:', error);
      throw error;
    }
  }

  /**
   * Get autologin profile (no password required)
   * Useful for automated connections
   * @param {string} username - Username
   * @returns {Promise<string>} OVPN profile
   */
  async getAutologinProfile(username) {
    return this.generateProfile(username, 'autologin');
  }

  /**
   * Get user login profile (requires password)
   * More secure, recommended for most users
   * @param {string} username - Username
   * @returns {Promise<string>} OVPN profile
   */
  async getUserloginProfile(username) {
    return this.generateProfile(username, 'userlogin');
  }

  /**
   * Generate profile with validation
   * @param {string} username - Username
   * @param {string} profileType - Profile type
   * @returns {Promise<string>} OVPN profile
   */
  async generateProfileSafe(username, profileType = 'userlogin') {
    // Check if user exists first
    const exists = await this.userExists(username);
    if (!exists) {
      throw new Error(`User ${username} does not exist in OpenVPN Access Server`);
    }

    return this.generateProfile(username, profileType);
  }
}

module.exports = new OpenVPNProfileService();
