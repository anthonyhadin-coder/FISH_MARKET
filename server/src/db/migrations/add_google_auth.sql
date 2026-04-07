-- =========================================================
-- DB Migration: Add Google OAuth fields to users table
-- Run once against your fish_market database
-- =========================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id      VARCHAR(255) UNIQUE NULL,
  ADD COLUMN IF NOT EXISTS google_email   VARCHAR(255)        NULL,
  ADD COLUMN IF NOT EXISTS google_picture VARCHAR(500)        NULL,
  ADD COLUMN IF NOT EXISTS auth_provider  ENUM('phone', 'google', 'both') 
                                          NOT NULL DEFAULT 'phone';

-- Index for fast Google ID lookup on every login
CREATE INDEX IF NOT EXISTS idx_google_id ON users(google_id);
