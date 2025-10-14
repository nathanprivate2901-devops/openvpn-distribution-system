// Quick test to verify the authentication modules can be imported
const authController = require('./src/controllers/authController');
const authRoutes = require('./src/routes/authRoutes');

console.log('Testing module imports...\n');

// Check authController exports
console.log('authController exports:');
console.log('- register:', typeof authController.register);
console.log('- login:', typeof authController.login);
console.log('- verifyEmail:', typeof authController.verifyEmail);
console.log('- resendVerification:', typeof authController.resendVerification);
console.log('- getCurrentUser:', typeof authController.getCurrentUser);

console.log('\nauthRoutes type:', typeof authRoutes);
console.log('authRoutes is Express Router:', authRoutes.constructor.name === 'router');

console.log('\nAll modules imported successfully!');
