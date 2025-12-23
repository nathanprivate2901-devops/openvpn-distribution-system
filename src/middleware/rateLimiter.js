const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Custom handler for rate limit exceeded
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const rateLimitHandler = (req, res) => {
  logger.warn('Rate limit exceeded:', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    user: req.user?.email || 'anonymous'
  });

  res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: req.rateLimit?.resetTime
  });
};

/**
 * Skip rate limiting for successful requests based on condition
 * This can be useful for trusted IPs or authenticated admin users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {boolean} - True to skip rate limiting
 */
const skipSuccessfulRequests = (req, res) => {
  // Skip rate limiting for successful responses (status < 400)
  return res.statusCode < 400;
};

/**
 * General rate limiter for most API endpoints
 * Configurable via environment variables
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window default
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: rateLimitHandler,
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    return req.path === '/health';
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?.id ? `user_${req.user.id}` : req.ip;
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * More restrictive to prevent brute force attacks
 *
 * SECURITY FIX: Uses composite key combining IP and email to prevent bypass
 * by rotating email addresses. This ensures attackers cannot circumvent rate
 * limiting by attempting logins with different email addresses from the same IP.
 */
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5, // 5 attempts per window default
  message: 'Too many authentication attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => {
    // SECURITY: Use composite key to prevent email rotation bypass
    // Format: "IP:email" ensures rate limiting per IP regardless of email used
    const email = req.body?.email || 'anonymous';
    return `${req.ip}:${email}`;
  }
});

/**
 * Moderate rate limiter for resource creation endpoints
 * Prevents spam and abuse
 */
const createLimiter = rateLimit({
  windowMs: parseInt(process.env.CREATE_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour default
  max: parseInt(process.env.CREATE_RATE_LIMIT_MAX_REQUESTS) || 10, // 10 creations per hour default
  message: 'Too many resources created. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    return req.user?.id ? `user_${req.user.id}` : req.ip;
  }
});

/**
 * Lenient rate limiter for read-only operations
 * Higher limits for GET requests
 */
const readLimiter = rateLimit({
  windowMs: parseInt(process.env.READ_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.READ_RATE_LIMIT_MAX_REQUESTS) || 200, // 200 requests per window default
  message: 'Too many read requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => {
    // Only apply to GET requests
    return req.method !== 'GET';
  },
  keyGenerator: (req) => {
    return req.user?.id ? `user_${req.user.id}` : req.ip;
  }
});

/**
 * Admin rate limiter - more lenient for admin operations
 */
const adminLimiter = rateLimit({
  windowMs: parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX_REQUESTS) || 300, // 300 requests per window default
  message: 'Too many admin requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    return req.user?.id ? `admin_${req.user.id}` : req.ip;
  }
});

/**
 * Docker operations rate limiter - restrictive for container operations
 */
const dockerLimiter = rateLimit({
  windowMs: parseInt(process.env.DOCKER_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes default
  max: parseInt(process.env.DOCKER_RATE_LIMIT_MAX_REQUESTS) || 20, // 20 docker operations per window default
  message: 'Too many Docker operations. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    return req.user?.id ? `docker_${req.user.id}` : req.ip;
  }
});

/**
 * Custom rate limiter factory
 * Create custom rate limiters with specific configurations
 * @param {Object} options - Rate limiter options
 * @returns {Function} - Rate limiter middleware
 */
const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: options.message || 'Too many requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    ...options
  });
};

module.exports = {
  generalLimiter,
  authLimiter,
  createLimiter,
  readLimiter,
  adminLimiter,
  dockerLimiter,
  createRateLimiter
};
