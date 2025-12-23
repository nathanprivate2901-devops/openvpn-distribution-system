// Test script to debug User.findAll issue
const User = require('./src/models/User');

async function test() {
  try {
    console.log('Testing User.findAll with empty filter...');
    const result1 = await User.findAll(1, 1, {});
    console.log('Result 1 SUCCESS:', result1.pagination);

    console.log('\nTesting User.findAll with email_verified=true filter...');
    const result2 = await User.findAll(1, 1, { email_verified: true });
    console.log('Result 2 SUCCESS:', result2.pagination);

    console.log('\nAll tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();
