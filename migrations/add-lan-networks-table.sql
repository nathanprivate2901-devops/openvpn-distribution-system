-- ============================================================================
-- Migration: Add user_lan_networks table
-- Description: Allows users to define custom LAN networks for VPN routing
-- Date: 2025-11-07
-- ============================================================================

USE openvpn_system;

-- ============================================================================
-- Table: user_lan_networks
-- ============================================================================
-- Stores user-defined LAN networks that should be routed through VPN
-- Each user can have multiple networks (home, office, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_lan_networks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  network_cidr VARCHAR(50) NOT NULL COMMENT 'Network in CIDR notation (e.g., 192.168.1.0/24)',
  network_ip VARCHAR(15) NOT NULL COMMENT 'Network IP address',
  subnet_mask VARCHAR(15) NOT NULL COMMENT 'Subnet mask (e.g., 255.255.255.0)',
  description VARCHAR(255) DEFAULT NULL COMMENT 'User-friendly description (e.g., Home Network)',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0 = disabled, 1 = enabled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key constraint
  CONSTRAINT fk_lan_networks_user 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE,
  
  -- Unique constraint: prevent duplicate networks per user
  UNIQUE KEY unique_user_network (user_id, network_cidr)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='User-defined LAN networks for VPN routing';

-- Indexes for performance
CREATE INDEX idx_lan_networks_user_id ON user_lan_networks(user_id);
CREATE INDEX idx_lan_networks_enabled ON user_lan_networks(enabled);

-- ============================================================================
-- Insert sample data (optional - for testing)
-- ============================================================================

-- Sample LAN networks for admin user (ID: 1)
INSERT INTO user_lan_networks (user_id, network_cidr, network_ip, subnet_mask, description, enabled)
VALUES 
  (1, '192.168.1.0/24', '192.168.1.0', '255.255.255.0', 'Home Network', 1),
  (1, '10.0.0.0/24', '10.0.0.0', '255.255.255.0', 'Office Network', 1)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the table was created successfully:
-- SELECT * FROM user_lan_networks;
-- DESCRIBE user_lan_networks;
-- ============================================================================
