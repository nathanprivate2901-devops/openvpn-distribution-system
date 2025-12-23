/**
 * Configuration Test Script
 *
 * Tests both environment.js and database.js modules to ensure
 * they are properly configured and working.
 *
 * Run with: node src/config/test-config.js
 */

console.log('='.repeat(60));
console.log('Configuration Module Test');
console.log('='.repeat(60));

// Test 1: Environment Configuration
console.log('\n[TEST 1] Loading environment configuration...');
try {
  const config = require('./environment');

  console.log('✓ Environment module loaded successfully');
  console.log('\nConfiguration Summary:');
  console.log(`  - Environment: ${config.nodeEnv}`);
  console.log(`  - Port: ${config.port}`);
  console.log(`  - JWT Secret: ${config.jwtSecret.substring(0, 10)}... (hidden)`);
  console.log(`  - Database Host: ${config.database.host}`);
  console.log(`  - Database Name: ${config.database.database}`);
  console.log(`  - Connection Limit: ${config.database.connectionLimit}`);
  console.log(`  - SMTP Host: ${config.smtp.host}`);
  console.log(`  - OpenVPN Server: ${config.openvpn.server}`);
  console.log(`  - Rate Limit: ${config.rateLimit.maxRequests} requests per ${config.rateLimit.windowMs}ms`);

  // Test environment helpers
  console.log('\nEnvironment Helpers:');
  console.log(`  - isProduction(): ${config.isProduction()}`);
  console.log(`  - isDevelopment(): ${config.isDevelopment()}`);
  console.log(`  - isTest(): ${config.isTest()}`);

  console.log('\n✓ Environment configuration test passed');
} catch (error) {
  console.error('✗ Environment configuration test failed:', error.message);
  process.exit(1);
}

// Test 2: Database Configuration
console.log('\n[TEST 2] Loading database configuration...');
try {
  const db = require('./database');

  console.log('✓ Database module loaded successfully');

  // Test 3: Database Connection
  console.log('\n[TEST 3] Testing database connection...');

  const { testConnection, getPoolStats } = require('./database');

  testConnection()
    .then(() => {
      console.log('✓ Database connection test passed');

      // Test 4: Pool Statistics
      console.log('\n[TEST 4] Getting pool statistics...');
      const stats = getPoolStats();

      console.log('Pool Statistics:');
      console.log(`  - Status: ${stats.status}`);
      console.log(`  - Active Connections: ${stats.activeConnections}`);
      console.log(`  - Idle Connections: ${stats.idleConnections}`);
      console.log(`  - Total Connections: ${stats.totalConnections}`);
      console.log(`  - Connection Limit: ${stats.connectionLimit}`);

      console.log('\n✓ Pool statistics test passed');

      // Test 5: Query Function
      console.log('\n[TEST 5] Testing query function...');
      const { query } = require('./database');

      query('SELECT 1 + 1 AS result')
        .then((rows) => {
          console.log('✓ Query executed successfully');
          console.log(`  Result: ${JSON.stringify(rows)}`);

          console.log('\n' + '='.repeat(60));
          console.log('ALL TESTS PASSED');
          console.log('='.repeat(60));
          console.log('\nConfiguration modules are ready for use!');

          // Close pool and exit
          const { closePool } = require('./database');
          closePool()
            .then(() => {
              console.log('\n✓ Database pool closed successfully');
              process.exit(0);
            })
            .catch((err) => {
              console.error('✗ Error closing pool:', err.message);
              process.exit(1);
            });
        })
        .catch((error) => {
          console.error('✗ Query test failed:', error.message);
          console.error('\nPossible issues:');
          console.error('  - MySQL server is not running');
          console.error('  - Database credentials are incorrect');
          console.error('  - Database does not exist');
          console.error('  - Network connectivity issues');

          const { closePool } = require('./database');
          closePool().finally(() => process.exit(1));
        });
    })
    .catch((error) => {
      console.error('✗ Database connection test failed:', error.message);
      console.error('\nPossible issues:');
      console.error('  - MySQL server is not running');
      console.error('  - Database credentials are incorrect');
      console.error('  - Firewall blocking connection');
      console.error('  - Wrong host or port');

      const { closePool } = require('./database');
      closePool().finally(() => process.exit(1));
    });
} catch (error) {
  console.error('✗ Database configuration test failed:', error.message);
  console.error('\nError details:', error.stack);
  process.exit(1);
}
