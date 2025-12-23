const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Device Model
 * Tracks devices that connect to the VPN (view-only, auto-created on connection)
 */
class Device {
    /**
     * Find device by ID
     * @param {number} id - Device ID
     * @returns {Promise<Object>} Device object
     */
    static async findById(id) {
        const query = `
            SELECT * FROM devices WHERE id = ?
        `;

        try {
            const [devices] = await pool.execute(query, [id]);
            return devices[0];
        } catch (error) {
            logger.error('Error in Device.findById:', error);
            throw error;
        }
    }

    /**
     * Find all devices for a user
     * @param {number} userId - User ID
     * @returns {Promise<Array>} Array of device objects
     */
    static async findByUserId(userId) {
        const query = `
            SELECT * FROM devices 
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;

        try {
            const [devices] = await pool.execute(query, [userId]);
            return devices;
        } catch (error) {
            logger.error('Error in Device.findByUserId:', error);
            throw error;
        }
    }

    /**
     * Update device details
     * @param {number} id - Device ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated device object
     */
    static async update(id, updates) {
        const allowedFields = ['name', 'device_type', 'is_active'];
        const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
        
        if (fields.length === 0) {
            return this.findById(id);
        }

        const query = `
            UPDATE devices 
            SET ${fields.map(f => `${f} = ?`).join(', ')}
            WHERE id = ?
        `;

        try {
            const values = [...fields.map(f => updates[f]), id];
            await pool.execute(query, values);
            return this.findById(id);
        } catch (error) {
            logger.error('Error in Device.update:', error);
            throw error;
        }
    }

    /**
     * Delete a device and its associated profiles
     * @param {number} id - Device ID
     * @returns {Promise<boolean>} Success status
     */
    static async delete(id) {
        const query = 'DELETE FROM devices WHERE id = ?';

        try {
            await pool.execute(query, [id]);
            return true;
        } catch (error) {
            logger.error('Error in Device.delete:', error);
            throw error;
        }
    }

    /**
     * Count active devices for a user
     * @param {number} userId - User ID
     * @returns {Promise<number>} Number of active devices
     */
    static async countActiveDevices(userId) {
        const query = `
            SELECT COUNT(*) as count 
            FROM devices 
            WHERE user_id = ? AND is_active = TRUE
        `;

        try {
            const [result] = await pool.execute(query, [userId]);
            return result[0].count;
        } catch (error) {
            logger.error('Error in Device.countActiveDevices:', error);
            throw error;
        }
    }

    /**
     * Update device last connection
     * @param {number} id - Device ID
     * @param {string} ip - IP address
     * @returns {Promise<Object>} Updated device object
     */
    static async updateLastConnection(id, ip) {
        const query = `
            UPDATE devices 
            SET last_connected = CURRENT_TIMESTAMP, last_ip = ?
            WHERE id = ?
        `;

        try {
            await pool.execute(query, [ip, id]);
            return this.findById(id);
        } catch (error) {
            logger.error('Error in Device.updateLastConnection:', error);
            throw error;
        }
    }

    /**
     * Get all devices (admin only)
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     * @returns {Promise<Object>} Paginated devices with total count
     */
    static async getAllDevices(page = 1, limit = 10) {
        // Ensure parameters are integers - handle null, undefined, NaN, and strings
        let pageNum = 1;
        let limitNum = 10;
        
        if (page !== null && page !== undefined && page !== '') {
            const parsedPage = parseInt(page, 10);
            if (!isNaN(parsedPage) && parsedPage > 0) {
                pageNum = parsedPage;
            }
        }
        
        if (limit !== null && limit !== undefined && limit !== '') {
            const parsedLimit = parseInt(limit, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                limitNum = parsedLimit;
            }
        }
        
        const offset = (pageNum - 1) * limitNum;
        
        // Build query with values directly embedded (safe since we validated integers)
        const query = `SELECT d.*, u.email as user_email, u.name as user_name FROM devices d JOIN users u ON d.user_id = u.id ORDER BY d.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;
        const countQuery = 'SELECT COUNT(*) as total FROM devices';

        try {
            logger.debug('getAllDevices query:', { query, limitNum, offset });
            
            // pool.query() returns the rows array directly (not [rows, fields])
            const devices = await pool.query(query);
            
            logger.debug('Devices result:', { 
                type: typeof devices, 
                isArray: Array.isArray(devices), 
                length: devices?.length 
            });
            
            const countResult = await pool.query(countQuery);
            logger.debug('Count result raw:', { 
                type: typeof countResult, 
                isArray: Array.isArray(countResult),
                length: countResult?.length,
                first: countResult[0],
                firstIsArray: Array.isArray(countResult[0])
            });
            
            // countResult is also the rows array directly
            const total = countResult[0]?.total || 0;
            const totalPages = Math.ceil(total / limitNum);
            
            logger.debug('Final values:', { total, totalPages, deviceCount: devices.length });
            
            return {
                data: devices,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: total,
                    totalPages: totalPages
                }
            };
        } catch (error) {
            logger.error('Error in Device.getAllDevices:', error);
            logger.error('Query parameters were:', { limitNum, offset, types: { limitNum: typeof limitNum, offset: typeof offset } });
            throw error;
        }
    }

    /**
     * ============================================================================
     * QoS POLICY INTEGRATION METHODS
     * Methods for managing device-level QoS policies
     * ============================================================================
     */

    /**
     * Get device with its assigned QoS policy
     * @param {number} id - Device ID
     * @returns {Promise<Object|null>} Device object with QoS policy or null
     */
    static async findByIdWithQos(id) {
        const query = `
            SELECT 
                d.*,
                u.email as user_email,
                u.name as user_name,
                qp.id as qos_policy_id,
                qp.name as qos_policy_name,
                qp.bandwidth_limit,
                qp.priority as qos_priority,
                qp.description as qos_description,
                dq.assigned_at as qos_assigned_at,
                dq.notes as qos_notes,
                'device' as qos_source
            FROM devices d
            LEFT JOIN users u ON d.user_id = u.id
            LEFT JOIN device_qos dq ON d.id = dq.device_id
            LEFT JOIN qos_policies qp ON dq.qos_policy_id = qp.id
            WHERE d.id = ?
        `;

        try {
            const [devices] = await pool.execute(query, [id]);
            
            if (devices.length === 0) {
                return null;
            }

            const device = devices[0];

            // If device doesn't have device-specific QoS, check for user-level QoS
            if (!device.qos_policy_id) {
                const userQosQuery = `
                    SELECT 
                        qp.id as qos_policy_id,
                        qp.name as qos_policy_name,
                        qp.bandwidth_limit,
                        qp.priority as qos_priority,
                        qp.description as qos_description,
                        uq.assigned_at as qos_assigned_at,
                        'user' as qos_source
                    FROM user_qos uq
                    INNER JOIN qos_policies qp ON uq.qos_policy_id = qp.id
                    WHERE uq.user_id = ?
                `;

                const [userQos] = await pool.execute(userQosQuery, [device.user_id]);
                
                if (userQos.length > 0) {
                    // Merge user-level QoS into device object
                    Object.assign(device, userQos[0]);
                }
            }

            return device;
        } catch (error) {
            logger.error('Error in Device.findByIdWithQos:', error);
            throw error;
        }
    }

    /**
     * Get all devices for a user with their QoS policies
     * @param {number} userId - User ID
     * @returns {Promise<Array>} Array of device objects with QoS info
     */
    static async findByUserIdWithQos(userId) {
        const query = `
            SELECT 
                d.*,
                qp.id as qos_policy_id,
                qp.name as qos_policy_name,
                qp.bandwidth_limit,
                qp.priority as qos_priority,
                qp.description as qos_description,
                dq.assigned_at as qos_assigned_at,
                'device' as qos_source
            FROM devices d
            LEFT JOIN device_qos dq ON d.id = dq.device_id
            LEFT JOIN qos_policies qp ON dq.qos_policy_id = qp.id
            WHERE d.user_id = ?
            ORDER BY d.created_at DESC
        `;

        try {
            const [devices] = await pool.execute(query, [userId]);

            // For devices without device-specific QoS, get user-level QoS
            const userQosQuery = `
                SELECT 
                    qp.id as qos_policy_id,
                    qp.name as qos_policy_name,
                    qp.bandwidth_limit,
                    qp.priority as qos_priority,
                    qp.description as qos_description,
                    uq.assigned_at as qos_assigned_at
                FROM user_qos uq
                INNER JOIN qos_policies qp ON uq.qos_policy_id = qp.id
                WHERE uq.user_id = ?
            `;

            const [userQos] = await pool.execute(userQosQuery, [userId]);
            const userQosData = userQos.length > 0 ? userQos[0] : null;

            // Apply user-level QoS to devices without device-specific QoS
            return devices.map(device => {
                if (!device.qos_policy_id && userQosData) {
                    return {
                        ...device,
                        ...userQosData,
                        qos_source: 'user'
                    };
                }
                return device;
            });
        } catch (error) {
            logger.error('Error in Device.findByUserIdWithQos:', error);
            throw error;
        }
    }

    /**
     * Get all devices with their effective QoS policies (admin only)
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     * @returns {Promise<Object>} Paginated devices with QoS info and total count
     */
    static async getAllDevicesWithQos(page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        
        // Use the database view for efficient querying
        const query = `
            SELECT 
                device_id,
                device_name,
                device_identifier,
                device_type,
                user_id,
                user_name,
                user_email,
                device_qos_policy_id,
                device_qos_policy_name,
                device_bandwidth_limit,
                device_priority,
                device_qos_assigned_at,
                user_qos_policy_id,
                user_qos_policy_name,
                user_bandwidth_limit,
                user_priority,
                user_qos_assigned_at,
                effective_qos_policy_id,
                effective_qos_policy_name,
                effective_bandwidth_limit,
                effective_priority,
                last_connected,
                last_ip,
                is_active
            FROM v_devices_with_qos
            ORDER BY device_id DESC
            LIMIT ? OFFSET ?
        `;

        const countQuery = 'SELECT COUNT(*) as total FROM devices';

        try {
            const [devices] = await pool.execute(query, [limit, offset]);
            const [countResult] = await pool.execute(countQuery);
            
            return {
                devices,
                total: countResult[0].total,
                page,
                totalPages: Math.ceil(countResult[0].total / limit)
            };
        } catch (error) {
            logger.error('Error in Device.getAllDevicesWithQos:', error);
            throw error;
        }
    }
}

module.exports = Device;