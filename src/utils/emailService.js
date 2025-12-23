const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create reusable transporter object using SMTP transport
let transporter = null;

/**
 * Validate and sanitize email address to prevent header injection attacks
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if email is valid and safe
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Check for newlines and carriage returns (header injection attack vectors)
  if (/[\r\n]/.test(email)) {
    logger.warn('Email validation failed: contains newline characters', { email });
    return false;
  }

  // Check for null bytes
  if (email.includes('\0')) {
    logger.warn('Email validation failed: contains null bytes', { email });
    return false;
  }

  // Basic email format validation (RFC 5322 simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    logger.warn('Email validation failed: invalid format', { email });
    return false;
  }

  // Check reasonable length (RFC 5321 max is 254)
  if (email.length > 254) {
    logger.warn('Email validation failed: too long', { email });
    return false;
  }

  // Check for suspicious patterns that might indicate injection attempts
  const suspiciousPatterns = [
    /bcc:/i,
    /cc:/i,
    /to:/i,
    /from:/i,
    /subject:/i,
    /content-type:/i,
    /mime-version:/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(email)) {
      logger.warn('Email validation failed: suspicious pattern detected', { email, pattern: pattern.toString() });
      return false;
    }
  }

  return true;
};

/**
 * Sanitize email address by removing potentially dangerous characters
 * @param {string} email - Email address to sanitize
 * @returns {string} - Sanitized email address
 */
const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return '';
  }

  // Remove any whitespace
  email = email.trim();

  // Remove any control characters
  email = email.replace(/[\x00-\x1F\x7F]/g, '');

  return email;
};

/**
 * Validate email before sending, with security logging
 * @param {string} email - Email address to validate
 * @param {string} context - Context for logging (e.g., 'verification', 'config_generated')
 * @returns {boolean} - True if email is valid
 */
const validateEmailForSending = (email, context) => {
  const sanitized = sanitizeEmail(email);

  if (!validateEmail(sanitized)) {
    logger.error('Email validation failed - potential security issue', {
      context,
      originalEmail: email,
      sanitizedEmail: sanitized
    });
    return false;
  }

  return true;
};

/**
 * Initialize email transporter
 */
const initializeTransporter = () => {
  try {
    // Skip initialization if already created
    if (transporter) {
      return transporter;
    }

    // Validate required environment variables
    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      logger.warn('Missing email configuration', { missingVars: missing });
      return null;
    }

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false'
      }
    });

    logger.info('Email transporter initialized', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER
    });

    return transporter;
  } catch (error) {
    logger.error('Failed to initialize email transporter', {
      error: error.message,
      stack: error.stack
    });
    return null;
  }
};

/**
 * Send verification email to new users
 * @param {string} email - Recipient email address
 * @param {string} token - Verification token
 * @returns {Promise<boolean>} - True if sent successfully
 */
const sendVerificationEmail = async (email, token) => {
  try {
    // Validate and sanitize email address
    const sanitizedEmail = sanitizeEmail(email);
    if (!validateEmailForSending(sanitizedEmail, 'verification')) {
      logger.error('Attempted to send verification email to invalid address', { email });
      return false;
    }

    const transport = initializeTransporter();

    if (!transport) {
      logger.error('Email transporter not configured, skipping verification email');
      return false;
    }

    const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || 'http://dree.asuscomm.com:3000';
    const verificationUrl = `${backendUrl}/api/auth/verify-email?token=${token}`;
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const appName = process.env.APP_NAME || 'OpenVPN Distribution System';

    const mailOptions = {
      from: `"${appName}" <${fromEmail}>`,
      to: sanitizedEmail,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
            .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${appName}</h1>
            </div>
            <div class="content">
              <h2>Welcome!</h2>
              <p>Thank you for registering. Please verify your email address to activate your account.</p>

              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </p>

              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background-color: #fff; padding: 10px; border: 1px solid #ddd;">
                ${verificationUrl}
              </p>

              <div class="warning">
                <strong>Note:</strong> This verification link will expire in 24 hours.
              </div>

              <p>If you didn't create an account, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to ${appName}!

        Thank you for registering. Please verify your email address to activate your account.

        Verification Link: ${verificationUrl}

        This link will expire in 24 hours.

        If you didn't create an account, please ignore this email.
      `
    };

    await transport.sendMail(mailOptions);

    logger.info('Verification email sent successfully', { email: sanitizedEmail });

    return true;
  } catch (error) {
    logger.error('Failed to send verification email', {
      email,
      error: error.message,
      stack: error.stack
    });

    return false;
  }
};

/**
 * Send notification when OpenVPN config is generated
 * @param {string} email - Recipient email address
 * @param {string} configName - Name of the generated config file
 * @param {string} configContent - Optional: The config file content to attach
 * @returns {Promise<boolean>} - True if sent successfully
 */
const sendConfigGeneratedEmail = async (email, configName, configContent = null) => {
  try {
    // Validate and sanitize email address
    const sanitizedEmail = sanitizeEmail(email);
    if (!validateEmailForSending(sanitizedEmail, 'config_generated')) {
      logger.error('Attempted to send config notification to invalid address', { email });
      return false;
    }

    const transport = initializeTransporter();

    if (!transport) {
      logger.error('Email transporter not configured, skipping config notification email');
      return false;
    }

    const dashboardUrl = `${process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3002'}/dashboard`;
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const appName = process.env.APP_NAME || 'OpenVPN Distribution System';

    const mailOptions = {
      from: `"${appName}" <${fromEmail}>`,
      to: sanitizedEmail,
      subject: 'Your OpenVPN Configuration is Ready',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .config-name { background-color: #fff; padding: 15px; border-left: 4px solid #2196F3; margin: 15px 0; font-family: monospace; }
            .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
            .info-box { background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 10px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Configuration Ready</h1>
            </div>
            <div class="content">
              <h2>Your OpenVPN Configuration is Available</h2>
              <p>Your OpenVPN configuration file has been successfully generated and is ${configContent ? 'attached to this email' : 'ready for download'}.</p>

              <div class="config-name">
                <strong>Configuration:</strong> ${configName}
              </div>

              ${configContent ? `
              <div class="info-box">
                <strong>✅ Config File Attached</strong>
                <p style="margin: 5px 0;">Your VPN configuration file is attached to this email. You can download it directly from the attachment.</p>
              </div>
              ` : ''}

              <p style="text-align: center;">
                <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
              </p>

              <div class="info-box">
                <strong>Next Steps:</strong>
                <ol style="margin: 10px 0;">
                  ${configContent ? '<li>Download the attached .ovpn file from this email</li>' : '<li>Log in to your dashboard</li>\n                  <li>Download your configuration file</li>'}
                  <li>Import it into your OpenVPN client</li>
                  <li>Connect to the VPN</li>
                </ol>
              </div>

              <p>If you have any questions or need assistance, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Your OpenVPN Configuration is Ready

        Your OpenVPN configuration file has been successfully generated and is ${configContent ? 'attached to this email' : 'ready for download'}.

        Configuration: ${configName}

        ${configContent ? 'The VPN configuration file is attached to this email. You can download it directly from the attachment.\n\n' : ''}Visit your dashboard: ${dashboardUrl}

        Next Steps:
        ${configContent ? '1. Download the attached .ovpn file from this email' : '1. Log in to your dashboard\n        2. Download your configuration file'}
        ${configContent ? '2' : '3'}. Import it into your OpenVPN client
        ${configContent ? '3' : '4'}. Connect to the VPN

        If you have any questions or need assistance, please contact our support team.
      `
    };

    // Add attachment if config content is provided
    if (configContent) {
      mailOptions.attachments = [
        {
          filename: configName,
          content: configContent,
          contentType: 'application/x-openvpn-profile'
        }
      ];
    }

    await transport.sendMail(mailOptions);

    logger.info('Config generated email sent successfully', { email: sanitizedEmail, configName });

    return true;
  } catch (error) {
    logger.error('Failed to send config generated email', {
      email,
      configName,
      error: error.message,
      stack: error.stack
    });

    return false;
  }
};

/**
 * Send notification when password is changed
 * @param {string} email - Recipient email address
 * @returns {Promise<boolean>} - True if sent successfully
 */
const sendPasswordChangedEmail = async (email) => {
  try {
    // Validate and sanitize email address
    const sanitizedEmail = sanitizeEmail(email);
    if (!validateEmailForSending(sanitizedEmail, 'password_changed')) {
      logger.error('Attempted to send password change notification to invalid address', { email });
      return false;
    }

    const transport = initializeTransporter();

    if (!transport) {
      logger.error('Email transporter not configured, skipping password change notification email');
      return false;
    }

    const supportUrl = `${process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3002'}/support`;
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const appName = process.env.APP_NAME || 'OpenVPN Distribution System';

    const mailOptions = {
      from: `"${appName}" <${fromEmail}>`,
      to: sanitizedEmail,
      subject: 'Password Changed Successfully',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
            .alert { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
            .timestamp { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Changed</h1>
            </div>
            <div class="content">
              <h2>Your Password Has Been Changed</h2>
              <p>This email confirms that your password was successfully changed.</p>

              <div class="timestamp">
                <strong>Date/Time:</strong> ${new Date().toLocaleString()}
              </div>

              <div class="alert">
                <strong>Security Notice:</strong><br>
                If you did not make this change, your account may be compromised. Please contact support immediately.
              </div>

              <p style="text-align: center;">
                <a href="${supportUrl}" class="button">Contact Support</a>
              </p>

              <p>For your security:</p>
              <ul>
                <li>Never share your password with anyone</li>
                <li>Use a unique password for this account</li>
                <li>Consider using a password manager</li>
                <li>Enable two-factor authentication if available</li>
              </ul>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Your Password Has Been Changed

        This email confirms that your password was successfully changed.

        Date/Time: ${new Date().toLocaleString()}

        SECURITY NOTICE:
        If you did not make this change, your account may be compromised. Please contact support immediately.

        Support: ${supportUrl}

        For your security:
        - Never share your password with anyone
        - Use a unique password for this account
        - Consider using a password manager
        - Enable two-factor authentication if available
      `
    };

    await transport.sendMail(mailOptions);

    logger.info('Password changed email sent successfully', { email: sanitizedEmail });

    return true;
  } catch (error) {
    logger.error('Failed to send password changed email', {
      email,
      error: error.message,
      stack: error.stack
    });

    return false;
  }
};

/**
 * Send password reset email
 * @param {string} email - Recipient email address
 * @param {string} token - Password reset token
 * @returns {Promise<boolean>} - True if sent successfully
 */
const sendPasswordResetEmail = async (email, token) => {
  try {
    // Validate and sanitize email address
    const sanitizedEmail = sanitizeEmail(email);
    if (!validateEmailForSending(sanitizedEmail, 'password_reset')) {
      logger.error('Attempted to send password reset to invalid address', { email });
      return false;
    }

    const transport = initializeTransporter();

    if (!transport) {
      logger.error('Email transporter not configured, skipping password reset email');
      return false;
    }

    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://dree.asuscomm.com:3002';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const appName = process.env.APP_NAME || 'OpenVPN Distribution System';

    const mailOptions = {
      from: `"${appName}" <${fromEmail}>`,
      to: sanitizedEmail,
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f44336; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
            .warning { background-color: #ffebee; border-left: 4px solid #f44336; padding: 10px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Reset Your Password</h2>
              <p>You have requested to reset your password. Click the button below to proceed:</p>

              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>

              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background-color: #fff; padding: 10px; border: 1px solid #ddd;">
                ${resetUrl}
              </p>

              <div class="warning">
                <strong>Important:</strong> This password reset link will expire in 1 hour.
              </div>

              <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request

        You have requested to reset your password.

        Reset Password Link: ${resetUrl}

        This link will expire in 1 hour.

        If you didn't request a password reset, please ignore this email or contact support if you have concerns.
      `
    };

    await transport.sendMail(mailOptions);

    logger.info('Password reset email sent successfully', { email: sanitizedEmail });

    return true;
  } catch (error) {
    logger.error('Failed to send password reset email', {
      email,
      error: error.message,
      stack: error.stack
    });

    return false;
  }
};

/**
 * Test email configuration by sending a test email
 * @param {string} email - Test recipient email address
 * @returns {Promise<boolean>} - True if test email sent successfully
 */
const sendTestEmail = async (email) => {
  try {
    // Validate and sanitize email address
    const sanitizedEmail = sanitizeEmail(email);
    if (!validateEmailForSending(sanitizedEmail, 'test_email')) {
      logger.error('Attempted to send test email to invalid address', { email });
      return false;
    }

    const transport = initializeTransporter();

    if (!transport) {
      logger.error('Email transporter not configured');
      return false;
    }

    // Verify connection
    await transport.verify();

    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const appName = process.env.APP_NAME || 'OpenVPN Distribution System';

    const mailOptions = {
      from: `"${appName}" <${fromEmail}>`,
      to: sanitizedEmail,
      subject: 'Test Email - Configuration Successful',
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email to verify your email configuration is working correctly.</p>
        <p>If you received this email, your SMTP settings are properly configured.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      `,
      text: `
        Email Configuration Test

        This is a test email to verify your email configuration is working correctly.

        If you received this email, your SMTP settings are properly configured.

        Timestamp: ${new Date().toISOString()}
      `
    };

    await transport.sendMail(mailOptions);

    logger.info('Test email sent successfully', { email: sanitizedEmail });

    return true;
  } catch (error) {
    logger.error('Failed to send test email', {
      email,
      error: error.message,
      stack: error.stack
    });

    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendConfigGeneratedEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendTestEmail,
  validateEmail,
  sanitizeEmail
};
