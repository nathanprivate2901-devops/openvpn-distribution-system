/**
 * Integration Examples - How to use utilities in your application
 *
 * This file demonstrates common integration patterns for the utility functions
 * in a real-world OpenVPN distribution system.
 */

const logger = require('./logger');
const {
  generateVerificationToken,
  generatePasswordResetToken
} = require('./tokenGenerator');
const {
  sendVerificationEmail,
  sendConfigGeneratedEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail
} = require('./emailService');

// ==============================================================================
// EXAMPLE 1: User Registration Flow
// ==============================================================================

async function registerNewUser(email, password) {
  logger.info('Starting user registration', { email });

  try {
    // 1. Generate verification token
    const verificationToken = generateVerificationToken();
    logger.debug('Verification token generated', { email });

    // 2. Hash password and save user to database
    // const hashedPassword = await bcrypt.hash(password, 10);
    // await db.users.create({
    //   email,
    //   password: hashedPassword,
    //   verificationToken: verificationToken,
    //   verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    // });

    logger.info('User created in database', { email });

    // 3. Send verification email
    const emailSent = await sendVerificationEmail(email, verificationToken);

    if (emailSent) {
      logger.info('Verification email sent successfully', { email });
      return {
        success: true,
        message: 'Registration successful. Please check your email to verify your account.'
      };
    } else {
      logger.warn('User registered but verification email failed', { email });
      return {
        success: true,
        message: 'Registration successful, but we could not send the verification email. Please contact support.'
      };
    }

  } catch (error) {
    logger.error('User registration failed', {
      email,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      message: 'Registration failed. Please try again later.'
    };
  }
}

// ==============================================================================
// EXAMPLE 2: Email Verification Flow
// ==============================================================================

async function verifyUserEmail(token) {
  logger.info('Processing email verification', { token: token.substring(0, 10) + '...' });

  try {
    // 1. Find user by token
    // const user = await db.users.findOne({
    //   where: {
    //     verificationToken: token,
    //     verificationTokenExpires: { $gt: new Date() }
    //   }
    // });

    // if (!user) {
    //   logger.warn('Invalid or expired verification token', { token });
    //   return { success: false, message: 'Invalid or expired verification link' };
    // }

    // 2. Update user as verified
    // await db.users.update(
    //   {
    //     email_verified: true,
    //     verificationToken: null,
    //     verificationTokenExpires: null
    //   },
    //   { where: { id: user.id } }
    // );

    logger.info('Email verified successfully', { userId: 'user.id' });

    return {
      success: true,
      message: 'Email verified successfully. You can now log in.'
    };

  } catch (error) {
    logger.error('Email verification failed', {
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      message: 'Verification failed. Please try again.'
    };
  }
}

// ==============================================================================
// EXAMPLE 3: Password Reset Request Flow
// ==============================================================================

async function requestPasswordReset(email) {
  logger.info('Password reset requested', { email });

  try {
    // 1. Check if user exists
    // const user = await db.users.findOne({ where: { email } });

    // if (!user) {
    //   // Don't reveal if user exists
    //   logger.warn('Password reset requested for non-existent user', { email });
    //   return {
    //     success: true,
    //     message: 'If that email exists, we sent a password reset link.'
    //   };
    // }

    // 2. Generate reset token
    const resetToken = generatePasswordResetToken();
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    logger.debug('Reset token generated', { email });

    // 3. Save reset token
    // await db.users.update(
    //   {
    //     resetToken: resetToken,
    //     resetTokenExpires: resetTokenExpires
    //   },
    //   { where: { id: user.id } }
    // );

    // 4. Send reset email
    const emailSent = await sendPasswordResetEmail(email, resetToken);

    if (emailSent) {
      logger.info('Password reset email sent', { email });
    } else {
      logger.error('Failed to send password reset email', { email });
    }

    return {
      success: true,
      message: 'If that email exists, we sent a password reset link.'
    };

  } catch (error) {
    logger.error('Password reset request failed', {
      email,
      error: error.message
    });

    return {
      success: false,
      message: 'Failed to process password reset request.'
    };
  }
}

// ==============================================================================
// EXAMPLE 4: Password Reset Completion Flow
// ==============================================================================

async function resetPassword(token, newPassword) {
  logger.info('Completing password reset', { token: token.substring(0, 10) + '...' });

  try {
    // 1. Find user by reset token
    // const user = await db.users.findOne({
    //   where: {
    //     resetToken: token,
    //     resetTokenExpires: { $gt: new Date() }
    //   }
    // });

    // if (!user) {
    //   logger.warn('Invalid or expired reset token', { token });
    //   return { success: false, message: 'Invalid or expired reset link' };
    // }

    // 2. Hash new password
    // const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3. Update password and clear reset token
    // await db.users.update(
    //   {
    //     password: hashedPassword,
    //     resetToken: null,
    //     resetTokenExpires: null
    //   },
    //   { where: { id: user.id } }
    // );

    logger.info('Password reset successful', { userId: 'user.id' });

    // 4. Send confirmation email
    // await sendPasswordChangedEmail(user.email);

    return {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    };

  } catch (error) {
    logger.error('Password reset failed', {
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      message: 'Failed to reset password. Please try again.'
    };
  }
}

// ==============================================================================
// EXAMPLE 5: OpenVPN Config Generation Flow
// ==============================================================================

async function generateVPNConfig(userId, email) {
  logger.info('Generating VPN configuration', { userId, email });

  try {
    // 1. Get user details and QoS policy
    // const user = await db.users.findByPk(userId, {
    //   include: ['qosPolicy']
    // });

    // if (!user) {
    //   logger.error('User not found for config generation', { userId });
    //   return { success: false, message: 'User not found' };
    // }

    // 2. Generate config file name
    const configName = `user_${userId}_vpn_${Date.now()}.ovpn`;

    // 3. Create OpenVPN configuration
    // const configContent = generateOpenVPNConfigContent(user);

    // 4. Save to database
    // await db.configFiles.create({
    //   userId: userId,
    //   fileName: configName,
    //   content: configContent,
    //   qosPolicyId: user.qosPolicy?.id
    // });

    logger.info('VPN config created', { userId, configName });

    // 5. Send notification email
    const emailSent = await sendConfigGeneratedEmail(email, configName);

    if (emailSent) {
      logger.info('Config notification email sent', { userId, email });
    } else {
      logger.warn('Config created but notification email failed', { userId });
    }

    return {
      success: true,
      configName: configName,
      message: 'VPN configuration generated successfully'
    };

  } catch (error) {
    logger.error('VPN config generation failed', {
      userId,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      message: 'Failed to generate VPN configuration'
    };
  }
}

// ==============================================================================
// EXAMPLE 6: Password Change Flow (User-Initiated)
// ==============================================================================

async function changePassword(userId, email, currentPassword, newPassword) {
  logger.info('Processing password change', { userId, email });

  try {
    // 1. Get user
    // const user = await db.users.findByPk(userId);

    // if (!user) {
    //   logger.error('User not found for password change', { userId });
    //   return { success: false, message: 'User not found' };
    // }

    // 2. Verify current password
    // const isValid = await bcrypt.compare(currentPassword, user.password);

    // if (!isValid) {
    //   logger.warn('Invalid current password provided', { userId });
    //   return { success: false, message: 'Current password is incorrect' };
    // }

    // 3. Hash new password
    // const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4. Update password
    // await db.users.update(
    //   { password: hashedPassword },
    //   { where: { id: userId } }
    // );

    logger.info('Password changed successfully', { userId });

    // 5. Send notification email
    const emailSent = await sendPasswordChangedEmail(email);

    if (emailSent) {
      logger.info('Password change notification sent', { userId });
    } else {
      logger.warn('Password changed but notification email failed', { userId });
    }

    return {
      success: true,
      message: 'Password changed successfully'
    };

  } catch (error) {
    logger.error('Password change failed', {
      userId,
      error: error.message
    });

    return {
      success: false,
      message: 'Failed to change password'
    };
  }
}

// ==============================================================================
// EXAMPLE 7: Express Route Integration
// ==============================================================================

// Example Express routes using the utilities

/*
const express = require('express');
const router = express.Router();

// Register route
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  const result = await registerNewUser(email, password);

  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

// Email verification route
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  const result = await verifyUserEmail(token);

  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
});

// Password reset request route
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  const result = await requestPasswordReset(email);

  res.status(200).json(result);
});

// Password reset completion route
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  const result = await resetPassword(token, newPassword);

  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
});

// VPN config generation route (requires authentication)
router.post('/generate-config', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const email = req.user.email;

  const result = await generateVPNConfig(userId, email);

  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(500).json(result);
  }
});

// Password change route (requires authentication)
router.post('/change-password', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const email = req.user.email;
  const { currentPassword, newPassword } = req.body;

  const result = await changePassword(userId, email, currentPassword, newPassword);

  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
});

module.exports = router;
*/

// ==============================================================================
// EXAMPLE 8: Error Handling with Logger
// ==============================================================================

function exampleErrorHandling() {
  try {
    // Some operation that might fail
    throw new Error('Something went wrong');
  } catch (error) {
    // Log the error with context
    logger.error('Operation failed', {
      operation: 'exampleErrorHandling',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Return user-friendly error
    return {
      success: false,
      message: 'An error occurred. Please try again later.'
    };
  }
}

// ==============================================================================
// EXAMPLE 9: Logging Best Practices
// ==============================================================================

function demonstrateLoggingBestPractices() {
  // 1. Debug level - detailed information for developers
  logger.debug('Function started', {
    function: 'demonstrateLoggingBestPractices',
    params: { example: 'data' }
  });

  // 2. Info level - general information about application flow
  logger.info('User action performed', {
    action: 'login',
    userId: 123,
    ipAddress: '192.168.1.1'
  });

  // 3. Warn level - something unusual but not critical
  logger.warn('Deprecated API used', {
    endpoint: '/api/old-endpoint',
    alternative: '/api/new-endpoint'
  });

  // 4. Error level - errors that need attention
  logger.error('Database query failed', {
    query: 'SELECT * FROM users',
    error: 'Connection timeout',
    retryCount: 3
  });

  // 5. Never log sensitive data
  // BAD: logger.info('User logged in', { password: 'secret123' });
  // GOOD: logger.info('User logged in', { userId: 123 });
}

// ==============================================================================
// EXPORTS (for testing)
// ==============================================================================

module.exports = {
  registerNewUser,
  verifyUserEmail,
  requestPasswordReset,
  resetPassword,
  generateVPNConfig,
  changePassword,
  exampleErrorHandling,
  demonstrateLoggingBestPractices
};

// ==============================================================================
// NOTES
// ==============================================================================

/*
INTEGRATION CHECKLIST:

1. Install dependencies:
   npm install winston nodemailer dotenv bcrypt

2. Configure environment:
   - Copy .env.example to .env
   - Set SMTP credentials
   - Set JWT_SECRET

3. Import utilities in your code:
   const logger = require('./utils/logger');
   const tokenGenerator = require('./utils/tokenGenerator');
   const emailService = require('./utils/emailService');

4. Replace database placeholders:
   - Uncomment database code
   - Update to match your database setup (Sequelize, raw MySQL, etc.)

5. Test the integration:
   - Run test suite: node src/utils/test-utils.js
   - Test with real email: node src/utils/test-utils.js your@email.com

6. Monitor logs:
   - tail -f logs/combined.log
   - tail -f logs/error.log

7. Security considerations:
   - Always hash passwords before storing
   - Never log sensitive data
   - Use environment variables for secrets
   - Implement rate limiting on email endpoints
   - Validate all user input

8. Performance tips:
   - Email sending is async and non-blocking
   - Logger uses async file writes
   - Token generation is very fast (< 1ms)
   - Consider queueing emails for high-volume applications

9. Production deployment:
   - Set NODE_ENV=production
   - Use strong SMTP credentials
   - Enable log rotation
   - Monitor error logs regularly
   - Set up alerting for critical errors
*/
