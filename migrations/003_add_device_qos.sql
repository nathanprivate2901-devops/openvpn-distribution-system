-- ============================================================================
-- Migration: Add Device QoS Policy Assignment
-- ============================================================================
-- This migration adds support for assigning QoS policies to individual devices
-- in addition to user-level QoS policies.
--
-- Usage:
--   mysql -u root -p openvpn_system < migrations/003_add_device_qos.sql
-- ============================================================================

USE openvpn_system;

-- ============================================================================
-- Table: device_qos
-- ============================================================================
-- Junction table for assigning QoS policies to individual devices
-- Allows per-device QoS control, overriding user-level policies if set
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_qos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id INT UNSIGNED NOT NULL,
  qos_policy_id INT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by INT UNSIGNED NULL COMMENT 'Admin user ID who assigned the policy',
  notes TEXT NULL COMMENT 'Optional notes about the assignment',
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (qos_policy_id) REFERENCES qos_policies(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_device_qos (device_id, qos_policy_id) COMMENT 'Prevent duplicate assignments'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Device to QoS policy assignments';

-- Indexes for device_qos table
CREATE INDEX idx_device_qos_device_id ON device_qos(device_id);
CREATE INDEX idx_device_qos_qos_policy_id ON device_qos(qos_policy_id);
CREATE INDEX idx_device_qos_assigned_at ON device_qos(assigned_at);
CREATE INDEX idx_device_qos_assigned_by ON device_qos(assigned_by);

-- ============================================================================
-- View: Devices with QoS policies
-- ============================================================================
-- Provides a comprehensive view of all devices with their assigned QoS policies
-- Shows both user-level and device-level QoS assignments
-- ============================================================================

CREATE OR REPLACE VIEW v_devices_with_qos AS
SELECT
  d.id AS device_id,
  d.name AS device_name,
  d.device_id AS device_identifier,
  d.device_type,
  d.user_id,
  u.name AS user_name,
  u.email AS user_email,
  -- Device-specific QoS policy (takes precedence)
  dqp.id AS device_qos_policy_id,
  dqp.name AS device_qos_policy_name,
  dqp.bandwidth_limit AS device_bandwidth_limit,
  dqp.priority AS device_priority,
  dq.assigned_at AS device_qos_assigned_at,
  -- User-level QoS policy (fallback)
  uqp.id AS user_qos_policy_id,
  uqp.name AS user_qos_policy_name,
  uqp.bandwidth_limit AS user_bandwidth_limit,
  uqp.priority AS user_priority,
  uq.assigned_at AS user_qos_assigned_at,
  -- Effective QoS policy (device-level if exists, otherwise user-level)
  COALESCE(dqp.id, uqp.id) AS effective_qos_policy_id,
  COALESCE(dqp.name, uqp.name) AS effective_qos_policy_name,
  COALESCE(dqp.bandwidth_limit, uqp.bandwidth_limit) AS effective_bandwidth_limit,
  COALESCE(dqp.priority, uqp.priority) AS effective_priority,
  d.last_connected,
  d.last_ip,
  d.is_active
FROM devices d
LEFT JOIN users u ON d.user_id = u.id
-- Device-level QoS
LEFT JOIN device_qos dq ON d.id = dq.device_id
LEFT JOIN qos_policies dqp ON dq.qos_policy_id = dqp.id
-- User-level QoS
LEFT JOIN user_qos uq ON u.id = uq.user_id
LEFT JOIN qos_policies uqp ON uq.qos_policy_id = uqp.id
WHERE u.deleted_at IS NULL
ORDER BY d.created_at DESC;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The following features are now available:
-- 1. Assign QoS policies to individual devices (device_qos table)
-- 2. Device-level policies override user-level policies
-- 3. Track who assigned the policy and when
-- 4. View all devices with effective QoS policies (v_devices_with_qos)
-- ============================================================================
