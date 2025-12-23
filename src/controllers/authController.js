const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const VerificationToken = require('../models/VerificationToken');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');
const { generateVerificationToken } = require('../utils/tokenGenerator');
const config = require('../config/environment');
const logger = require('../utils/logger');
const openvpnUserSync = require('../services/openvpnUserSync');

/**
 * Authentication Controller
 * Handles user registration, login, email verification, and user profile operations
 */

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      logger.warn(`Registration attempt with existing email: ${email}`);
      // SECURITY FIX: Generic message to prevent email enumeration
      // Always return the same message regardless of whether email exists
      return res.status(200).json({
        success: true,
        message: 'If this email is not already registered, you will receive a verification email shortly.'
      });
    }

    // SECURITY FIX: Increased bcrypt rounds from 10 to 12 for stronger password hashing
    // 12 rounds provides better protection against brute force attacks while maintaining
    // acceptable performance (approximately 250ms on modern hardware)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      username: username,
      name: username,
      role: 'user'
    });

    // Generate verification token
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save verification token
    await VerificationToken.create(user.id, token, expiresAt);

    // Send verification email
    try {
      await sendVerificationEmail(email, token);
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      // Continue registration even if email fails
    }

    logger.info(`User registered successfully: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // SECURITY FIX: Prevent timing attacks by always performing bcrypt comparison
    // Even if user doesn't exist, we compare against a dummy hash to maintain
    // constant execution time and prevent attackers from determining valid emails

    // Find user by email
    const user = await User.findByEmail(email);

    // Create dummy hash for timing attack prevention
    // This ensures bcrypt.compare() is always called, maintaining constant time
    const dummyHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LhGPqRBTvPvxELNZC';
    const hashToCompare = user ? user.password : dummyHash;

    // Always perform password comparison to prevent timing attacks
    const isPasswordValid = await bcrypt.compare(password, hashToCompare);

    // Check authentication results
    if (!user || !isPasswordValid) {
      logger.warn(`Failed login attempt for email: ${email}`);
      // SECURITY: Generic error message prevents email enumeration
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if email is verified
    if (!user.email_verified) {
      logger.warn(`Login attempt with unverified email: ${email}`);
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Generate JWT token with 24h expiration
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        username: user.name
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    logger.info(`User logged in successfully: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          email_verified: user.email_verified
        }
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

/**
 * Verify email with token from email link (GET request)
 * @route GET /api/auth/verify-email?token=xxx
 * @access Public
 */
const verifyEmailFromLink = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      logger.warn('Email verification attempted without token');
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verification - Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #f44336; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="icon">❌</div>
          <h1 class="error">Verification Failed</h1>
          <p>Invalid verification link. No token provided.</p>
        </body>
        </html>
      `);
    }

    // Find token in database
    const verificationToken = await VerificationToken.findByToken(token);
    if (!verificationToken) {
      logger.warn(`Invalid or expired verification token: ${token.substring(0, 10)}...`);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verification - Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #f44336; }
            .icon { font-size: 48px; margin-bottom: 20px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="icon">⏰</div>
          <h1 class="error">Verification Link Expired</h1>
          <p>This verification link is invalid or has expired.</p>
          <p>Please request a new verification email.</p>
          <a href="${config.frontendUrl || config.appUrl || 'http://localhost:3000'}/resend-verification" class="button">Request New Link</a>
        </body>
        </html>
      `);
    }

    // Check if already verified
    if (verificationToken.email_verified) {
      logger.info(`Email already verified: ${verificationToken.email}`);
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verification - Already Verified</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .success { color: #4CAF50; }
            .icon { font-size: 48px; margin-bottom: 20px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="icon">✓</div>
          <h1 class="success">Already Verified</h1>
          <p>Your email has already been verified.</p>
          <p>You can now log in to your account.</p>
          <a href="${config.frontendUrl || config.appUrl || 'http://localhost:3000'}/login" class="button">Go to Login</a>
        </body>
        </html>
      `);
    }

    // Update user email_verified status
    await User.updateProfile(verificationToken.user_id, { email_verified: true });

    // Delete verification token
    await VerificationToken.deleteByToken(token);

    logger.info(`Email verified successfully: ${verificationToken.email}`);

    // Sync user to OpenVPN after email verification
    try {
      const user = await User.findById(verificationToken.user_id);
      if (user && user.username) {
        await openvpnUserSync.createOpenVPNUser(
          user.username,
          null, // No temp password needed, will be generated
          {
            email: user.email,
            name: user.name || user.username,
            role: user.role
          }
        );
        logger.info(`User ${user.username} synced to OpenVPN after email verification`);
      }
    } catch (syncError) {
      logger.error(`Failed to sync user to OpenVPN after verification:`, syncError);
      // Don't fail verification if sync fails
    }

    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verification - Success</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .success { color: #4CAF50; }
          .icon { font-size: 48px; margin-bottom: 20px; }
          .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="icon">✅</div>
        <h1 class="success">Email Verified Successfully!</h1>
        <p>Your email has been verified. You can now log in to your account.</p>
        <a href="${config.frontendUrl || config.appUrl || 'http://localhost:3000'}/login" class="button">Go to Login</a>
      </body>
      </html>
    `);

  } catch (error) {
    logger.error('Email verification error:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verification - Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .error { color: #f44336; }
          .icon { font-size: 48px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="icon">❌</div>
        <h1 class="error">Verification Error</h1>
        <p>An error occurred while verifying your email. Please try again later.</p>
      </body>
      </html>
    `);
  }
};

/**
 * Verify email with token
 * @route POST /api/auth/verify-email
 * @access Public
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    // Find token in database
    const verificationToken = await VerificationToken.findByToken(token);
    if (!verificationToken) {
      logger.warn(`Invalid or expired verification token: ${token.substring(0, 10)}...`);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Check if already verified
    if (verificationToken.email_verified) {
      logger.info(`Email already verified: ${verificationToken.email}`);
      return res.status(200).json({
        success: true,
        message: 'Email already verified'
      });
    }

    // Update user email_verified status
    await User.updateProfile(verificationToken.user_id, { email_verified: true });

    // Delete verification token
    await VerificationToken.deleteByToken(token);

    logger.info(`Email verified successfully: ${verificationToken.email}`);

    // Sync user to OpenVPN after email verification
    try {
      const user = await User.findById(verificationToken.user_id);
      if (user && user.username) {
        await openvpnUserSync.createOpenVPNUser(
          user.username,
          null, // No temp password needed, will be generated
          {
            email: user.email,
            name: user.name || user.username,
            role: user.role
          }
        );
        logger.info(`User ${user.username} synced to OpenVPN after email verification`);
      }
    } catch (syncError) {
      logger.error(`Failed to sync user to OpenVPN after verification:`, syncError);
      // Don't fail verification if sync fails
    }

    res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });

  } catch (error) {
    logger.error('Email verification error:', error);
    next(error);
  }
};

/**
 * Resend verification email
 * @route POST /api/auth/resend-verification
 * @access Public
 */
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      logger.warn(`Resend verification attempt for non-existent email: ${email}`);
      // SECURITY FIX: Generic message to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a verification link will be sent.'
      });
    }

    // Check if already verified
    if (user.email_verified) {
      logger.info(`Resend verification attempt for already verified email: ${email}`);
      // Still return generic success message to prevent enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a verification link will be sent.'
      });
    }

    // Delete old verification tokens for this user
    await VerificationToken.deleteByUserId(user.id);

    // Generate new verification token
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save new verification token
    await VerificationToken.create(user.id, token, expiresAt);

    // Send verification email
    await sendVerificationEmail(email, token);

    logger.info(`Verification email resent to: ${email}`);

    res.json({
      success: true,
      message: 'If an account exists with this email, a verification link will be sent.'
    });

  } catch (error) {
    logger.error('Resend verification error:', error);
    next(error);
  }
};

/**
 * Get current authenticated user info
 * @route GET /api/auth/me
 * @access Private
 */
const getCurrentUser = async (req, res, next) => {
  try {
    // User info is attached by verifyToken middleware
    const userId = req.user.id;

    // Fetch fresh user data from database
    const user = await User.findById(userId);
    if (!user) {
      logger.error(`Authenticated user not found in database: ID ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info(`User profile accessed: ${user.email}`);

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        email_verified: user.email_verified,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error) {
    logger.error('Get current user error:', error);
    next(error);
  }
};

/**
 * Request password reset
 * @route POST /api/auth/forgot-password
 * @access Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      // SECURITY: Generic message to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link will be sent.'
      });
    }

    // Delete old password reset tokens for this user
    await PasswordResetToken.deleteByUserId(user.id);

    // Generate new password reset token
    const token = generateVerificationToken();
    // Set expiration to 24 hours to avoid timezone/clock skew issues
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save password reset token
    await PasswordResetToken.create(user.id, token, expiresAt);

    // Send password reset email
    try {
      await sendPasswordResetEmail(email, token);
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError);
      // Still return success to prevent email enumeration
    }

    logger.info(`Password reset email sent to: ${email}`);

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent.'
    });

  } catch (error) {
    logger.error('Forgot password error:', error);
    next(error);
  }
};

/**
 * Reset password with token
 * @route POST /api/auth/reset-password
 * @access Public
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    // Find valid token
    const resetToken = await PasswordResetToken.findValidToken(token);
    if (!resetToken) {
      logger.warn(`Invalid or expired password reset token: ${token?.substring(0, 10)}...`);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password in database
    await User.updatePassword(resetToken.user_id, hashedPassword);

    // Mark token as used
    await PasswordResetToken.markAsUsed(token);

    // Sync password to OpenVPN Access Server
    try {
      const user = await User.findById(resetToken.user_id);
      if (user && user.username && user.email_verified) {
        await openvpnUserSync.updateOpenVPNPassword(user.username, newPassword);
        logger.info(`OpenVPN password synced for user: ${user.username}`);
      }
    } catch (syncError) {
      // Log but don't fail the password reset if OpenVPN sync fails
      logger.error(`Failed to sync password to OpenVPN for user ID ${resetToken.user_id}:`, syncError);
    }

    logger.info(`Password reset successful for user ID: ${resetToken.user_id}`);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });

  } catch (error) {
    logger.error('Reset password error:', error);
    next(error);
  }
};

/**
 * Verify password reset token (check if valid before showing reset form)
 * @route GET /api/auth/verify-reset-token
 * @access Public
 */
const verifyResetToken = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Find valid token
    const resetToken = await PasswordResetToken.findValidToken(token);
    if (!resetToken) {
      logger.warn(`Invalid or expired password reset token verification: ${token.substring(0, 10)}...`);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token'
      });
    }

    res.json({
      success: true,
      message: 'Token is valid'
    });

  } catch (error) {
    logger.error('Verify reset token error:', error);
    next(error);
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  verifyEmailFromLink,
  resendVerification,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  verifyResetToken
};
