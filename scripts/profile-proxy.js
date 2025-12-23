#!/usr/bin/env node

/**
 * OpenVPN Profile Generation Proxy Service
 *
 * This service runs on the HOST machine and provides an HTTP API
 * for generating OpenVPN profiles using sacli commands.
 *
 * It solves the Docker socket permission issue by running directly
 * on the host where Docker CLI has full access.
 *
 * Usage:
 *   node scripts/profile-proxy.js
 *
 * Environment Variables:
 *   PROFILE_PROXY_PORT - Port to listen on (default: 3001)
 *   OPENVPN_CONTAINER_NAME - OpenVPN container name (default: openvpn-server)
 */

const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const PORT = process.env.PROFILE_PROXY_PORT || 3001;
const CONTAINER_NAME = process.env.OPENVPN_CONTAINER_NAME || 'openvpn-server';

/**
 * Execute sacli command in OpenVPN container
 */
async function execSacli(command) {
  try {
    const { stdout, stderr } = await execAsync(
      `docker exec ${CONTAINER_NAME} sacli ${command}`
    );

    if (stderr && stderr.trim() && !stderr.includes('WARNING')) {
      console.warn('sacli stderr:', stderr);
    }

    const output = stdout.trim();

    // Clean up Docker exec output (remove ANSI codes)
    const cleanOutput = output.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

    return cleanOutput;
  } catch (error) {
    console.error('Error executing sacli:', error.message);
    throw error;
  }
}

/**
 * Check if user exists in OpenVPN
 */
async function userExists(username) {
  try {
    const output = await execSacli('UserPropGet');
    const users = JSON.parse(output);

    return Object.keys(users).includes(username);
  } catch (error) {
    console.error('Error checking user existence:', error.message);
    return false;
  }
}

/**
 * Generate userlogin profile
 */
async function generateUserloginProfile(username) {
  try {
    const profile = await execSacli(`--user "${username}" GetUserlogin`);
    return profile;
  } catch (error) {
    throw new Error(`Failed to generate userlogin profile: ${error.message}`);
  }
}

/**
 * Generate autologin profile
 */
async function generateAutologinProfile(username) {
  try {
    const profile = await execSacli(`--user "${username}" GetAutologin`);
    return profile;
  } catch (error) {
    throw new Error(`Failed to generate autologin profile: ${error.message}`);
  }
}

/**
 * HTTP request handler
 */
const server = http.createServer(async (req, res) => {
  // Enable CORS for backend container
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  console.log(`${new Date().toISOString()} - ${req.method} ${pathname}`);

  try {
    // Health check
    if (pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', container: CONTAINER_NAME }));
      return;
    }

    // Check user exists
    if (pathname === '/user/exists' && req.method === 'GET') {
      const username = url.searchParams.get('username');

      if (!username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing username parameter' }));
        return;
      }

      const exists = await userExists(username);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ exists }));
      return;
    }

    // Expose limited sacli operations for backend sync when requested
    // GET /sacli/userpropget -> returns full UserPropGet JSON/object
    if (pathname === '/sacli/userpropget' && req.method === 'GET') {
      try {
        const output = await execSacli('UserPropGet');
        // Try parse JSON, otherwise return raw stdout
        try {
          const parsed = JSON.parse(output);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ stdout: output }));
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // GET /sacli/vpnstatus -> returns VPN connection status
    if (pathname === '/sacli/vpnstatus' && req.method === 'GET') {
      try {
        const output = await execSacli('VPNStatus');
        // Try parse JSON, otherwise return raw stdout
        try {
          const parsed = JSON.parse(output);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ stdout: output }));
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // GET /sacli/clientinfo -> returns detailed client connection info with platform detection
    if (pathname === '/sacli/clientinfo' && req.method === 'GET') {
      try {
        const { stdout } = await execAsync(
          `docker exec ${CONTAINER_NAME} sqlite3 /openvpn/etc/db/log.db "SELECT username, real_ip, vpn_ip, platform, gui_version, version, common_name, start_time FROM log WHERE active=1;"`
        );
        
        // Parse the output into structured data
        const lines = stdout.trim().split('\n');
        const clients = lines.filter(line => line.trim()).map(line => {
          const [username, real_ip, vpn_ip, platform, gui_version, version, common_name, start_time] = line.split('|');
          return {
            username: username || '',
            real_ip: real_ip || '',
            vpn_ip: vpn_ip || '',
            platform: platform || 'unknown',
            gui_version: gui_version || '',
            version: version || '',
            common_name: common_name || '',
            start_time: start_time || ''
          };
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(clients));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // POST /sacli/user/:username/setpassword  { password }
    if (pathname.startsWith('/sacli/user/') && pathname.endsWith('/setpassword') && req.method === 'POST') {
      const parts = pathname.split('/');
      const username = decodeURIComponent(parts[3]);

      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { password } = JSON.parse(body);
          if (!password) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing password' }));
            return;
          }

          const result = await execSacli(`--user "${username}" --new_pass "${password}" SetLocalPassword`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ result }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // POST /sacli/user/:username/prop  { key, value }
    if (pathname.startsWith('/sacli/user/') && pathname.endsWith('/prop') && req.method === 'POST') {
      const parts = pathname.split('/');
      const username = decodeURIComponent(parts[3]);

      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { key, value } = JSON.parse(body);
          if (!key) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing key' }));
            return;
          }

          const result = await execSacli(`--user "${username}" --key ${key} --value "${value || ''}" UserPropPut`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ result }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // POST /sacli/user/:username/delall  -> delete user
    if (pathname.startsWith('/sacli/user/') && pathname.endsWith('/delall') && req.method === 'POST') {
      const parts = pathname.split('/');
      const username = decodeURIComponent(parts[3]);

      try {
        const result = await execSacli(`--user "${username}" UserPropDelAll`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Generate userlogin profile
    if (pathname === '/profile/userlogin' && req.method === 'POST') {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const { username } = JSON.parse(body);

          if (!username) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing username' }));
            return;
          }

          const profile = await generateUserloginProfile(username);

          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(profile);
        } catch (error) {
          console.error('Error generating userlogin profile:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // Generate autologin profile
    if (pathname === '/profile/autologin' && req.method === 'POST') {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const { username } = JSON.parse(body);

          if (!username) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing username' }));
            return;
          }

          const profile = await generateAutologinProfile(username);

          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(profile);
        } catch (error) {
          console.error('Error generating autologin profile:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // 404 - Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Start server
server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('OpenVPN Profile Generation Proxy Service');
  console.log('='.repeat(60));
  console.log(`Status: Running`);
  console.log(`Port: ${PORT}`);
  console.log(`Container: ${CONTAINER_NAME}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log('\nAvailable Endpoints:');
  console.log(`  GET  /health`);
  console.log(`  GET  /user/exists?username=<username>`);
  console.log(`  GET  /sacli/userpropget`);
  console.log(`  GET  /sacli/vpnstatus`);
  console.log(`  POST /profile/userlogin`);
  console.log(`  POST /profile/autologin`);
  console.log(`  POST /sacli/user/:username/setpassword`);
  console.log(`  POST /sacli/user/:username/prop`);
  console.log(`  POST /sacli/user/:username/delall`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down proxy service...');
  server.close(() => {
    console.log('Proxy service stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down proxy service...');
  server.close(() => {
    console.log('Proxy service stopped');
    process.exit(0);
  });
});
