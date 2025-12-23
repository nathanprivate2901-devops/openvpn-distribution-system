-- Fix device_id unique constraint to allow VPN IP reuse across users
-- This migration changes the UNIQUE constraint from device_id alone
-- to a composite unique constraint on (user_id, device_id)

-- Drop the old unique constraint on device_id
ALTER TABLE devices DROP INDEX device_id;

-- Add a composite unique constraint on (user_id, device_id)
-- This allows the same VPN IP to be reused by different users
ALTER TABLE devices ADD UNIQUE KEY unique_user_device (user_id, device_id);

-- Add index for faster lookups
ALTER TABLE devices ADD INDEX idx_user_device (user_id, device_id);
