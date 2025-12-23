#!/usr/bin/env node

/**
 * Test script for utility functions
 * Usage: node src/utils/test-utils.js [email]
 */

require('dotenv').config();
const logger = require('./logger');
const tokenGenerator = require('./tokenGenerator');
const emailService = require('./emailService');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function printHeader(title) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function printSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function printError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

function printInfo(message) {
  console.log(`${colors.blue}ℹ ${message}${colors.reset}`);
}

function printWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

// Test Logger
function testLogger() {
  printHeader('Testing Logger');

  try {
    logger.debug('Debug level log test');
    printSuccess('Debug log executed');

    logger.info('Info level log test', { testData: 'test123' });
    printSuccess('Info log executed');

    logger.warn('Warning level log test', { warningType: 'test' });
    printSuccess('Warning log executed');

    logger.error('Error level log test', { errorCode: 'TEST_ERROR' });
    printSuccess('Error log executed');

    printInfo('Check logs/combined.log for all logs');
    printInfo('Check logs/error.log for error logs');

    return true;
  } catch (error) {
    printError(`Logger test failed: ${error.message}`);
    return false;
  }
}

// Test Token Generator
function testTokenGenerator() {
  printHeader('Testing Token Generator');

  try {
    // Test verification token
    const verificationToken = tokenGenerator.generateVerificationToken();
    printSuccess(`Verification token generated: ${verificationToken.substring(0, 16)}...`);
    printInfo(`Length: ${verificationToken.length} characters`);

    // Test password reset token
    const resetToken = tokenGenerator.generatePasswordResetToken();
    printSuccess(`Password reset token generated: ${resetToken.substring(0, 16)}...`);

    // Test API key
    const apiKey = tokenGenerator.generateApiKey(32);
    printSuccess(`API key generated: ${apiKey.substring(0, 16)}...`);
    printInfo(`Length: ${apiKey.length} characters`);

    // Test random token
    const randomToken = tokenGenerator.generateRandomToken(8);
    printSuccess(`Random token (8 bytes) generated: ${randomToken}`);
    printInfo(`Length: ${randomToken.length} characters`);

    // Verify uniqueness
    const token1 = tokenGenerator.generateVerificationToken();
    const token2 = tokenGenerator.generateVerificationToken();

    if (token1 !== token2) {
      printSuccess('Tokens are unique (randomness verified)');
    } else {
      printError('Tokens are not unique!');
      return false;
    }

    return true;
  } catch (error) {
    printError(`Token generator test failed: ${error.message}`);
    return false;
  }
}

// Test Email Service
async function testEmailService(testEmail) {
  printHeader('Testing Email Service');

  // Check environment variables
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    printWarning('Email service not configured');
    printInfo(`Missing environment variables: ${missingVars.join(', ')}`);
    printInfo('Set these in your .env file to test email functionality');
    return false;
  }

  printInfo(`SMTP Host: ${process.env.SMTP_HOST}`);
  printInfo(`SMTP Port: ${process.env.SMTP_PORT}`);
  printInfo(`SMTP User: ${process.env.SMTP_USER}`);

  if (!testEmail) {
    printWarning('No test email address provided');
    printInfo('Usage: node src/utils/test-utils.js your-email@example.com');
    return false;
  }

  try {
    // Test email sending
    printInfo(`Sending test email to: ${testEmail}`);
    const success = await emailService.sendTestEmail(testEmail);

    if (success) {
      printSuccess('Test email sent successfully');
      printInfo('Check your inbox for the test email');
      return true;
    } else {
      printError('Failed to send test email');
      printInfo('Check logs/error.log for details');
      return false;
    }
  } catch (error) {
    printError(`Email service test failed: ${error.message}`);
    printInfo('Common issues:');
    printInfo('  - Incorrect SMTP credentials');
    printInfo('  - Firewall blocking SMTP port');
    printInfo('  - SMTP server requires TLS/SSL');
    printInfo('  - Gmail: Enable "App Passwords" if using 2FA');
    return false;
  }
}

// Test All Email Functions
async function testAllEmailFunctions(testEmail) {
  printHeader('Testing All Email Functions');

  if (!testEmail) {
    printWarning('Skipping email function tests (no email provided)');
    return false;
  }

  try {
    // Generate test tokens
    const verificationToken = tokenGenerator.generateVerificationToken();
    const resetToken = tokenGenerator.generatePasswordResetToken();

    // Test verification email
    printInfo('Testing verification email...');
    const verifySuccess = await emailService.sendVerificationEmail(testEmail, verificationToken);
    if (verifySuccess) {
      printSuccess('Verification email sent');
    } else {
      printError('Verification email failed');
    }

    // Wait 1 second between emails
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test config generated email
    printInfo('Testing config notification email...');
    const configSuccess = await emailService.sendConfigGeneratedEmail(testEmail, 'test_user_vpn.ovpn');
    if (configSuccess) {
      printSuccess('Config notification email sent');
    } else {
      printError('Config notification email failed');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test password changed email
    printInfo('Testing password changed email...');
    const passwordSuccess = await emailService.sendPasswordChangedEmail(testEmail);
    if (passwordSuccess) {
      printSuccess('Password changed email sent');
    } else {
      printError('Password changed email failed');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test password reset email
    printInfo('Testing password reset email...');
    const resetSuccess = await emailService.sendPasswordResetEmail(testEmail, resetToken);
    if (resetSuccess) {
      printSuccess('Password reset email sent');
    } else {
      printError('Password reset email failed');
    }

    printInfo('\nCheck your inbox for 4 test emails');
    return true;
  } catch (error) {
    printError(`Email function tests failed: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log(`${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║           OpenVPN Distribution System                      ║');
  console.log('║              Utility Functions Test Suite                  ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  const testEmail = process.argv[2];

  // Run tests
  const results = {
    logger: testLogger(),
    tokenGenerator: testTokenGenerator(),
    emailService: await testEmailService(testEmail)
  };

  // Test all email functions if basic email test passed
  if (results.emailService && testEmail) {
    results.allEmailFunctions = await testAllEmailFunctions(testEmail);
  }

  // Summary
  printHeader('Test Summary');

  const passed = Object.values(results).filter(r => r === true).length;
  const total = Object.keys(results).length;

  console.log(`\nResults: ${colors.green}${passed}${colors.reset} / ${total} tests passed\n`);

  Object.entries(results).forEach(([test, result]) => {
    const status = result ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
    console.log(`  ${status} - ${test}`);
  });

  console.log('\n');

  // Exit with appropriate code
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  printError(`Test runner failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
