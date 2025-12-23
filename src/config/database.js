/**
 * Database Configuration Module
 *
 * Creates and manages MySQL connection pool using mysql2/promise library.
 * Provides connection pooling, error handling, and health check functionality.
 *
 * @module config/database
 */

const mysql = require('mysql2/promise');
const config = require('./environment');

// Use logger if available, otherwise fall back to console
let logger;
try {
  logger = require('../utils/logger');
} catch (err) {
  // Logger not yet initialized, use console
  logger = console;
}

/**
 * MySQL connection pool instance
 * Initialized with configuration from environment.js
 */
let pool = null;

/**
 * Database configuration object
 * Imported from environment configuration
 */
const dbConfig = {
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  port: config.database.port,
  connectionLimit: config.database.connectionLimit,
  waitForConnections: config.database.waitForConnections,
  queueLimit: config.database.queueLimit,
  enableKeepAlive: config.database.enableKeepAlive,
  keepAliveInitialDelay: config.database.keepAliveInitialDelay,
  // Additional performance settings
  connectTimeout: 10000, // 10 seconds
  multipleStatements: false, // Security: prevent multiple statements
  charset: 'utf8mb4',
  timezone: 'Z', // UTC timezone
  dateStrings: false
};

/**
 * Creates the MySQL connection pool
 * @returns {mysql.Pool} MySQL connection pool
 */
function createPool() {
  try {
    pool = mysql.createPool(dbConfig);

    logger.info('MySQL connection pool created successfully', {
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      connectionLimit: dbConfig.connectionLimit,
      waitForConnections: dbConfig.waitForConnections,
      queueLimit: dbConfig.queueLimit
    });

    // Handle pool-level errors
    pool.on('error', (err) => {
      logger.error('MySQL pool error:', {
        code: err.code,
        message: err.message,
        errno: err.errno,
        sqlState: err.sqlState
      });

      // Log specific error types with actionable information
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        logger.error('Database connection was closed. Pool will attempt to reconnect automatically.');
      } else if (err.code === 'ER_CON_COUNT_ERROR') {
        logger.error('Database has too many connections. Consider increasing max_connections or reducing connectionLimit.');
      } else if (err.code === 'ECONNREFUSED') {
        logger.error('Database connection was refused. Check if database server is running and accessible.');
      } else if (err.code === 'ETIMEDOUT') {
        logger.error('Database connection timed out. Check network connectivity and firewall rules.');
      } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        logger.error('Database access denied. Verify username and password.');
      } else if (err.code === 'ER_BAD_DB_ERROR') {
        logger.error('Database does not exist. Create the database or check database name.');
      }
    });

    // Monitor connection acquisition
    pool.on('acquire', (connection) => {
      logger.debug('Connection acquired from pool', {
        connectionId: connection.threadId,
        poolStats: getPoolStats()
      });
    });

    // Monitor connection release
    pool.on('release', (connection) => {
      logger.debug('Connection released back to pool', {
        connectionId: connection.threadId,
        poolStats: getPoolStats()
      });
    });

    return pool;
  } catch (error) {
    logger.error('Failed to create MySQL connection pool:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Gets the connection pool instance
 * Creates pool if it doesn't exist
 * @returns {mysql.Pool} MySQL connection pool
 */
function getPool() {
  if (!pool) {
    return createPool();
  }
  return pool;
}

/**
 * Tests the database connection
 * Useful for health checks and application startup
 * @returns {Promise<boolean>} True if connection is successful
 */
async function testConnection() {
  const currentPool = getPool();

  try {
    const connection = await currentPool.getConnection();

    // Perform a simple test query
    const [rows] = await connection.query('SELECT 1 + 1 AS result');

    // Release connection back to pool
    connection.release();

    logger.info('Database connection test successful', {
      result: rows[0].result,
      threadId: connection.threadId
    });

    return true;
  } catch (error) {
    logger.error('Database connection test failed:', {
      error: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState
    });
    throw error;
  }
}

/**
 * Gets database connection pool statistics
 * @returns {Object} Pool statistics
 */
function getPoolStats() {
  if (!pool) {
    return {
      status: 'not_initialized',
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
      connectionLimit: 0
    };
  }

  const poolState = pool.pool;

  const stats = {
    status: 'active',
    activeConnections: poolState._allConnections.length - poolState._freeConnections.length,
    idleConnections: poolState._freeConnections.length,
    totalConnections: poolState._allConnections.length,
    connectionLimit: dbConfig.connectionLimit,
    queuedRequests: poolState._connectionQueue ? poolState._connectionQueue.length : 0
  };

  // Log warning if connection pool is near capacity
  const usagePercentage = (stats.totalConnections / stats.connectionLimit) * 100;
  if (usagePercentage > 80) {
    logger.warn('Connection pool usage is high', {
      usagePercentage: usagePercentage.toFixed(2),
      ...stats
    });
  }

  return stats;
}

/**
 * Executes a query using the connection pool
 * Wrapper around pool.execute() for parameterized queries
 *
 * @param {string} sql - SQL query with placeholders
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
async function query(sql, params = []) {
  const currentPool = getPool();
  const startTime = Date.now();

  try {
    const [rows] = await currentPool.execute(sql, params);

    const duration = Date.now() - startTime;

    // Log slow queries (> 1 second)
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        duration,
        sql: sql.substring(0, 100), // First 100 chars
        paramCount: params.length
      });
    } else {
      logger.debug('Query executed successfully', {
        duration,
        rowCount: Array.isArray(rows) ? rows.length : 1
      });
    }

    return rows;
  } catch (error) {
    logger.error('Database query error:', {
      error: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sql: sql.substring(0, 100), // First 100 chars for security
      paramCount: params.length
    });
    throw error;
  }
}

/**
 * Executes a database transaction
 * Automatically commits on success and rolls back on error
 *
 * @param {Function} callback - Async function that receives connection
 * @returns {Promise<any>} Result of the callback function
 *
 * @example
 * await transaction(async (connection) => {
 *   await connection.query('INSERT INTO users ...');
 *   await connection.query('INSERT INTO profiles ...');
 * });
 */
async function transaction(callback) {
  const currentPool = getPool();
  const connection = await currentPool.getConnection();
  const startTime = Date.now();

  try {
    // Begin transaction
    await connection.beginTransaction();
    logger.debug('Transaction started', { connectionId: connection.threadId });

    // Execute callback
    const result = await callback(connection);

    // Commit transaction
    await connection.commit();

    const duration = Date.now() - startTime;
    logger.info('Transaction committed successfully', {
      connectionId: connection.threadId,
      duration
    });

    return result;
  } catch (error) {
    // Rollback on error
    await connection.rollback();

    const duration = Date.now() - startTime;
    logger.error('Transaction rolled back', {
      connectionId: connection.threadId,
      duration,
      error: error.message,
      code: error.code
    });

    throw error;
  } finally {
    // Always release connection
    connection.release();
    logger.debug('Transaction connection released', {
      connectionId: connection.threadId
    });
  }
}

/**
 * Closes the connection pool gracefully
 * Should be called on application shutdown
 * @returns {Promise<void>}
 */
async function closePool() {
  if (pool) {
    try {
      const stats = getPoolStats();
      logger.info('Closing MySQL connection pool', stats);

      await pool.end();

      logger.info('MySQL connection pool closed successfully');
      pool = null;
    } catch (error) {
      logger.error('Error closing MySQL connection pool:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

/**
 * Setup graceful shutdown handlers
 * Closes database connections on process termination
 */
function setupGracefulShutdown() {
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`${signal} received, closing database connections...`);

      try {
        await closePool();
        logger.info('Database connections closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', {
          error: error.message,
          stack: error.stack
        });
        process.exit(1);
      }
    });
  });
}

/**
 * Monitor connection pool health periodically
 */
function startPoolMonitoring() {
  // Check pool health every 5 minutes
  const monitoringInterval = setInterval(() => {
    if (pool) {
      const stats = getPoolStats();
      logger.info('Connection pool health check', stats);
    }
  }, 5 * 60 * 1000);

  // Clear interval on shutdown
  process.on('beforeExit', () => {
    clearInterval(monitoringInterval);
  });
}

// Initialize connection pool on module load
createPool();

// Test connection on startup (async, non-blocking)
testConnection()
  .then(() => {
    logger.info('Database connection established successfully');

    // Start monitoring after successful connection
    if (config.nodeEnv === 'production') {
      startPoolMonitoring();
      logger.info('Connection pool monitoring started');
    }
  })
  .catch((err) => {
    logger.error('Failed to connect to database:', {
      error: err.message,
      code: err.code,
      errno: err.errno
    });

    // Exit in production if database is unavailable
    if (config.isProduction && config.isProduction()) {
      logger.error('Exiting application due to database connection failure in production');
      process.exit(1);
    }
  });

// Setup graceful shutdown
setupGracefulShutdown();

// Export pool as default export for backward compatibility
module.exports = getPool();

// Export additional functions
module.exports.getPool = getPool;
module.exports.testConnection = testConnection;
module.exports.getPoolStats = getPoolStats;
module.exports.query = query;
module.exports.transaction = transaction;
module.exports.closePool = closePool;
