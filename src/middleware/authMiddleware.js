const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Verify JWT token and attach user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const verifyToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user information to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      username: decoded.username
    };

    logger.info(`User authenticated: ${decoded.email} (${decoded.role})`);
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token expired attempt:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid token attempt:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
        code: 'TOKEN_INVALID'
      });
    }

    logger.error('Token verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error occurred.'
    });
  }
};

/**
 * Check if authenticated user has admin role
 * Must be used after verifyToken middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const isAdmin = (req, res, next) => {
  try {
    // Check if user is attached to request (verifyToken must run first)
    if (!req.user) {
      logger.error('isAdmin middleware called without verifyToken');
      return res.status(500).json({
        success: false,
        message: 'Authentication middleware error.'
      });
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      logger.warn(`Unauthorized admin access attempt by user: ${req.user.email}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    logger.info(`Admin access granted to: ${req.user.email}`);
    next();

  } catch (error) {
    logger.error('Admin authorization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization error occurred.'
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if valid token exists, but doesn't require it
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      username: decoded.username
    };

    next();

  } catch (error) {
    // Token invalid, continue without user
    next();
  }
};

module.exports = {
  verifyToken,
  isAdmin,
  optionalAuth
};
