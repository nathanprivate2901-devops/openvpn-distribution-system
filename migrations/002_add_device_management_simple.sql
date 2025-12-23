-- Device Management - Simplified Migration
-- This creates the devices table for tracking user devices
-- Note: Devices are NOT locked to VPN profiles - profiles can be used on any device

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    device_id VARCHAR(64) NOT NULL UNIQUE,
    device_type ENUM('desktop', 'laptop', 'mobile', 'tablet') NOT NULL DEFAULT 'desktop',
    last_connected TIMESTAMP NULL DEFAULT NULL,
    last_ip VARCHAR(45) NULL DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_devices (user_id),
    INDEX idx_device_id (device_id),
    INDEX idx_device_type (device_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add device limit column to users table (ignore if already exists)
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'users' 
     AND COLUMN_NAME = 'max_devices') = 0,
    'ALTER TABLE users ADD COLUMN max_devices INT DEFAULT 3 COMMENT "Maximum number of devices user can register"',
    'SELECT "Column max_devices already exists" AS message'
);

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
