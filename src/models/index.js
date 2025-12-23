/**
 * Models Index
 * Central export point for all database models
 */

const User = require('./User');
const VerificationToken = require('./VerificationToken');
const ConfigFile = require('./ConfigFile');
const QosPolicy = require('./QosPolicy');
const Device = require('./Device');

module.exports = {
  User,
  VerificationToken,
  ConfigFile,
  QosPolicy,
  Device
};
