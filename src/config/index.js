/**
 * Configuration Module Index
 *
 * Provides a single entry point for all configuration modules.
 * Allows importing both environment and database configuration together.
 *
 * @module config
 */

const config = require('./environment');
const database = require('./database');

/**
 * Export all configuration modules
 */
module.exports = {
  // Environment configuration
  config,
  environment: config,

  // Database pool and functions
  database,
  pool: database,
  query: database.query,
  transaction: database.transaction,
  testConnection: database.testConnection,
  getPoolStats: database.getPoolStats,
  closePool: database.closePool,

  // Environment helper functions
  isProduction: config.isProduction,
  isDevelopment: config.isDevelopment,
  isTest: config.isTest,
  validateConfig: config.validateConfig
};

/**
 * Usage Examples:
 *
 * // Import entire config
 * const { config, query } = require('./config');
 *
 * // Import specific modules
 * const { database, environment } = require('./config');
 *
 * // Import specific functions
 * const { query, transaction, isProduction } = require('./config');
 */
