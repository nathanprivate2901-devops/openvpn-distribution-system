/**
 * OpenVPN Client Connect Service
 * 
 * Handles dynamic routing configuration when clients connect to OpenVPN.
 * Adds iroute directives for user's enabled LAN networks.
 * 
 * @module services/openvpnClientConnect
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const UserLanNetwork = require('../models/UserLanNetwork');
const User = require('../models/User');
const logger = require('../utils/logger');

class OpenVPNClientConnectService {
  constructor() {
    this.containerName = process.env.OPENVPN_CONTAINER_NAME || 'openvpn-server';
  }

  /**
   * Generate client-specific configuration for user's LAN networks
   * This is called when a client connects
   * 
   * @param {string} username - Username of connecting client
   * @returns {Promise<string>} Client-specific config directives
   */
  async generateClientConfig(username) {
    try {
      logger.info(`Generating client config for user: ${username}`);

      // Find user by email or username
      const user = await User.findOne({ 
        where: { 
          OR: [
            { email: username },
            { username: username }
          ]
        }
      });

      if (!user) {
        logger.warn(`User not found: ${username}`);
        return '';
      }

      // Get user's enabled LAN networks
      const networks = await UserLanNetwork.findByUserId(user.id, true);

      if (!networks || networks.length === 0) {
        logger.info(`No enabled LAN networks for user: ${username}`);
        return '';
      }

      // Generate iroute directives
      const configLines = [
        `# LAN Network Routes for ${username}`,
        `# Generated at ${new Date().toISOString()}`,
        ''
      ];

      for (const network of networks) {
        const description = network.description ? ` - ${network.description}` : '';
        configLines.push(`# ${network.network_cidr}${description}`);
        configLines.push(`iroute ${network.network_ip} ${network.subnet_mask}`);
      }

      configLines.push('');
      configLines.push(`# Total networks: ${networks.length}`);

      const config = configLines.join('\n');
      logger.info(`Generated client config for ${username} with ${networks.length} networks`);
      logger.debug(`Config:\n${config}`);

      return config;
    } catch (error) {
      logger.error('Error generating client config:', error);
      return '';
    }
  }

  /**
   * Update OpenVPN AS server routing configuration to include all LAN networks
   * This adds networks to the server's global routing table
   * 
   * @returns {Promise<boolean>} Success status
   */
  async updateServerRouting() {
    try {
      logger.info('Updating OpenVPN server routing configuration');

      // Get all enabled LAN networks from all users
      const allNetworks = await UserLanNetwork.findAll({ where: { enabled: true } });

      if (!allNetworks || allNetworks.length === 0) {
        logger.info('No enabled LAN networks to configure');
        return true;
      }

      // Group networks by CIDR to avoid duplicates
      const uniqueNetworks = new Map();
      for (const network of allNetworks) {
        uniqueNetworks.set(network.network_cidr, {
          ip: network.network_ip,
          mask: network.subnet_mask
        });
      }

      logger.info(`Found ${uniqueNetworks.size} unique LAN networks to configure`);

      // Get current routing configuration
      const currentConfig = this.execCommand(`sacli ConfigQuery | grep 'vpn.server.routing.private_network'`);
      logger.debug(`Current routing config:\n${currentConfig}`);

      // Clear existing private network configurations (except the VPN subnet)
      const vpnSubnet = '10.77.0.0/24'; // Keep the VPN's own subnet
      
      // Set the VPN subnet as network 0
      this.execCommand(`sacli --key "vpn.server.routing.private_network.0" --value "${vpnSubnet}" ConfigPut`);

      // Add each unique LAN network
      let index = 1;
      for (const [cidr, network] of uniqueNetworks) {
        const key = `vpn.server.routing.private_network.${index}`;
        const value = cidr;
        
        logger.info(`Setting ${key} = ${value}`);
        this.execCommand(`sacli --key "${key}" --value "${value}" ConfigPut`);
        index++;
      }

      // Apply configuration and restart OpenVPN
      logger.info('Applying configuration changes and restarting OpenVPN service');
      this.execCommand('sacli start');

      logger.info(`Successfully updated server routing with ${uniqueNetworks.size} LAN networks`);
      return true;
    } catch (error) {
      logger.error('Error updating server routing:', error);
      return false;
    }
  }

  /**
   * Execute command in OpenVPN container
   * 
   * @param {string} command - Command to execute
   * @returns {string} Command output
   * @throws {Error} If command fails
   */
  execCommand(command) {
    const fullCommand = `docker exec ${this.containerName} /bin/bash -c "${command}"`;
    logger.debug(`Executing: ${fullCommand}`);
    
    try {
      const output = execSync(fullCommand, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return output.trim();
    } catch (error) {
      logger.error(`Command failed: ${fullCommand}`);
      logger.error(`Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enable NAT for LAN network routing
   * This allows clients to access LAN networks through the VPN
   * 
   * @returns {Promise<boolean>} Success status
   */
  async enableNATRouting() {
    try {
      logger.info('Enabling NAT routing for LAN networks');

      // Set routing mode to NAT
      this.execCommand(`sacli --key "vpn.server.routing.private_access" --value "nat" ConfigPut`);

      // Enable inter-client routing
      this.execCommand(`sacli --key "vpn.client.routing.inter_client" --value "true" ConfigPut`);

      // Apply changes
      this.execCommand('sacli start');

      logger.info('NAT routing enabled successfully');
      return true;
    } catch (error) {
      logger.error('Error enabling NAT routing:', error);
      return false;
    }
  }

  /**
   * Initialize routing configuration on startup
   * 
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      logger.info('Initializing OpenVPN routing configuration');

      // Enable NAT routing
      await this.enableNATRouting();

      // Update server routing with all LAN networks
      await this.updateServerRouting();

      logger.info('OpenVPN routing initialization complete');
      return true;
    } catch (error) {
      logger.error('Error initializing OpenVPN routing:', error);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new OpenVPNClientConnectService();
