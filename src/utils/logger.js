const winston = require('winston');
const path = require('path');

// Determine log level based on environment
const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Define custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format with colors for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }

    return msg;
  })
);

// Create the logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'openvpn-distribution' },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),

    // Write only error logs to error.log
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ],

  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log')
    })
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log')
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create a stream object for Morgan integration (HTTP request logging)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Log initialization
logger.info('Logger initialized', {
  level: logLevel,
  environment: process.env.NODE_ENV || 'development'
});

module.exports = logger;
