-- ============================================================================
-- Password Reset Tokens Table Migration
-- ============================================================================
-- Adds password_reset_tokens table for handling password reset requests
-- ============================================================================

USE openvpn_system;

-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE COMMENT 'Secure random token',
  expires_at TIMESTAMP NOT NULL COMMENT 'Token expiration time (1 hour)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when token was used',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Password reset tokens';

-- Indexes for password_reset_tokens table
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_reset_tokens_used_at ON password_reset_tokens(used_at);

SELECT 'Password reset tokens table created successfully!' AS Status;
