const Docker = require('dockerode');
const pool = require('../config/database');
const logger = require('../utils/logger');

// Initialize Docker client with support for alternatives to direct socket
// Use DOCKER_HOST (e.g. tcp://docker-proxy:2375) for a socket proxy, or
// DOCKER_SOCKET_PATH to point to a custom socket. Fallback to default
// /var/run/docker.sock when running with direct socket access.
function createDockerClient() {
  const dockerHost = process.env.DOCKER_HOST;
  const socketPath = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';

  if (dockerHost) {
    logger.info('Creating Docker client using DOCKER_HOST', { dockerHost });
    // dockerode accepts a host/port via protocol in dockerHost
    return new Docker({ host: dockerHost });
  }

  try {
    logger.info('Creating Docker client using socketPath', { socketPath });
    return new Docker({ socketPath });
  } catch (err) {
    logger.error('Failed to create Docker client', err);
    // Re-throw to surface errors during initialization
    throw err;
  }
}

const docker = createDockerClient();

/**
 * OpenVPN Access Server User Synchronization Service
 * Syncs users from MySQL database to OpenVPN Access Server
 */
class OpenVPNUserSync {
  constructor() {
    this.containerName = process.env.OPENVPN_CONTAINER_NAME || 'openvpn-server';

    // If a profile proxy is available, use it for sacli operations instead of Docker exec
    // Parse PROFILE_PROXY_URL if it's a full URL, otherwise use individual HOST and PORT
    if (process.env.PROFILE_PROXY_URL) {
      try {
        const url = new URL(process.env.PROFILE_PROXY_URL);
        this.profileProxyHost = url.hostname;
        this.profileProxyPort = url.port || 3001;
        this.useProfileProxy = true;
      } catch (e) {
        // If parsing fails, treat it as a hostname
        this.profileProxyHost = process.env.PROFILE_PROXY_URL;
        this.profileProxyPort = process.env.PROFILE_PROXY_PORT || 3001;
        this.useProfileProxy = true;
      }
    } else {
      this.profileProxyHost = process.env.PROFILE_PROXY_HOST || 'host.docker.internal';
      this.profileProxyPort = process.env.PROFILE_PROXY_PORT || 3001;
      this.useProfileProxy = !!(process.env.PROFILE_PROXY_HOST || process.env.PROFILE_PROXY_PORT);
    }

    if (this.useProfileProxy) {
      logger.info('Using profile proxy for sacli operations', {
        profileProxyHost: this.profileProxyHost,
        profileProxyPort: this.profileProxyPort
      });
    }
  }

  /**
   * Execute sacli command in OpenVPN container
   * @param {string} command - sacli command to execute
   * @returns {Promise<Object>} Command result
   */
  async execSacli(command) {
    try {
      const fullCommand = `sacli ${command}`;
      logger.debug(`Executing sacli: ${fullCommand}`);

      // If we have a profile proxy configured, call it instead of docker exec
      if (this.useProfileProxy) {
        const http = require('http');
        const path = command.trim().toLowerCase() === 'userpropget' ? '/sacli/userpropget' : null;

        if (path) {
          const options = {
            hostname: this.profileProxyHost,
            port: this.profileProxyPort,
            path,
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          };

          return await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                try {
                  const parsed = JSON.parse(data);
                  resolve(parsed);
                } catch (e) {
                  resolve({ stdout: data });
                }
              });
            });
            req.on('error', (err) => {
              logger.error('Profile proxy request error:', err);
              reject(err);
            });
            req.end();
          });
        }
        // If command not mapped to proxy path, fallthrough to docker exec below
      }

      // Fallback to docker exec when proxy not configured or command not supported
      const container = docker.getContainer(this.containerName);

      const exec = await container.exec({
        Cmd: ['sh', '-c', fullCommand],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      let output = '';
      stream.on('data', (chunk) => { output += chunk.toString(); });
      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      try { return JSON.parse(output); } catch { return { stdout: output.trim() }; }
    } catch (error) {
      logger.error('Error executing sacli command:', error);
      throw error;
    }
  }

  /**
   * Set user password via proxy
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} Result
   */
  async setPasswordViaProxy(username, password) {
    const http = require('http');
    const postData = JSON.stringify({ password });

    const options = {
      hostname: this.profileProxyHost,
      port: this.profileProxyPort,
      path: `/sacli/user/${encodeURIComponent(username)}/setpassword`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ success: true });
          } else {
            reject(new Error(`Profile proxy returned status ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', (err) => {
        logger.error('Profile proxy request error:', err);
        reject(err);
      });
      req.write(postData);
      req.end();
    });
  }

  /**
   * Set user property via proxy
   * @param {string} username - Username
   * @param {string} key - Property key
   * @param {string} value - Property value
   * @returns {Promise<Object>} Result
   */
  async setUserPropViaProxy(username, key, value) {
    const http = require('http');
    const postData = JSON.stringify({ key, value });

    const options = {
      hostname: this.profileProxyHost,
      port: this.profileProxyPort,
      path: `/sacli/user/${encodeURIComponent(username)}/prop`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ success: true });
          } else {
            reject(new Error(`Profile proxy returned status ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', (err) => {
        logger.error('Profile proxy request error:', err);
        reject(err);
      });
      req.write(postData);
      req.end();
    });
  }

  /**
   * Get all users from MySQL database
   * @returns {Promise<Array>} Array of user objects
   */
  async getMySQLUsers() {
    try {
      const query = `
        SELECT id, username, email, password, name, role, email_verified
        FROM users
        WHERE deleted_at IS NULL AND email_verified = 1
      `;

      const [rows] = await pool.execute(query);
      logger.info(`Retrieved ${rows.length} verified users from MySQL`);

      return rows;
    } catch (error) {
      logger.error('Error fetching MySQL users:', error);
      throw error;
    }
  }

  /**
   * Get all users from OpenVPN Access Server
   * @returns {Promise<Array>} Array of OpenVPN usernames
   */
  async getOpenVPNUsers() {
    try {
      const result = await this.execSacli('UserPropGet');

      // Result is an object with usernames as keys
      const usernames = Object.keys(result);
      logger.info(`Retrieved ${usernames.length} users from OpenVPN AS`);

      return usernames;
    } catch (error) {
      logger.error('Error fetching OpenVPN users:', error);
      throw error;
    }
  }

  /**
   * Create user in OpenVPN Access Server
   * @param {string} username - Username
   * @param {string} password - Password (will be hashed by OpenVPN AS)
   * @param {Object} userData - Additional user data
   * @returns {Promise<Object>} Result
   */
  async createOpenVPNUser(username, password, userData = {}) {
    try {
      logger.info(`Creating OpenVPN user: ${username}`);

      // Create user with password
      // Note: We cannot set bcrypt hashed passwords directly in OpenVPN AS
      // We'll need to set a temporary password and notify the user to change it
      // OR use PAM authentication instead
      const tempPassword = this.generateTempPassword();

      // Set user password using proxy if available
      if (this.useProfileProxy) {
        await this.setPasswordViaProxy(username, tempPassword);
      } else {
        await this.execSacli(
          `--user "${username}" --new_pass "${tempPassword}" SetLocalPassword`
        );
      }

      // Set user properties
      if (userData.email) {
        if (this.useProfileProxy) {
          await this.setUserPropViaProxy(username, 'prop_email', userData.email);
        } else {
          await this.execSacli(
            `--user "${username}" --key prop_email --value "${userData.email}" UserPropPut`
          );
        }
      }

      if (userData.name) {
        if (this.useProfileProxy) {
          await this.setUserPropViaProxy(username, 'prop_c_name', userData.name);
        } else {
          await this.execSacli(
            `--user "${username}" --key prop_c_name --value "${userData.name}" UserPropPut`
          );
        }
      }

      // Set admin privileges if role is admin
      if (userData.role === 'admin') {
        if (this.useProfileProxy) {
          await this.setUserPropViaProxy(username, 'prop_superuser', 'true');
        } else {
          await this.execSacli(
            `--user "${username}" --key prop_superuser --value true UserPropPut`
          );
        }
      }

      logger.info(`OpenVPN user created: ${username}`);

      return {
        success: true,
        username,
        tempPassword, // Store this securely or send to user
        passwordResult: 'User created via proxy'
      };
    } catch (error) {
      logger.error(`Error creating OpenVPN user ${username}:`, error);
      throw error;
    }
  }

  /**
   * Update user in OpenVPN Access Server
   * @param {string} username - Username
   * @param {Object} userData - User data to update
   * @returns {Promise<Object>} Result
   */
  async updateOpenVPNUser(username, userData = {}) {
    try {
      logger.info(`Updating OpenVPN user: ${username}`);

      // Update user properties
      if (userData.email) {
        if (this.useProfileProxy) {
          await this.setUserPropViaProxy(username, 'prop_email', userData.email);
        } else {
          await this.execSacli(
            `--user "${username}" --key prop_email --value "${userData.email}" UserPropPut`
          );
        }
      }

      if (userData.name) {
        if (this.useProfileProxy) {
          await this.setUserPropViaProxy(username, 'prop_c_name', userData.name);
        } else {
          await this.execSacli(
            `--user "${username}" --key prop_c_name --value "${userData.name}" UserPropPut`
          );
        }
      }

      // Update admin privileges
      const isSuperuser = userData.role === 'admin';
      if (this.useProfileProxy) {
        await this.setUserPropViaProxy(username, 'prop_superuser', isSuperuser.toString());
      } else {
        await this.execSacli(
          `--user "${username}" --key prop_superuser --value ${isSuperuser} UserPropPut`
        );
      }

      logger.info(`OpenVPN user updated: ${username}`);

      return { success: true, username };
    } catch (error) {
      logger.error(`Error updating OpenVPN user ${username}:`, error);
      throw error;
    }
  }

  /**
   * Update OpenVPN user password
   * @param {string} username - Username
   * @param {string} plainPassword - Plain text password (not hashed)
   * @returns {Promise<Object>} Result
   */
  async updateOpenVPNPassword(username, plainPassword) {
    try {
      logger.info(`Updating OpenVPN password for user: ${username}`);

      // Use profile proxy if available
      if (this.useProfileProxy) {
        const http = require('http');
        const postData = JSON.stringify({ password: plainPassword });

        const options = {
          hostname: this.profileProxyHost,
          port: this.profileProxyPort,
          path: `/sacli/user/${encodeURIComponent(username)}/setpassword`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        return await new Promise((resolve, reject) => {
          const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              if (res.statusCode === 200) {
                logger.info(`OpenVPN password updated successfully for user: ${username}`);
                resolve({ success: true, username });
              } else {
                reject(new Error(`Profile proxy returned status ${res.statusCode}: ${data}`));
              }
            });
          });
          req.on('error', (err) => {
            logger.error('Profile proxy request error:', err);
            reject(err);
          });
          req.write(postData);
          req.end();
        });
      }

      // Fallback to direct Docker exec if no proxy
      await this.execSacli(
        `--user "${username}" --new_pass "${plainPassword}" SetLocalPassword`
      );

      logger.info(`OpenVPN password updated successfully for user: ${username}`);

      return { success: true, username };
    } catch (error) {
      logger.error(`Error updating OpenVPN password for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Delete user from OpenVPN Access Server
   * @param {string} username - Username
   * @returns {Promise<Object>} Result
   */
  async deleteOpenVPNUser(username) {
    try {
      logger.info(`Deleting OpenVPN user: ${username}`);

      const result = await this.execSacli(`--user "${username}" UserPropDelAll`);

      logger.info(`OpenVPN user deleted: ${username}`);

      return { success: true, username, result };
    } catch (error) {
      logger.error(`Error deleting OpenVPN user ${username}:`, error);
      throw error;
    }
  }

  /**
   * Generate temporary password for new users
   * @returns {string} Temporary password
   */
  generateTempPassword() {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return password;
  }

  /**
   * Sync all users from MySQL to OpenVPN Access Server
   * @param {Object} options - Sync options
   * @param {boolean} [options.dryRun=false] - If true, don't make changes
   * @param {boolean} [options.deleteOrphaned=false] - If true, delete OpenVPN users not in MySQL
   * @returns {Promise<Object>} Sync results
   */
  async syncUsers(options = {}) {
    const { dryRun = false, deleteOrphaned = false } = options;

    try {
      logger.info('Starting user synchronization...');

      const mysqlUsers = await this.getMySQLUsers();
      const openvpnUsers = await this.getOpenVPNUsers();

      const results = {
        created: [],
        updated: [],
        deleted: [],
        errors: [],
        skipped: []
      };

      // Create MySQL username map for quick lookup
      const mysqlUserMap = new Map();
      mysqlUsers.forEach(user => {
        mysqlUserMap.set(user.username, user);
      });

      // Process MySQL users
      for (const user of mysqlUsers) {
        if (!user.username) {
          logger.warn(`Skipping user ${user.id} - no username`);
          results.skipped.push({ id: user.id, reason: 'no username' });
          continue;
        }

        try {
          if (openvpnUsers.includes(user.username)) {
            // User exists, update
            if (!dryRun) {
              await this.updateOpenVPNUser(user.username, {
                email: user.email,
                name: user.name,
                role: user.role
              });
            }
            results.updated.push(user.username);
          } else {
            // User doesn't exist, create
            if (!dryRun) {
              const createResult = await this.createOpenVPNUser(
                user.username,
                null, // Password will be temp
                {
                  email: user.email,
                  name: user.name,
                  role: user.role
                }
              );
              results.created.push({
                username: user.username,
                tempPassword: createResult.tempPassword
              });
            } else {
              results.created.push(user.username);
            }
          }
        } catch (error) {
          logger.error(`Error syncing user ${user.username}:`, error);
          results.errors.push({
            username: user.username,
            error: error.message
          });
        }
      }

      // Delete orphaned OpenVPN users (if enabled)
      if (deleteOrphaned) {
        for (const openvpnUser of openvpnUsers) {
          if (!mysqlUserMap.has(openvpnUser)) {
            try {
              if (!dryRun) {
                await this.deleteOpenVPNUser(openvpnUser);
              }
              results.deleted.push(openvpnUser);
            } catch (error) {
              logger.error(`Error deleting orphaned user ${openvpnUser}:`, error);
              results.errors.push({
                username: openvpnUser,
                error: error.message
              });
            }
          }
        }
      }

      logger.info('User synchronization completed', {
        created: results.created.length,
        updated: results.updated.length,
        deleted: results.deleted.length,
        errors: results.errors.length,
        skipped: results.skipped.length
      });

      return results;
    } catch (error) {
      logger.error('Error during user synchronization:', error);
      throw error;
    }
  }

  /**
   * Sync single user from MySQL to OpenVPN Access Server
   * @param {number} userId - MySQL user ID
   * @returns {Promise<Object>} Sync result
   */
  async syncSingleUser(userId) {
    try {
      logger.info(`Syncing single user: ID ${userId}`);

      const query = `
        SELECT id, username, email, password, name, role, email_verified
        FROM users
        WHERE id = ? AND deleted_at IS NULL AND email_verified = 1
      `;

      const [rows] = await pool.execute(query, [userId]);

      if (rows.length === 0) {
        throw new Error(`User ${userId} not found or not verified`);
      }

      const user = rows[0];

      if (!user.username) {
        throw new Error(`User ${userId} has no username`);
      }

      const openvpnUsers = await this.getOpenVPNUsers();

      let result;
      if (openvpnUsers.includes(user.username)) {
        // Update existing user
        await this.updateOpenVPNUser(user.username, {
          email: user.email,
          name: user.name,
          role: user.role
        });
        result = { action: 'updated', username: user.username };
      } else {
        // Create new user
        const createResult = await this.createOpenVPNUser(
          user.username,
          null,
          {
            email: user.email,
            name: user.name,
            role: user.role
          }
        );
        result = {
          action: 'created',
          username: user.username,
          tempPassword: createResult.tempPassword
        };
      }

      logger.info(`User ${user.username} synced successfully`);

      return result;
    } catch (error) {
      logger.error(`Error syncing user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Remove user from OpenVPN when deleted from MySQL
   * @param {string} username - Username
   * @returns {Promise<Object>} Result
   */
  async removeUser(username) {
    try {
      return await this.deleteOpenVPNUser(username);
    } catch (error) {
      logger.error(`Error removing user ${username}:`, error);
      throw error;
    }
  }
}

module.exports = new OpenVPNUserSync();
