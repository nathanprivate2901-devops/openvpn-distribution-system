#!/usr/bin/env node
/**
 * Standalone user sync script
 * Runs on the host machine with direct Docker access
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const mysql = require('mysql2/promise');

const execAsync = promisify(exec);

const config = {
  container: 'openvpn-server',
  db: {
    host: 'localhost',
    port: 3306,
    user: 'openvpn_user',
    password: 'openvpn_secure_password_123',
    database: 'openvpn_system'
  }
};

async function sacli(command) {
  const { stdout } = await execAsync(`docker exec ${config.container} sacli ${command}`);
  try {
    return JSON.parse(stdout);
  } catch {
    return stdout.trim();
  }
}

async function getMySQLUsers() {
  const connection = await mysql.createConnection(config.db);
  const [rows] = await connection.execute(`
    SELECT id, username, email, name, role
    FROM users
    WHERE deleted_at IS NULL AND email_verified = 1 AND username IS NOT NULL
  `);
  await connection.end();
  return rows;
}

async function getOpenVPNUsers() {
  const result = await sacli('UserPropGet');
  return Object.keys(result).filter(u => u !== '__DEFAULT__');
}

async function createUser(username, email, name, role) {
  const tempPass = Math.random().toString(36).slice(-12) + 'Aa1!';
  console.log(`  Creating: ${username} (temp password: ${tempPass})`);

  await sacli(`--user "${username}" --new_pass "${tempPass}" SetLocalPassword`);
  await sacli(`--user "${username}" --key prop_email --value "${email}" UserPropPut`);
  await sacli(`--user "${username}" --key prop_c_name --value "${name}" UserPropPut`);

  if (role === 'admin') {
    await sacli(`--user "${username}" --key prop_superuser --value true UserPropPut`);
  }

  return { username, tempPassword: tempPass };
}

async function syncUsers() {
  console.log('\n🔄 Starting User Synchronization\n');

  const mysqlUsers = await getMySQLUsers();
  const openvpnUsers = await getOpenVPNUsers();

  console.log(`MySQL users: ${mysqlUsers.length}`);
  console.log(`OpenVPN users: ${openvpnUsers.length}\n`);

  const results = {
    created: [],
    updated: [],
    skipped: []
  };

  for (const user of mysqlUsers) {
    if (openvpnUsers.includes(user.username)) {
      console.log(`  ✓ Already exists: ${user.username}`);
      results.updated.push(user.username);
    } else {
      const result = await createUser(user.username, user.email, user.name, user.role);
      results.created.push(result);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Created: ${results.created.length}`);
  console.log(`  Already synced: ${results.updated.length}`);
  console.log(`  Total: ${mysqlUsers.length}`);

  if (results.created.length > 0) {
    console.log('\n🔑 Temporary Passwords (send to users):');
    results.created.forEach(({ username, tempPassword }) => {
      console.log(`  ${username}: ${tempPassword}`);
    });
  }

  console.log('\n✅ Sync completed!\n');
}

syncUsers().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
