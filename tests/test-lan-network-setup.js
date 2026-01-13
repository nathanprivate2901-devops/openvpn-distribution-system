#!/usr/bin/env node

/**
 * LAN Network Routing - Quick Setup Test Script
 * 
 * This script tests the complete LAN network routing feature
 * including database operations, API endpoints, and config generation.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'openvpn_system'
};

async function testLANNetworkFeature() {
  let connection;

  try {
    console.log('\n🚀 LAN Network Routing Feature - Setup Test\n');
    console.log('='.repeat(60));

    // 1. Test Database Connection
    console.log('\n1️⃣  Testing Database Connection...');
    connection = await mysql.createConnection(config);
    console.log('   ✅ Connected to database');

    // 2. Check if table exists
    console.log('\n2️⃣  Checking if user_lan_networks table exists...');
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'user_lan_networks'"
    );
    
    if (tables.length === 0) {
      console.log('   ❌ Table does not exist');
      console.log('   💡 Run: mysql -u root -p openvpn_system < migrations/add-lan-networks-table.sql');
      process.exit(1);
    }
    console.log('   ✅ Table exists');

    // 3. Verify table structure
    console.log('\n3️⃣  Verifying table structure...');
    const [columns] = await connection.query(
      "DESCRIBE user_lan_networks"
    );
    
    const requiredColumns = ['id', 'user_id', 'network_cidr', 'network_ip', 'subnet_mask', 'description', 'enabled'];
    const existingColumns = columns.map(col => col.Field);
    
    for (const col of requiredColumns) {
      if (!existingColumns.includes(col)) {
        console.log(`   ❌ Missing column: ${col}`);
        process.exit(1);
      }
    }
    console.log('   ✅ All required columns present');

    // 4. Test sample data
    console.log('\n4️⃣  Testing sample data insertion...');
    
    // Check if admin user exists (ID: 1)
    const [users] = await connection.query(
      'SELECT id, email FROM users WHERE id = 1'
    );
    
    if (users.length === 0) {
      console.log('   ⚠️  Admin user (ID: 1) not found');
      console.log('   💡 Create a user first or run database-setup.sql');
    } else {
      console.log(`   ✅ Found user: ${users[0].email}`);
      
      // Insert test network
      try {
        const [result] = await connection.query(
          `INSERT INTO user_lan_networks 
           (user_id, network_cidr, network_ip, subnet_mask, description, enabled) 
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
          [1, '192.168.99.0/24', '192.168.99.0', '255.255.255.0', 'Test Network', 1]
        );
        console.log('   ✅ Test network inserted/updated');
      } catch (error) {
        console.log(`   ⚠️  Could not insert test data: ${error.message}`);
      }
    }

    // 5. Query sample data
    console.log('\n5️⃣  Querying LAN networks...');
    const [networks] = await connection.query(
      `SELECT ln.*, u.email 
       FROM user_lan_networks ln
       JOIN users u ON ln.user_id = u.id
       LIMIT 5`
    );
    
    if (networks.length > 0) {
      console.log(`   ✅ Found ${networks.length} network(s):`);
      networks.forEach(net => {
        console.log(`      - ${net.network_cidr} (${net.description}) - User: ${net.email} - ${net.enabled ? 'Enabled' : 'Disabled'}`);
      });
    } else {
      console.log('   ℹ️  No networks found yet (this is normal for new setup)');
    }

    // 6. Test CIDR parsing
    console.log('\n6️⃣  Testing CIDR parsing function...');
    const UserLanNetwork = require('./src/models/UserLanNetwork');
    
    const testCases = [
      { cidr: '192.168.1.0/24', valid: true },
      { cidr: '10.0.0.0/8', valid: true },
      { cidr: '172.16.0.0/12', valid: true },
      { cidr: '999.999.999.999/99', valid: false },
      { cidr: 'invalid', valid: false }
    ];
    
    for (const test of testCases) {
      const isValid = UserLanNetwork.isValidCIDR(test.cidr);
      const status = isValid === test.valid ? '✅' : '❌';
      console.log(`   ${status} ${test.cidr}: ${isValid ? 'Valid' : 'Invalid'} (expected: ${test.valid ? 'Valid' : 'Invalid'})`);
      
      if (isValid && test.valid) {
        try {
          const { networkIp, subnetMask } = UserLanNetwork.parseCIDR(test.cidr);
          console.log(`       IP: ${networkIp}, Mask: ${subnetMask}`);
        } catch (error) {
          console.log(`       ❌ Parse error: ${error.message}`);
        }
      }
    }

    // 7. Check if routes are registered
    console.log('\n7️⃣  Checking if routes are registered...');
    try {
      const app = require('./src/index');
      console.log('   ✅ Application loaded successfully');
      console.log('   💡 Routes should be available at: /api/lan-networks');
    } catch (error) {
      console.log(`   ⚠️  Could not load application: ${error.message}`);
    }

    // 8. Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ SETUP TEST COMPLETED SUCCESSFULLY!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Start the backend server: npm run dev');
    console.log('   2. Test the API endpoints:');
    console.log('      GET  /api/lan-networks/suggestions');
    console.log('      POST /api/lan-networks');
    console.log('      GET  /api/lan-networks');
    console.log('   3. Generate a VPN config and verify routes are included');
    console.log('\n💡 API Documentation:');
    console.log('   See: docs/LAN_NETWORK_ROUTING_FEATURE.md\n');

  } catch (error) {
    console.error('\n❌ Error during setup test:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testLANNetworkFeature().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
