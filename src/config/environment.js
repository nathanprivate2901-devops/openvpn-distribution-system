/**
 * Environment Configuration Module
 *
 * Centralizes all environment variable management with validation and defaults.
 * Provides a single source of truth for application configuration.
 *
 * @module config/environment
 */

const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

/**
 * Get JWT secret with production safety check
 * SECURITY FIX: Prevents using weak default JWT secret in production
 * @returns {string} JWT secret from environment
 * @throws {Error} If JWT_SECRET not set in production
 */
function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;
  const nodeEnv = process.env.NODE_ENV || 'development';

  // SECURITY: In production, JWT_SECRET MUST be set explicitly
  // Throwing error prevents deployment with insecure defaults
  if (nodeEnv === 'production' && (!jwtSecret || jwtSecret === 'your-secret-key-change-in-production')) {
    throw new Error(
      'CRITICAL SECURITY ERROR: JWT_SECRET must be set to a strong, unique value in production. ' +
      'Never use default secrets in production environments. ' +
      'Generate a secure secret using: openssl rand -base64 64'
    );
  }

  // Allow fallback only in development/test environments
  return jwtSecret || 'your-secret-key-change-in-production';
}

/**
 * Application configuration object
 * Exports all configuration values with appropriate defaults
 */
const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // JWT configuration
  jwtSecret: getJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'openvpn_system',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  },

  // SMTP configuration (Email)
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@openvpn-system.com'
  },

  // OpenVPN configuration
  openvpn: {
    server: process.env.OPENVPN_SERVER || '10.8.0.0',
    port: parseInt(process.env.OPENVPN_PORT || '1194', 10),
    protocol: process.env.OPENVPN_PROTOCOL || 'udp',
    cipher: process.env.OPENVPN_CIPHER || 'AES-256-GCM',
    auth: process.env.OPENVPN_AUTH || 'SHA256'
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes default
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  },

  // Application URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://dree.asuscomm.com:3002',
  backendUrl: process.env.BACKEND_URL || 'http://dree.asuscomm.com:3000',

  // Additional configuration
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10), // Updated default to 12
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

/**
 * Validates required environment variables
 * Throws error if required variables are missing in production
 *
 * @throws {Error} If required environment variables are not set
 */
function validateConfig() {
  const requiredVars = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];

  // In production, also require SMTP configuration
  if (config.nodeEnv === 'production') {
    requiredVars.push('SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD');
  }

  const missingVars = requiredVars.filter(varName => {
    const value = process.env[varName];
    return !value || value.trim() === '';
  });

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
      'Please set these in your .env file or environment.'
    );
  }

  // SECURITY: Validate JWT_SECRET strength in production
  if (config.nodeEnv === 'production') {
    if (config.jwtSecret.length < 32) {
      throw new Error(
        'SECURITY ERROR: JWT_SECRET must be at least 32 characters long in production. ' +
        'Current length: ' + config.jwtSecret.length + ' characters. ' +
        'Generate a secure secret using: openssl rand -base64 64'
      );
    }
  }

  // Validate numeric ranges
  if (config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }

  if (config.database.connectionLimit < 1) {
    throw new Error('DB_CONNECTION_LIMIT must be at least 1');
  }

  if (config.rateLimit.maxRequests < 1) {
    throw new Error('RATE_LIMIT_MAX_REQUESTS must be at least 1');
  }

  // Validate bcrypt rounds
  if (config.bcryptSaltRounds < 10 || config.bcryptSaltRounds > 20) {
    throw new Error('BCRYPT_SALT_ROUNDS must be between 10 and 20');
  }
}

/**
 * Helper functions for environment checking
 */
const isProduction = () => config.nodeEnv === 'production';
const isDevelopment = () => config.nodeEnv === 'development';
const isTest = () => config.nodeEnv === 'test';

// Perform validation on module load (skip in test environment)
if (!isTest()) {
  try {
    validateConfig();
    console.log(`Environment configuration loaded successfully (${config.nodeEnv} mode)`);
  } catch (error) {
    console.error('Environment configuration validation failed:', error.message);
    if (isProduction()) {
      process.exit(1);
    }
  }
}

module.exports = config;
module.exports.validateConfig = validateConfig;
module.exports.isProduction = isProduction;
module.exports.isDevelopment = isDevelopment;
module.exports.isTest = isTest;
