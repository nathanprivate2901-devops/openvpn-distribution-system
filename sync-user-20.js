const openvpnUserSync = require('./src/services/openvpnUserSync');

async function syncUser20() {
  try {
    console.log('Starting sync for User ID 20...\n');
    
    // Set proxy environment variables
    process.env.PROFILE_PROXY_HOST = 'localhost';
    process.env.PROFILE_PROXY_PORT = '3001';
    
    // Sync single user
    const result = await openvpnUserSync.syncSingleUser(20);
    
    console.log('\n=== Sync Result ===\n');
    console.log('Action:', result.action);
    console.log('Username:', result.username);
    
    if (result.tempPassword) {
      console.log('\n⚠️  IMPORTANT: Temporary Password Generated ⚠️');
      console.log('Temp Password:', result.tempPassword);
      console.log('\nThe user should change this password on first login.');
    }
    
    console.log('\n✅ User ID 20 synced successfully to OpenVPN Access Server!');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

syncUser20();
