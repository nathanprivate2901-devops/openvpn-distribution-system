-- OpenVPN Distribution System Database Setup
-- Run this script to create the database and tables

-- Create database
CREATE DATABASE IF NOT EXISTS openvpn_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE openvpn_system;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB;

-- Verification tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB;

-- Config files table
CREATE TABLE IF NOT EXISTS config_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  downloaded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- QoS policies table
CREATE TABLE IF NOT EXISTS qos_policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  max_bandwidth_mbps INT NOT NULL,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_priority (priority)
) ENGINE=InnoDB;

-- User QoS assignments table
CREATE TABLE IF NOT EXISTS user_qos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  qos_policy_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (qos_policy_id) REFERENCES qos_policies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_qos (user_id),
  INDEX idx_qos_policy_id (qos_policy_id)
) ENGINE=InnoDB;

-- Insert default admin user
-- Username: admin
-- Password: admin123
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO users (username, email, password, role, is_verified)
VALUES ('admin', 'admin@example.com', '$2a$10$X5wKvZ5zQP.yH0YC3zqkHORgVJOv8kqBxnZ5KqYqBN4vKLxZqGNJy', 'admin', TRUE)
ON DUPLICATE KEY UPDATE username=username;

-- Insert default QoS policies
INSERT INTO qos_policies (name, max_bandwidth_mbps, priority, description)
VALUES
  ('Basic', 10, 'low', 'Basic bandwidth for standard users'),
  ('Standard', 50, 'medium', 'Standard bandwidth for regular users'),
  ('Premium', 100, 'high', 'Premium bandwidth for priority users'),
  ('Enterprise', 1000, 'high', 'Enterprise level bandwidth')
ON DUPLICATE KEY UPDATE name=name;

-- Display setup completion message
SELECT 'Database setup completed successfully!' AS message;
SELECT 'Default admin credentials:' AS info;
SELECT 'Username: admin' AS username;
SELECT 'Password: admin123' AS password;
SELECT 'IMPORTANT: Change the admin password immediately!' AS warning;
