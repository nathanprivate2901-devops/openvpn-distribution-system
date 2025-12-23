const { User } = require('./src/models');
const { execSync } = require('child_process');
const fs = require('fs');

async function checkOpenVPNUser() {
  try {
    // Get user from database
    const user = await User.findById(16);
    
    if (!user) {
      console.log('User ID 16 not found in database');
      process.exit(1);
    }

    console.log('\n=== Database User Info ===\n');
    console.log('ID:', user.id);
    console.log('Username:', user.username);
    console.log('Email:', user.email);
    console.log('Name:', user.name);
    console.log('Email Verified:', user.email_verified ? 'Yes' : 'No');

    const username = user.username;

    if (!username) {
      console.log('\n❌ User has no username set, cannot check OpenVPN system');
      process.exit(0);
    }

    console.log('\n=== Checking OpenVPN System ===\n');

    // Check if user exists in OpenVPN Docker container
    try {
      const userCheck = execSync(
        `docker exec openvpn-server grep -E "^${username}:" /etc/pam.d/openvpn-users || echo "NOT_FOUND"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();

      if (userCheck === 'NOT_FOUND' || !userCheck) {
        console.log(`❌ User '${username}' NOT found in OpenVPN system (/etc/pam.d/openvpn-users)`);
      } else {
        console.log(`✅ User '${username}' FOUND in OpenVPN system`);
        console.log('Entry:', userCheck);
      }
    } catch (error) {
      if (error.message.includes('No such container')) {
        console.log('⚠️  OpenVPN container (openvpn-server) is not running');
      } else {
        console.log('❌ Error checking OpenVPN user file:', error.message);
      }
    }

    // Check for user's client configuration file
    console.log('\n=== Checking Client Configuration ===\n');
    const configPath = `./client-configs/${username}.ovpn`;
    
    if (fs.existsSync(configPath)) {
      console.log(`✅ Configuration file exists: ${configPath}`);
      const stats = fs.statSync(configPath);
      console.log('File size:', stats.size, 'bytes');
      console.log('Last modified:', stats.mtime);
    } else {
      console.log(`❌ Configuration file NOT found: ${configPath}`);
    }

    // Check for certificate files
    console.log('\n=== Checking Certificate Files ===\n');
    const certFiles = [
      `./pki/issued/${username}.crt`,
      `./pki/private/${username}.key`,
      `./pki/reqs/${username}.req`
    ];

    certFiles.forEach(certPath => {
      if (fs.existsSync(certPath)) {
        const stats = fs.statSync(certPath);
        console.log(`✅ ${certPath} (${stats.size} bytes, modified: ${stats.mtime.toISOString()})`);
      } else {
        console.log(`❌ ${certPath} - NOT FOUND`);
      }
    });

    // Check active connections (if OpenVPN status file exists)
    console.log('\n=== Checking Active Connections ===\n');
    try {
      const statusCheck = execSync(
        `docker exec openvpn-server cat /var/log/openvpn-status.log 2>/dev/null || echo "NO_STATUS"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );

      if (statusCheck.includes('NO_STATUS')) {
        console.log('⚠️  Status log not available');
      } else {
        const lines = statusCheck.split('\n');
        const userLine = lines.find(line => line.includes(username));
        
        if (userLine) {
          console.log(`✅ User '${username}' is CURRENTLY CONNECTED`);
          console.log('Connection info:', userLine);
        } else {
          console.log(`ℹ️  User '${username}' is not currently connected`);
        }
      }
    } catch (error) {
      console.log('⚠️  Could not check active connections:', error.message);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkOpenVPNUser();
