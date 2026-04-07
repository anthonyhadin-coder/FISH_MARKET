-- =========================================================
-- DB Migration: Add security & refresh token fields
-- Run once against your fish_market database
-- =========================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255)  NULL,
  ADD COLUMN IF NOT EXISTS failed_attempts     INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active           BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS locked_until        DATETIME     NULL,
  ADD COLUMN IF NOT EXISTS last_login          DATETIME     NULL,
  ADD COLUMN IF NOT EXISTS auth_provider       ENUM('phone','google','both') NOT NULL DEFAULT 'phone';

-- Index for fast refresh-token lookup
CREATE INDEX IF NOT EXISTS idx_refresh_token ON users(refresh_token_hash(64));
