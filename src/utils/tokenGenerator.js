const crypto = require('crypto');
const logger = require('./logger');

/**
 * Generate a secure random verification token
 * @returns {string} - A random 32-byte hex token (64 characters)
 */
const generateVerificationToken = () => {
  try {
    // Generate 32 random bytes and convert to hexadecimal string
    const token = crypto.randomBytes(32).toString('hex');

    logger.debug('Verification token generated successfully');

    return token;
  } catch (error) {
    logger.error('Error generating verification token', {
      error: error.message,
      stack: error.stack
    });

    throw new Error('Failed to generate verification token');
  }
};

/**
 * Generate a secure random password reset token
 * @returns {string} - A random 32-byte hex token (64 characters)
 */
const generatePasswordResetToken = () => {
  try {
    const token = crypto.randomBytes(32).toString('hex');

    logger.debug('Password reset token generated successfully');

    return token;
  } catch (error) {
    logger.error('Error generating password reset token', {
      error: error.message,
      stack: error.stack
    });

    throw new Error('Failed to generate password reset token');
  }
};

/**
 * Generate a secure random API key
 * @param {number} length - Length of the API key in bytes (default: 48)
 * @returns {string} - A random hex API key
 */
const generateApiKey = (length = 48) => {
  try {
    const apiKey = crypto.randomBytes(length).toString('hex');

    logger.debug('API key generated successfully', { keyLength: length * 2 });

    return apiKey;
  } catch (error) {
    logger.error('Error generating API key', {
      error: error.message,
      stack: error.stack
    });

    throw new Error('Failed to generate API key');
  }
};

/**
 * Generate a secure random string for general purposes
 * @param {number} length - Length in bytes (default: 16)
 * @returns {string} - A random hex string
 */
const generateRandomToken = (length = 16) => {
  try {
    const token = crypto.randomBytes(length).toString('hex');

    logger.debug('Random token generated successfully', { length: length * 2 });

    return token;
  } catch (error) {
    logger.error('Error generating random token', {
      error: error.message,
      stack: error.stack
    });

    throw new Error('Failed to generate random token');
  }
};

module.exports = {
  generateVerificationToken,
  generatePasswordResetToken,
  generateApiKey,
  generateRandomToken
};
