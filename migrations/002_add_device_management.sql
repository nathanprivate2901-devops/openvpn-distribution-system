-- Device Management Tables

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    device_id VARCHAR(64) NOT NULL UNIQUE,
    device_type VARCHAR(50),
    last_connected TIMESTAMP,
    last_ip VARCHAR(45),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_devices (user_id),
    INDEX idx_device_id (device_id)
);

-- Create device_profiles table to link devices with VPN profiles
CREATE TABLE IF NOT EXISTS device_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL,
    config_file_id INT NOT NULL,
    profile_name VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (config_file_id) REFERENCES config_files(id) ON DELETE CASCADE,
    INDEX idx_device_profiles (device_id, config_file_id)
);

-- Add device limit column to users table
ALTER TABLE users
ADD COLUMN max_devices INT DEFAULT 3;