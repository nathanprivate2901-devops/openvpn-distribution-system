const express = require('express');
const router = express.Router();
const dockerController = require('../controllers/dockerController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

/**
 * Docker Management Routes
 * All routes require authentication and admin role
 * Base path: /api/docker
 *
 * Security Warning: These endpoints provide direct Docker API access.
 * Only authorized administrators should have access to these operations.
 */

// Apply authentication and admin check to all routes
router.use(verifyToken);
router.use(isAdmin);

/**
 * Container Management Routes
 */

/**
 * @route   GET /api/docker/containers
 * @desc    List all Docker containers
 * @access  Admin only
 * @query   {string} all - Show all containers including stopped (default: true)
 * @query   {number} limit - Limit number of containers returned
 * @query   {string} filters - JSON string for filtering (e.g., {"status": ["running"]})
 * @example GET /api/docker/containers?all=true&filters={"status":["running"]}
 */
router.get('/containers', dockerController.listContainers);

/**
 * @route   GET /api/docker/openvpn-containers
 * @desc    Get containers with 'openvpn' in name or image
 * @access  Admin only
 * @returns {array} List of OpenVPN-related containers
 */
router.get('/openvpn-containers', dockerController.getOpenVPNContainers);

/**
 * @route   GET /api/docker/containers/:id
 * @desc    Get detailed information about a specific container
 * @access  Admin only
 * @param   {string} id - Container ID or name
 * @returns {object} Detailed container information including config, network, mounts
 */
router.get('/containers/:id', dockerController.getContainerDetails);

/**
 * @route   POST /api/docker/containers/:id/start
 * @desc    Start a stopped container
 * @access  Admin only
 * @param   {string} id - Container ID or name
 * @returns {object} Success message and container ID
 */
router.post('/containers/:id/start', dockerController.startContainer);

/**
 * @route   POST /api/docker/containers/:id/stop
 * @desc    Stop a running container
 * @access  Admin only
 * @param   {string} id - Container ID or name
 * @query   {number} timeout - Seconds to wait before killing (default: 10)
 * @example POST /api/docker/containers/my-container/stop?timeout=30
 */
router.post('/containers/:id/stop', dockerController.stopContainer);

/**
 * @route   POST /api/docker/containers/:id/restart
 * @desc    Restart a container
 * @access  Admin only
 * @param   {string} id - Container ID or name
 * @query   {number} timeout - Seconds to wait before killing (default: 10)
 * @example POST /api/docker/containers/my-container/restart?timeout=15
 */
router.post('/containers/:id/restart', dockerController.restartContainer);

/**
 * @route   GET /api/docker/containers/:id/logs
 * @desc    Get container logs
 * @access  Admin only
 * @param   {string} id - Container ID or name
 * @query   {number} tail - Number of lines to tail (default: 100)
 * @query   {boolean} follow - Stream logs in real-time (default: false)
 * @query   {boolean} stdout - Include stdout logs (default: true)
 * @query   {boolean} stderr - Include stderr logs (default: true)
 * @query   {boolean} timestamps - Show timestamps (default: true)
 * @example GET /api/docker/containers/my-container/logs?tail=200&timestamps=true
 */
router.get('/containers/:id/logs', dockerController.getContainerLogs);

/**
 * @route   GET /api/docker/containers/:id/stats
 * @desc    Get real-time container statistics (CPU, memory, network, block I/O)
 * @access  Admin only
 * @param   {string} id - Container ID or name
 * @query   {boolean} stream - Stream stats continuously (default: false)
 * @returns {object} Container resource usage statistics
 * @example GET /api/docker/containers/my-container/stats
 */
router.get('/containers/:id/stats', dockerController.getContainerStats);

/**
 * @route   DELETE /api/docker/containers/:id
 * @desc    Remove a container
 * @access  Admin only
 * @param   {string} id - Container ID or name
 * @query   {boolean} force - Force removal of running container (default: false)
 * @query   {boolean} volumes - Remove associated volumes (default: false)
 * @example DELETE /api/docker/containers/my-container?force=true&volumes=true
 */
router.delete('/containers/:id', dockerController.removeContainer);

/**
 * OpenVPN Container Creation Route
 */

/**
 * @route   POST /api/docker/openvpn/create
 * @desc    Create a new OpenVPN container with custom configuration
 * @access  Admin only
 * @body    {string} name - Container name (required)
 * @body    {number} port - Host port to bind to container port 1194 (default: 1194)
 * @body    {array} volumes - Volume mappings in format ["host:container"] (optional)
 * @body    {array} env - Environment variables in format ["KEY=value"] (optional)
 * @body    {string} image - Docker image to use (default: 'kylemanna/openvpn')
 * @returns {object} Created container information
 * @example POST /api/docker/openvpn/create
 * {
 *   "name": "openvpn-server",
 *   "port": 1194,
 *   "volumes": ["/data/openvpn:/etc/openvpn"],
 *   "env": ["OVPN_SERVER=vpn.example.com"],
 *   "image": "kylemanna/openvpn:latest"
 * }
 */
router.post('/openvpn/create', dockerController.createOpenVPNContainer);

/**
 * Docker System Information Routes
 */

/**
 * @route   GET /api/docker/info
 * @desc    Get Docker system information and version
 * @access  Admin only
 * @returns {object} Docker daemon information including version, storage driver, containers, images
 * @example GET /api/docker/info
 */
router.get('/info', dockerController.getDockerInfo);

/**
 * Image Management Routes
 */

/**
 * @route   GET /api/docker/images
 * @desc    List all Docker images
 * @access  Admin only
 * @query   {boolean} all - Show all images including intermediate layers (default: false)
 * @query   {string} filters - JSON string for filtering images
 * @returns {array} List of Docker images with tags and sizes
 * @example GET /api/docker/images?all=false
 */
router.get('/images', dockerController.listImages);

/**
 * @route   POST /api/docker/images/pull
 * @desc    Pull a Docker image from registry
 * @access  Admin only
 * @body    {string} imageName - Image name (required)
 * @body    {string} tag - Image tag (default: 'latest')
 * @returns {object} Success message with pulled image name
 * @example POST /api/docker/images/pull
 * {
 *   "imageName": "kylemanna/openvpn",
 *   "tag": "latest"
 * }
 */
router.post('/images/pull', dockerController.pullImage);

module.exports = router;
