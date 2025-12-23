const logger = require('../utils/logger');

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle database errors
 * @param {Error} err - Database error object
 * @returns {Object} - Formatted error response
 */
const handleDatabaseError = (err) => {
  // Duplicate entry error
  if (err.code === 'ER_DUP_ENTRY') {
    const field = err.sqlMessage?.match(/for key '(.+?)'/)?.[1] || 'field';
    return {
      statusCode: 409,
      message: `Duplicate entry. ${field} already exists.`,
      code: 'DUPLICATE_ENTRY'
    };
  }

  // Foreign key constraint error
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return {
      statusCode: 400,
      message: 'Invalid reference. Related record does not exist.',
      code: 'INVALID_REFERENCE'
    };
  }

  // Connection error
  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return {
      statusCode: 503,
      message: 'Database connection error. Please try again later.',
      code: 'DB_CONNECTION_ERROR'
    };
  }

  // Default database error
  return {
    statusCode: 500,
    message: 'Database operation failed.',
    code: 'DB_ERROR'
  };
};

/**
 * Handle JWT errors
 * @param {Error} err - JWT error object
 * @returns {Object} - Formatted error response
 */
const handleJWTError = (err) => {
  if (err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      message: 'Token has expired. Please login again.',
      code: 'TOKEN_EXPIRED'
    };
  }

  if (err.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      message: 'Invalid token. Please login again.',
      code: 'TOKEN_INVALID'
    };
  }

  return {
    statusCode: 401,
    message: 'Authentication failed.',
    code: 'AUTH_ERROR'
  };
};

/**
 * Handle validation errors
 * @param {Error} err - Validation error object
 * @returns {Object} - Formatted error response
 */
const handleValidationError = (err) => {
  if (err.name === 'ValidationError') {
    return {
      statusCode: 400,
      message: err.message || 'Validation failed.',
      code: 'VALIDATION_ERROR',
      errors: err.errors
    };
  }

  return {
    statusCode: 400,
    message: 'Invalid input data.',
    code: 'INVALID_INPUT'
  };
};

/**
 * Centralized error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Default error values
  let error = {
    statusCode: err.statusCode || 500,
    message: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  };

  // Log error details
  const logData = {
    method: req.method,
    path: req.path,
    ip: req.ip,
    user: req.user?.email || 'anonymous',
    error: err.message,
    stack: err.stack
  };

  // Handle specific error types
  if (err.code && err.code.startsWith('ER_')) {
    error = { ...error, ...handleDatabaseError(err) };
    logger.error('Database error:', logData);
  } else if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
    error = { ...error, ...handleJWTError(err) };
    logger.warn('JWT error:', logData);
  } else if (err.name === 'ValidationError') {
    error = { ...error, ...handleValidationError(err) };
    logger.warn('Validation error:', logData);
  } else if (err.isOperational) {
    // Operational error (known error)
    logger.warn('Operational error:', logData);
  } else {
    // Programming or unknown error
    logger.error('Unexpected error:', logData);
  }

  // Prepare response
  const response = {
    success: false,
    message: error.message,
    code: error.code
  };

  // Add validation errors if present
  if (error.errors) {
    response.errors = error.errors;
  }

  // Include stack trace in development mode
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
    response.details = {
      name: err.name,
      code: err.code
    };
  }

  // Send error response
  res.status(error.statusCode).json(response);
};

/**
 * Handle 404 Not Found errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const notFound = (req, res, next) => {
  const error = new AppError(
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    'ROUTE_NOT_FOUND'
  );

  logger.warn('404 Not Found:', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });

  next(error);
};

/**
 * Async error wrapper to catch errors in async route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
  AppError
};
