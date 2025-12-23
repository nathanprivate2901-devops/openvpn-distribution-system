const Device = require('../models/Device');
const logger = require('../utils/logger');

/**
 * Device Controller
 * Handles device viewing and management endpoints
 * Note: Devices are automatically created when users connect to VPN
 */
const deviceController = {
    /**
     * Get user's devices
     * GET /api/devices
     */
    async getDevices(req, res) {
        try {
            const devices = await Device.findByUserId(req.user.id);
            
            res.json({
                success: true,
                data: devices
            });
        } catch (error) {
            logger.error('Error in getDevices:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve devices',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Get device by ID
     * GET /api/devices/:id
     */
    async getDevice(req, res) {
        try {
            const device = await Device.findById(req.params.id);
            
            if (!device || device.user_id !== req.user.id) {
                return res.status(404).json({
                    success: false,
                    message: 'Device not found'
                });
            }

            res.json({
                success: true,
                data: device
            });
        } catch (error) {
            logger.error('Error in getDevice:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve device',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Update device
     * PUT /api/devices/:id
     */
    async updateDevice(req, res) {
        try {
            const device = await Device.findById(req.params.id);
            
            if (!device || device.user_id !== req.user.id) {
                return res.status(404).json({
                    success: false,
                    message: 'Device not found'
                });
            }

            const updatedDevice = await Device.update(req.params.id, req.body);

            res.json({
                success: true,
                message: 'Device updated successfully',
                data: updatedDevice
            });
        } catch (error) {
            logger.error('Error in updateDevice:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update device',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Delete device
     * DELETE /api/devices/:id
     */
    async deleteDevice(req, res) {
        try {
            const device = await Device.findById(req.params.id);
            
            if (!device || device.user_id !== req.user.id) {
                return res.status(404).json({
                    success: false,
                    message: 'Device not found'
                });
            }

            await Device.delete(req.params.id);

            res.json({
                success: true,
                message: 'Device deleted successfully'
            });
        } catch (error) {
            logger.error('Error in deleteDevice:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete device',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = deviceController;