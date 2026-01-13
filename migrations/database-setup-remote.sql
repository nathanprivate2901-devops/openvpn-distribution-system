-- ============================================================================
-- OpenVPN Distribution System - Remote Database Schema
-- ============================================================================
-- This script creates tables for the remote MySQL database
-- WITHOUT dropping or creating the database (user may not have those privileges)
--
-- Usage: mysql -h mysql.toolhub.app -P 3306 -u namtt -p vpn_nam < database-setup-remote.sql
-- ============================================================================

-- ============================================================================
-- Table: users
-- ============================================================================
-- Stores user account information including authentication credentials
-- Supports soft delete via deleted_at column
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL COMMENT 'Bcrypt hashed password',
  name VARCHAR(100) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  email_verified TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 = not verified, 1 = verified',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User accounts and authentication';

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- ============================================================================
-- Table: verification_tokens
-- ============================================================================
-- Stores email verification tokens with expiration
-- Tokens are typically valid for 24 hours
-- ============================================================================

CREATE TABLE IF NOT EXISTS verification_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE COMMENT 'Secure random token',
  expires_at TIMESTAMP NOT NULL COMMENT 'Token expiration time',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Email verification tokens';

-- Indexes for verification_tokens table
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_id ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at ON verification_tokens(expires_at);

-- ============================================================================
-- Table: qos_policies
-- ============================================================================
-- Defines Quality of Service policies for bandwidth management
-- Policies can be assigned to multiple users
-- ============================================================================

CREATE TABLE IF NOT EXISTS qos_policies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  bandwidth_limit INT UNSIGNED NOT NULL COMMENT 'Bandwidth limit in Kbps',
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='QoS bandwidth policies';

-- Indexes for qos_policies table
CREATE INDEX IF NOT EXISTS idx_qos_policies_name ON qos_policies(name);
CREATE INDEX IF NOT EXISTS idx_qos_policies_priority ON qos_policies(priority);

-- ============================================================================
-- Table: config_files
-- ============================================================================
-- Stores OpenVPN configuration files generated for users
-- Tracks downloads, revocations, and associated QoS policies
-- ============================================================================

CREATE TABLE IF NOT EXISTS config_files (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  qos_policy_id INT UNSIGNED NULL COMMENT 'Associated QoS policy, NULL if no policy',
  filename VARCHAR(255) NOT NULL,
  content TEXT NOT NULL COMMENT 'Complete OpenVPN configuration content',
  downloaded_at TIMESTAMP NULL DEFAULT NULL COMMENT 'First download timestamp',
  revoked_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Revocation timestamp for soft delete',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (qos_policy_id) REFERENCES qos_policies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='OpenVPN configuration files';

-- Indexes for config_files table
CREATE INDEX IF NOT EXISTS idx_config_files_user_id ON config_files(user_id);
CREATE INDEX IF NOT EXISTS idx_config_files_qos_policy_id ON config_files(qos_policy_id);
CREATE INDEX IF NOT EXISTS idx_config_files_filename ON config_files(filename);
CREATE INDEX IF NOT EXISTS idx_config_files_revoked_at ON config_files(revoked_at);
CREATE INDEX IF NOT EXISTS idx_config_files_downloaded_at ON config_files(downloaded_at);

-- ============================================================================
-- Table: user_qos
-- ============================================================================
-- Junction table for many-to-many relationship between users and QoS policies
-- Allows users to have multiple QoS policies assigned
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_qos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  qos_policy_id INT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (qos_policy_id) REFERENCES qos_policies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_qos (user_id, qos_policy_id) COMMENT 'Prevent duplicate assignments'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User to QoS policy assignments';

-- Indexes for user_qos table
CREATE INDEX IF NOT EXISTS idx_user_qos_user_id ON user_qos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_qos_qos_policy_id ON user_qos(qos_policy_id);
CREATE INDEX IF NOT EXISTS idx_user_qos_assigned_at ON user_qos(assigned_at);

-- ============================================================================
-- Database Information Views
-- ============================================================================
-- Optional: Create views for easier data access and reporting
-- ============================================================================

-- Drop existing views if they exist
DROP VIEW IF EXISTS v_active_users_with_qos;
DROP VIEW IF EXISTS v_active_configs;
DROP VIEW IF EXISTS v_system_stats;

-- View: Active users with their QoS policies
CREATE VIEW v_active_users_with_qos AS
SELECT
  u.id,
  u.username,
  u.email,
  u.name,
  u.role,
  u.email_verified,
  GROUP_CONCAT(qp.name SEPARATOR ', ') AS qos_policies,
  u.created_at
FROM users u
LEFT JOIN user_qos uq ON u.id = uq.user_id
LEFT JOIN qos_policies qp ON uq.qos_policy_id = qp.id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.username, u.email, u.name, u.role, u.email_verified, u.created_at;

-- View: Active configuration files
CREATE VIEW v_active_configs AS
SELECT
  cf.id,
  cf.filename,
  u.username,
  u.email,
  qp.name AS qos_policy,
  cf.downloaded_at,
  cf.created_at
FROM config_files cf
INNER JOIN users u ON cf.user_id = u.id
LEFT JOIN qos_policies qp ON cf.qos_policy_id = qp.id
WHERE cf.revoked_at IS NULL
  AND u.deleted_at IS NULL
ORDER BY cf.created_at DESC;

-- View: System statistics
CREATE VIEW v_system_stats AS
SELECT
  (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS total_users,
  (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role = 'admin') AS admin_users,
  (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND email_verified = 1) AS verified_users,
  (SELECT COUNT(*) FROM config_files WHERE revoked_at IS NULL) AS active_configs,
  (SELECT COUNT(*) FROM config_files WHERE revoked_at IS NOT NULL) AS revoked_configs,
  (SELECT COUNT(*) FROM qos_policies) AS total_qos_policies,
  (SELECT COUNT(*) FROM user_qos) AS total_qos_assignments;

-- ============================================================================
-- Stored Procedures
-- ============================================================================

-- Drop existing procedures if they exist
DROP PROCEDURE IF EXISTS sp_cleanup_expired_tokens;
DROP PROCEDURE IF EXISTS sp_get_user_stats;
DROP PROCEDURE IF EXISTS sp_soft_delete_user;

-- Procedure: Clean up expired verification tokens
DELIMITER //
CREATE PROCEDURE sp_cleanup_expired_tokens()
BEGIN
  DELETE FROM verification_tokens
  WHERE expires_at < NOW();

  SELECT ROW_COUNT() AS deleted_tokens;
END //
DELIMITER ;

-- Procedure: Get user statistics
DELIMITER //
CREATE PROCEDURE sp_get_user_stats(IN p_user_id INT UNSIGNED)
BEGIN
  SELECT
    u.id,
    u.username,
    u.email,
    u.name,
    u.role,
    u.email_verified,
    u.created_at,
    COUNT(DISTINCT cf.id) AS total_configs,
    COUNT(DISTINCT CASE WHEN cf.revoked_at IS NULL THEN cf.id END) AS active_configs,
    COUNT(DISTINCT uq.qos_policy_id) AS assigned_qos_policies,
    MAX(cf.created_at) AS last_config_generated
  FROM users u
  LEFT JOIN config_files cf ON u.id = cf.user_id
  LEFT JOIN user_qos uq ON u.id = uq.user_id
  WHERE u.id = p_user_id
    AND u.deleted_at IS NULL
  GROUP BY u.id, u.username, u.email, u.name, u.role, u.email_verified, u.created_at;
END //
DELIMITER ;

-- Procedure: Soft delete user
DELIMITER //
CREATE PROCEDURE sp_soft_delete_user(IN p_user_id INT UNSIGNED)
BEGIN
  UPDATE users
  SET deleted_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id
    AND deleted_at IS NULL;

  SELECT ROW_COUNT() AS affected_rows;
END //
DELIMITER ;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS tr_config_files_before_insert;

-- Trigger: Auto-update config filename on insert
DELIMITER //
CREATE TRIGGER tr_config_files_before_insert
BEFORE INSERT ON config_files
FOR EACH ROW
BEGIN
  IF NEW.filename IS NULL OR NEW.filename = '' THEN
    SET NEW.filename = CONCAT('openvpn_', NEW.user_id, '_', UNIX_TIMESTAMP(), '.ovpn');
  END IF;
END //
DELIMITER ;

-- ============================================================================
-- Setup Complete
-- ============================================================================

SELECT 'Remote database schema setup completed successfully!' AS Status;
SELECT COUNT(*) AS Tables FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';
SELECT COUNT(*) AS Views FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_type = 'VIEW';
SELECT COUNT(*) AS StoredProcedures FROM information_schema.routines
  WHERE routine_schema = DATABASE() AND routine_type = 'PROCEDURE';
