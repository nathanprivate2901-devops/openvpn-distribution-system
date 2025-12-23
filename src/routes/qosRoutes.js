const express = require('express');
const router = express.Router();
const qosController = require('../controllers/qosController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const {
  validate,
  createQosPolicySchema,
  updateQosPolicySchema,
  assignQosPolicySchema,
  policyIdParamSchema,
  userIdParamSchema
} = require('../middleware/validator');

/**
 * QoS Routes
 * Handles all QoS policy management endpoints
 *
 * Base path: /api/qos
 */

/**
 * @route   GET /api/qos/policies
 * @desc    Get all QoS policies
 * @access  Authenticated (any authenticated user)
 */
router.get('/policies', verifyToken, qosController.getAllPolicies);

/**
 * @route   GET /api/qos/policies/:id
 * @desc    Get specific QoS policy by ID
 * @access  Authenticated (any authenticated user)
 */
router.get(
  '/policies/:id',
  verifyToken,
  policyIdParamSchema,
  validate,
  qosController.getPolicyById
);

/**
 * @route   POST /api/qos/policies
 * @desc    Create new QoS policy
 * @access  Admin only
 * @body    { policy_name, max_download_speed, max_upload_speed, priority, description }
 */
router.post(
  '/policies',
  verifyToken,
  isAdmin,
  createQosPolicySchema,
  validate,
  qosController.createPolicy
);

/**
 * @route   PUT /api/qos/policies/:id
 * @desc    Update existing QoS policy
 * @access  Admin only
 * @body    { policy_name?, max_download_speed?, max_upload_speed?, priority?, description? }
 */
router.put(
  '/policies/:id',
  verifyToken,
  isAdmin,
  policyIdParamSchema,
  updateQosPolicySchema,
  validate,
  qosController.updatePolicy
);

/**
 * @route   DELETE /api/qos/policies/:id
 * @desc    Delete QoS policy
 * @access  Admin only
 */
router.delete(
  '/policies/:id',
  verifyToken,
  isAdmin,
  policyIdParamSchema,
  validate,
  qosController.deletePolicy
);

/**
 * @route   POST /api/qos/assign
 * @desc    Assign QoS policy to user
 * @access  Admin only
 * @body    { userId, policyId }
 */
router.post(
  '/assign',
  verifyToken,
  isAdmin,
  assignQosPolicySchema,
  validate,
  qosController.assignPolicyToUser
);

/**
 * @route   DELETE /api/qos/assign/:userId
 * @desc    Remove QoS policy assignment from user
 * @access  Admin only
 */
router.delete(
  '/assign/:userId',
  verifyToken,
  isAdmin,
  userIdParamSchema,
  validate,
  qosController.removePolicyFromUser
);

/**
 * @route   GET /api/qos/my-policy
 * @desc    Get current user's assigned QoS policy
 * @access  Authenticated (any authenticated user)
 */
router.get('/my-policy', verifyToken, qosController.getMyPolicy);

/**
 * @route   GET /api/qos/policies/:id/stats
 * @desc    Get usage statistics for specific QoS policy
 * @access  Admin only
 * @returns User count, assigned users list, config file references
 */
router.get(
  '/policies/:id/stats',
  verifyToken,
  isAdmin,
  policyIdParamSchema,
  validate,
  qosController.getPolicyStats
);

/**
 * ============================================================================
 * DEVICE QoS POLICY ROUTES
 * Routes for managing QoS policies at the device level
 * ============================================================================
 */

/**
 * @route   POST /api/qos/assign-device
 * @desc    Assign QoS policy to a specific device
 * @access  Admin only
 * @body    { deviceId, policyId, notes? }
 */
router.post(
  '/assign-device',
  verifyToken,
  isAdmin,
  [
    require('express-validator').body('deviceId')
      .isInt({ min: 1 })
      .withMessage('Device ID must be a positive integer'),
    require('express-validator').body('policyId')
      .isInt({ min: 1 })
      .withMessage('Policy ID must be a positive integer'),
    require('express-validator').body('notes')
      .optional()
      .isString()
      .trim()
      .withMessage('Notes must be a string')
  ],
  validate,
  qosController.assignPolicyToDevice
);

/**
 * @route   DELETE /api/qos/assign-device/:deviceId
 * @desc    Remove QoS policy assignment from a device
 * @access  Admin only
 */
router.delete(
  '/assign-device/:deviceId',
  verifyToken,
  isAdmin,
  [
    require('express-validator').param('deviceId')
      .isInt({ min: 1 })
      .withMessage('Device ID must be a positive integer')
  ],
  validate,
  qosController.removePolicyFromDevice
);

/**
 * @route   GET /api/qos/device/:deviceId
 * @desc    Get effective QoS policy for a specific device
 * @access  Authenticated (users can view their own devices, admins can view all)
 */
router.get(
  '/device/:deviceId',
  verifyToken,
  [
    require('express-validator').param('deviceId')
      .isInt({ min: 1 })
      .withMessage('Device ID must be a positive integer')
  ],
  validate,
  qosController.getDevicePolicy
);

/**
 * @route   GET /api/qos/policies/:id/device-stats
 * @desc    Get device statistics for specific QoS policy
 * @access  Admin only
 * @returns Device count, assigned devices list with user info
 */
router.get(
  '/policies/:id/device-stats',
  verifyToken,
  isAdmin,
  policyIdParamSchema,
  validate,
  qosController.getPolicyDeviceStats
);

module.exports = router;
