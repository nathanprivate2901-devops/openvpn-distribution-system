const db = require('../config/database');

/**
 * UserLanNetwork Model
 * Manages user-defined LAN networks for VPN routing
 * 
 * This model allows users to define custom LAN networks that should be
 * accessible when connected to the VPN. The networks are added as 
 * 'push route' directives in the OpenVPN configuration.
 */
class UserLanNetwork {
  /**
   * Create a new LAN network for a user
   * @param {number} userId - User ID
   * @param {string} networkCidr - Network in CIDR notation (e.g., 192.168.1.0/24)
   * @param {string} description - User-friendly description
   * @returns {Promise<Object>} Created network object
   */
  static async create(userId, networkCidr, description = null) {
    // Parse CIDR to extract IP and subnet mask
    const { networkIp, subnetMask } = this.parseCIDR(networkCidr);

    const result = await db.query(
      `INSERT INTO user_lan_networks 
       (user_id, network_cidr, network_ip, subnet_mask, description, enabled) 
       VALUES (?, ?, ?, ?, ?, 1)`,
      [userId, networkCidr, networkIp, subnetMask, description]
    );

    return {
      id: result.insertId,
      user_id: userId,
      network_cidr: networkCidr,
      network_ip: networkIp,
      subnet_mask: subnetMask,
      description,
      enabled: true
    };
  }

  /**
   * Find all LAN networks for a user
   * @param {number} userId - User ID
   * @param {boolean} enabledOnly - Return only enabled networks (default: false)
   * @returns {Promise<Array>} Array of network objects
   */
  static async findByUserId(userId, enabledOnly = false) {
    const query = enabledOnly
      ? `SELECT * FROM user_lan_networks WHERE user_id = ? AND enabled = 1 ORDER BY created_at DESC`
      : `SELECT * FROM user_lan_networks WHERE user_id = ? ORDER BY created_at DESC`;

    const rows = await db.query(query, [userId]);
    return rows;
  }

  /**
   * Find a specific LAN network by ID
   * @param {number} id - Network ID
   * @returns {Promise<Object|null>} Network object or null if not found
   */
  static async findById(id) {
    const rows = await db.query(
      'SELECT * FROM user_lan_networks WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Update a LAN network
   * @param {number} id - Network ID
   * @param {Object} updates - Fields to update (network_cidr, description, enabled)
   * @returns {Promise<boolean>} Success status
   */
  static async update(id, updates) {
    const allowedFields = ['network_cidr', 'description', 'enabled'];
    const updateFields = [];
    const values = [];

    // Build dynamic UPDATE query
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'network_cidr') {
          // Update network_cidr, network_ip, and subnet_mask together
          const { networkIp, subnetMask } = this.parseCIDR(value);
          updateFields.push('network_cidr = ?', 'network_ip = ?', 'subnet_mask = ?');
          values.push(value, networkIp, subnetMask);
        } else {
          updateFields.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    if (updateFields.length === 0) {
      return false;
    }

    values.push(id);
    const result = await db.query(
      `UPDATE user_lan_networks SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  /**
   * Delete a LAN network
   * @param {number} id - Network ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const result = await db.query(
      'DELETE FROM user_lan_networks WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Delete all LAN networks for a user
   * @param {number} userId - User ID
   * @returns {Promise<number>} Number of networks deleted
   */
  static async deleteByUserId(userId) {
    const result = await db.query(
      'DELETE FROM user_lan_networks WHERE user_id = ?',
      [userId]
    );
    return result.affectedRows;
  }

  /**
   * Toggle network enabled status
   * @param {number} id - Network ID
   * @param {boolean} enabled - New enabled status
   * @returns {Promise<boolean>} Success status
   */
  static async setEnabled(id, enabled) {
    const result = await db.query(
      'UPDATE user_lan_networks SET enabled = ? WHERE id = ?',
      [enabled ? 1 : 0, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Get statistics for a user's LAN networks
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Statistics object
   */
  static async getUserStats(userId) {
    const rows = await db.query(
      `SELECT 
        COUNT(*) as total_networks,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled_networks,
        SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as disabled_networks
       FROM user_lan_networks 
       WHERE user_id = ?`,
      [userId]
    );
    return rows[0];
  }

  /**
   * Get all LAN networks (admin function)
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 50)
   * @returns {Promise<Object>} Paginated results with networks and total count
   */
  static async findAll(page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const rows = await db.query(
      `SELECT ln.*, u.username, u.email 
       FROM user_lan_networks ln
       JOIN users u ON ln.user_id = u.id
       ORDER BY ln.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM user_lan_networks'
    );

    return {
      networks: rows,
      total: countResult[0].total,
      page,
      limit,
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  /**
   * Validate CIDR notation
   * @param {string} cidr - Network in CIDR notation
   * @returns {boolean} True if valid
   */
  static isValidCIDR(cidr) {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!cidrRegex.test(cidr)) {
      return false;
    }

    const [ip, prefix] = cidr.split('/');
    const octets = ip.split('.').map(Number);
    const prefixNum = parseInt(prefix, 10);

    // Validate IP octets (0-255)
    if (octets.some(octet => octet < 0 || octet > 255)) {
      return false;
    }

    // Validate prefix (0-32)
    if (prefixNum < 0 || prefixNum > 32) {
      return false;
    }

    return true;
  }

  /**
   * Parse CIDR notation to extract network IP and subnet mask
   * @param {string} cidr - Network in CIDR notation (e.g., 192.168.1.0/24)
   * @returns {Object} Object with networkIp and subnetMask
   * @throws {Error} If CIDR is invalid
   */
  static parseCIDR(cidr) {
    if (!this.isValidCIDR(cidr)) {
      throw new Error(`Invalid CIDR notation: ${cidr}`);
    }

    const [networkIp, prefix] = cidr.split('/');
    const prefixNum = parseInt(prefix, 10);

    // Convert prefix to subnet mask
    const mask = [];
    for (let i = 0; i < 4; i++) {
      const n = Math.min(prefixNum - (i * 8), 8);
      mask.push(256 - Math.pow(2, 8 - Math.max(n, 0)));
    }
    const subnetMask = mask.join('.');

    return { networkIp, subnetMask };
  }

  /**
   * Check if a network belongs to a specific user
   * @param {number} networkId - Network ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} True if network belongs to user
   */
  static async belongsToUser(networkId, userId) {
    const rows = await db.query(
      'SELECT id FROM user_lan_networks WHERE id = ? AND user_id = ?',
      [networkId, userId]
    );
    return rows.length > 0;
  }

  /**
   * Get commonly used private network ranges (for UI suggestions)
   * @returns {Array} Array of common network objects
   */
  static getCommonNetworks() {
    return [
      { cidr: '192.168.0.0/24', description: 'Home Network (Class C - 192.168.0.x)' },
      { cidr: '192.168.1.0/24', description: 'Home Network (Class C - 192.168.1.x)' },
      { cidr: '10.0.0.0/24', description: 'Office Network (Class A - 10.0.0.x)' },
      { cidr: '10.0.1.0/24', description: 'Office Network (Class A - 10.0.1.x)' },
      { cidr: '172.16.0.0/24', description: 'Private Network (Class B - 172.16.0.x)' },
      { cidr: '192.168.0.0/16', description: 'Large Home Network (All 192.168.x.x)' },
      { cidr: '10.0.0.0/8', description: 'Large Private Network (All 10.x.x.x)' }
    ];
  }
}

module.exports = UserLanNetwork;
