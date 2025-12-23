/**
 * OpenVPN Distribution System - Main Application Entry Point
 *
 * Initializes Express server with middleware, routes, and error handling.
 * Handles database connections and graceful shutdown.
 *
 * @module index
 */

// Core dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Load environment configuration
const config = require('./config/environment');

// Initialize logger
const logger = require('./utils/logger');

// Database connection
const db = require('./config/database');

// Services
const syncScheduler = require('./services/syncScheduler');
const databaseSyncService = require('./services/databaseSync');
const vpnMonitor = require('./services/vpnMonitor');
const openvpnClientConnect = require('./services/openvpnClientConnect');

// Middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const openvpnRoutes = require('./routes/openvpnRoutes');
const qosRoutes = require('./routes/qosRoutes');
const dockerRoutes = require('./routes/dockerRoutes');
const syncRoutes = require('./routes/syncRoutes');
const dbSyncRoutes = require('./routes/dbSyncRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const lanNetworkRoutes = require('./routes/lanNetworkRoutes');

// Create Express application
const app = express();

/**
 * Application Configuration
 */
const PORT = config.port || 3000;
const NODE_ENV = config.nodeEnv || 'development';

/**
 * Middleware Stack
 */

// Security headers with helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Parse allowed origins from environment
    const allowedOrigins = config.corsOrigin ?
      config.corsOrigin.split(',').map(o => o.trim()) :
      ['http://localhost:3000'];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging with Morgan
// Create a custom stream object to integrate Morgan with Winston logger
app.use(morgan('combined', {
  stream: logger.stream,
  skip: (req, res) => {
    // Skip logging health check requests to reduce noise
    return req.path === '/health';
  }
}));

// Trust proxy - important for rate limiting and IP logging behind reverse proxy
app.set('trust proxy', 1);

// Apply general rate limiter to all routes (before route definitions)
// This protects against general abuse while specific routes can have stricter limits
app.use(generalLimiter);
logger.info('General rate limiter applied to all routes', {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});

/**
 * Health Check Endpoint
 * Used for monitoring and container health checks
 */
app.get('/health', async (req, res) => {
  try {
    // Get database connection pool stats
    const dbStats = db.getPoolStats();

    // Get sync scheduler status
    const syncStatus = syncScheduler.getStatus();

    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: {
        status: dbStats.status,
        connections: {
          active: dbStats.activeConnections,
          idle: dbStats.idleConnections,
          total: dbStats.totalConnections,
          limit: dbStats.connectionLimit
        }
      },
      syncScheduler: {
        isRunning: syncStatus.scheduler.isRunning,
        isSyncing: syncStatus.scheduler.isSyncing,
        intervalMinutes: syncStatus.scheduler.intervalMinutes,
        lastSync: syncStatus.lastSync.timestamp,
        nextSync: syncStatus.nextSync,
        statistics: syncStatus.statistics
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      }
    };

    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      message: 'Service unavailable'
    });
  }
});

/**
 * API Routes
 * Mount all route handlers with their base paths
 */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vpn', openvpnRoutes);
// app.use('/api/qos', qosRoutes); // DISABLED: QoS feature disabled
// app.use('/api/docker', dockerRoutes); // DISABLED: Docker management feature disabled
app.use('/api/sync', syncRoutes);
app.use('/api/db-sync', dbSyncRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/lan-networks', lanNetworkRoutes);

/**
 * Root endpoint
 * Provides basic API information
 */
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'OpenVPN Distribution System API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      users: '/api/users',
      admin: '/api/admin',
      vpn: '/api/vpn',
      qos: '/api/qos',
      devices: '/api/devices',
      docker: '/api/docker',
      sync: '/api/sync'
    }
  });
});

/**
 * API base endpoint
 * Provides API information for /api path
 */
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'OpenVPN Distribution System API',
    version: '1.0.0',
    status: 'running',
    documentation: 'Available endpoints listed below',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      admin: '/api/admin',
      vpn: '/api/vpn',
      qos: '/api/qos',
      devices: '/api/devices',
      docker: '/api/docker',
      sync: '/api/sync'
    }
  });
});

/**
 * Error Handling
 */

// 404 handler for undefined routes
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

/**
 * Server Initialization
 */
let server;

/**
 * Start the Express server
 */
async function startServer() {
  try {
    // Test database connection before starting server
    if (db.testConnection) {
      await db.testConnection();
      logger.info('Database connection verified successfully');
    }

    // Start HTTP server
    server = app.listen(PORT, async () => {
      logger.info('='.repeat(60));
      logger.info('OpenVPN Distribution System - Server Started');
      logger.info('='.repeat(60));
      logger.info(`Environment: ${NODE_ENV}`);
      logger.info(`Server running on port: ${PORT}`);
      logger.info(`Server URL: http://localhost:${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Process ID: ${process.pid}`);
      logger.info('='.repeat(60));

      // Log available routes in development
      if (NODE_ENV === 'development') {
        logger.info('Available API Routes:');
        logger.info('  - POST   /api/auth/register');
        logger.info('  - POST   /api/auth/login');
        logger.info('  - GET    /api/auth/verify-email');
        logger.info('  - POST   /api/auth/verify-email');
        logger.info('  - GET    /api/auth/me');
        logger.info('  - GET    /api/users/profile');
        logger.info('  - GET    /api/admin/stats');
        logger.info('  - POST   /api/vpn/generate-config');
        logger.info('  - GET    /api/vpn/configs');
        logger.info('  - GET    /api/qos/policies');
        logger.info('  - GET    /api/docker/containers');
        logger.info('  - POST   /api/sync/users');
        logger.info('  - GET    /api/sync/status');
        logger.info('='.repeat(60));
      }

      // Start sync scheduler after server starts
      try {
        const schedulerStarted = syncScheduler.start();
        if (schedulerStarted) {
          logger.info('OpenVPN user sync scheduler started successfully', {
            intervalMinutes: syncScheduler.syncIntervalMinutes,
            nextSync: syncScheduler.calculateNextSyncTime()
          });
        } else {
          logger.warn('Sync scheduler failed to start - check configuration');
        }
      } catch (error) {
        logger.error('Failed to start sync scheduler:', error);
        // Continue server operation even if scheduler fails
      }

      // Start VPN connection monitor
      try {
        vpnMonitor.start();
        logger.info('VPN connection monitor started successfully');
      } catch (error) {
        logger.error('Failed to start VPN monitor:', error);
        // Continue server operation even if monitor fails
      }

      // Initialize database sync service
      try {
        const dbSyncInitialized = await databaseSyncService.initialize();
        if (dbSyncInitialized) {
          logger.info('Database sync service initialized successfully');

          // Perform initial sync if configured
          if (process.env.DB_SYNC_ON_STARTUP === 'true') {
            logger.info('Performing initial database synchronization...');
            const syncResult = await databaseSyncService.syncFull();
            if (syncResult.success) {
              logger.info('Initial database sync completed successfully', {
                duration: syncResult.duration,
                records: syncResult.syncResults.totalRecords
              });
            } else {
              logger.warn('Initial database sync failed', {
                error: syncResult.error
              });
            }
          }
        } else {
          logger.info('Database sync service not configured - skipping');
        }
      } catch (error) {
        logger.error('Failed to initialize database sync service:', error);
        // Continue server operation even if sync service fails
      }

      // Initialize OpenVPN LAN routing
      try {
        logger.info('Initializing OpenVPN LAN network routing...');
        const routingInitialized = await openvpnClientConnect.initialize();
        if (routingInitialized) {
          logger.info('OpenVPN LAN network routing initialized successfully');
        } else {
          logger.warn('OpenVPN LAN network routing initialization failed');
        }
      } catch (error) {
        logger.error('Failed to initialize OpenVPN LAN routing:', error);
        logger.error('LAN network routes may not work until manual configuration');
        // Continue server operation even if routing initialization fails
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        logger.error('Server error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful Shutdown Handler
 * Handles SIGTERM and SIGINT signals for clean shutdown
 */
async function gracefulShutdown(signal) {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  // Stop VPN monitor
  try {
    vpnMonitor.stop();
    logger.info('VPN monitor stopped');
  } catch (error) {
    logger.error('Error stopping VPN monitor:', error);
  }

  // Stop sync scheduler
  try {
    if (syncScheduler.isRunning) {
      syncScheduler.stop();
      logger.info('Sync scheduler stopped');
    }
  } catch (error) {
    logger.error('Error stopping sync scheduler:', error);
  }

  // Close database sync service
  try {
    await databaseSyncService.close();
    logger.info('Database sync service closed');
  } catch (error) {
    logger.error('Error closing database sync service:', error);
  }

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close database connection pool
        if (db.closePool) {
          await db.closePool();
          logger.info('Database connections closed');
        }

        logger.info('Graceful shutdown completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

/**
 * Process Event Handlers
 */

// Graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  logger.error(error.stack);

  // Exit in production, continue in development
  if (NODE_ENV === 'production') {
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);

  // Exit in production, continue in development
  if (NODE_ENV === 'production') {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

/**
 * Start the application
 */
startServer().catch((error) => {
  logger.error('Fatal error during server startup:', error);
  process.exit(1);
});

/**
 * Export app for testing
 */
module.exports = app;
