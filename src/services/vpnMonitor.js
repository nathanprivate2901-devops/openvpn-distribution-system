const axios = require('axios');
const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');

class VPNMonitorService {
  constructor() {
    this.monitorInterval = null;
    this.intervalMs = 60000; // Check every 60 seconds
    this.proxyUrl = process.env.PROFILE_PROXY_URL || 'http://host.docker.internal:3001';
  }

  /**
   * Get VPN status from OpenVPN Access Server via profile-proxy
   */
  async getVPNStatus() {
    try {
      const response = await axios.get(`${this.proxyUrl}/sacli/vpnstatus`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      logger.error('Error getting VPN status from proxy:', error.message);
      return null;
    }
  }

  /**
   * Get detailed client information including platform detection
   */
  async getClientInfo() {
    try {
      const response = await axios.get(`${this.proxyUrl}/sacli/clientinfo`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      logger.error('Error getting client info from proxy:', error.message);
      return [];
    }
  }

  /**
   * Parse VPN status and extract connected clients with platform info
   */
  async parseConnectedClients(vpnStatus) {
    const clients = [];

    if (!vpnStatus) return clients;

    // Get detailed client information with platform detection
    const clientsInfo = await this.getClientInfo();
    const clientInfoMap = {};
    
    // Create a map of client info by VPN IP address (more unique than real_ip)
    if (Array.isArray(clientsInfo)) {
      clientsInfo.forEach(info => {
        if (info.vpn_ip) {
          clientInfoMap[info.vpn_ip] = info;
        }
      });
    }

    // Iterate through all OpenVPN daemons
    Object.keys(vpnStatus).forEach(daemon => {
      const daemonData = vpnStatus[daemon];
      if (!daemonData.client_list || daemonData.client_list.length === 0) return;

      const headers = daemonData.client_list_header;

      daemonData.client_list.forEach(client => {
        const clientData = {
          username: client[headers['Username']],
          commonName: client[headers['Common Name']],
          realAddress: client[headers['Real Address']],
          virtualAddress: client[headers['Virtual Address']],
          connectedSince: client[headers['Connected Since']],
          bytesSent: parseInt(client[headers['Bytes Sent']] || 0),
          bytesReceived: parseInt(client[headers['Bytes Received']] || 0),
          cipher: client[headers['Data Channel Cipher']] || 'Unknown'
        };

        // Extract IP address from realAddress (format: "IP:PORT")
        const ipMatch = clientData.realAddress.match(/^([^:]+):/);
        if (ipMatch) {
          clientData.realIp = ipMatch[1];
          
          // Add platform information if available - match by VPN IP
          const info = clientInfoMap[clientData.virtualAddress];
          if (info) {
            clientData.platform = info.platform || 'unknown';
            clientData.guiVersion = info.gui_version || '';
            clientData.vpnVersion = info.version || '';
          }
        }

        clients.push(clientData);
      });
    });

    return clients;
  }

  /**
   * Detect device type from platform information
   */
  detectDeviceType(platform) {
    if (!platform) return 'desktop';
    
    const platformLower = platform.toLowerCase();
    
    // Map platform to device_type enum values
    if (platformLower.includes('android')) return 'mobile';
    if (platformLower.includes('ios') || platformLower.includes('iphone')) return 'mobile';
    if (platformLower.includes('ipad')) return 'tablet';
    if (platformLower.includes('mac')) return 'laptop';
    if (platformLower.includes('windows')) return 'desktop';
    if (platformLower.includes('linux')) return 'desktop';
    
    // Default to desktop for unknown platforms
    return 'desktop';
  }

  /**
   * Update or create device record for connected client
   */
  async updateDeviceFromConnection(client) {
    try {
      logger.debug(`Looking up user for VPN connection: ${client.username}`);
      
      // Get user ID from username
      const [users] = await pool.execute(
        'SELECT id FROM users WHERE email = ? OR username = ?',
        [client.username, client.username]
      );

      logger.debug(`User query returned ${users ? users.length : 0} results`);

      if (!users || users.length === 0) {
        logger.warn(`User not found for VPN connection: ${client.username}`);
        return;
      }

      const userId = users[0].id;
      logger.debug(`Found user ID: ${userId} for ${client.username}`);
      
      // Detect device type from platform information
      const deviceType = this.detectDeviceType(client.platform || 'unknown');
      const platformInfo = client.platform ? ` - ${client.platform}` : '';
      const deviceName = `${client.username}'s ${deviceType}${platformInfo} (${client.virtualAddress || client.realIp})`;
      
      // Use VPN IP (virtualAddress) as unique identifier since same user can have multiple devices from same real IP
      const uniqueDeviceKey = client.virtualAddress || client.realIp;
      
      logger.debug(`Device detection: platform=${client.platform}, type=${deviceType}, vpnIP=${client.virtualAddress}, guiVersion=${client.guiVersion}`);

      // Check if device already exists for this user and VPN IP
      const [existingDevices] = await pool.execute(
        'SELECT id FROM devices WHERE user_id = ? AND device_id = ?',
        [userId, uniqueDeviceKey]
      );

      if (existingDevices.length > 0) {
        // Update existing device with platform info
        await pool.execute(
          `UPDATE devices 
           SET last_connected = NOW(), 
               is_active = TRUE,
               device_type = ?,
               name = ?,
               last_ip = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [deviceType, deviceName, client.realIp, existingDevices[0].id]
        );
        logger.debug(`Updated device ${existingDevices[0].id} for user ${client.username} (${deviceType})`);
      } else {
        // Check if this VPN IP is assigned to a different user (VPN IP reuse)
        const [conflictingDevices] = await pool.execute(
          'SELECT id, user_id FROM devices WHERE device_id = ? AND user_id != ?',
          [uniqueDeviceKey, userId]
        );

        if (conflictingDevices.length > 0) {
          // VPN IP was reassigned from another user - delete old record
          logger.info(`VPN IP ${uniqueDeviceKey} reassigned from user ${conflictingDevices[0].user_id} to user ${userId}`);
          await pool.execute(
            'DELETE FROM devices WHERE id = ?',
            [conflictingDevices[0].id]
          );
        }

        // Create new device with VPN IP as device_id
        await pool.execute(
          `INSERT INTO devices (user_id, name, device_id, device_type, last_ip, last_connected, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), TRUE, NOW(), NOW())`,
          [userId, deviceName, uniqueDeviceKey, deviceType, client.realIp]
        );
        logger.info(`Created new device for user ${client.username} from IP ${client.realIp} (${deviceType})`);
      }
    } catch (error) {
      logger.error(`Error updating device for ${client.username}:`, error);
    }
  }

  /**
   * Mark devices as inactive if they're not in the active connections list
   */
  async markInactiveDevices(activeDeviceIds) {
    try {
      if (activeDeviceIds.length === 0) {
        // Mark all devices as inactive
        await pool.execute('UPDATE devices SET is_active = FALSE WHERE is_active = TRUE');
        return;
      }

      // Mark devices as inactive if their device_id is not in the active list
      const placeholders = activeDeviceIds.map(() => '?').join(',');
      await pool.execute(
        `UPDATE devices SET is_active = FALSE WHERE is_active = TRUE AND device_id NOT IN (${placeholders})`,
        activeDeviceIds
      );
    } catch (error) {
      logger.error('Error marking inactive devices:', error);
    }
  }

  /**
   * Main monitoring function
   */
  async monitor() {
    try {
      logger.debug('Checking VPN connections...');

      const vpnStatus = await this.getVPNStatus();
      if (!vpnStatus) {
        logger.warn('Failed to get VPN status');
        return;
      }

      const connectedClients = await this.parseConnectedClients(vpnStatus);
      logger.info(`Found ${connectedClients.length} active VPN connection(s)`);

      // Update device records for all connected clients
      const activeDeviceIds = [];
      for (const client of connectedClients) {
        await this.updateDeviceFromConnection(client);
        if (client.virtualAddress) {
          activeDeviceIds.push(client.virtualAddress);
        }
      }

      // Mark devices as inactive if they're no longer connected
      await this.markInactiveDevices(activeDeviceIds);

    } catch (error) {
      logger.error('Error in VPN monitor:', error);
    }
  }

  /**
   * Start the monitoring service
   */
  start() {
    if (this.monitorInterval) {
      logger.warn('VPN monitor is already running');
      return;
    }

    logger.info(`Starting VPN connection monitor (interval: ${this.intervalMs}ms)`);
    
    // Run immediately on start
    this.monitor();

    // Then run at intervals
    this.monitorInterval = setInterval(() => {
      this.monitor();
    }, this.intervalMs);
  }

  /**
   * Stop the monitoring service
   */
  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      logger.info('VPN connection monitor stopped');
    }
  }
}

module.exports = new VPNMonitorService();
