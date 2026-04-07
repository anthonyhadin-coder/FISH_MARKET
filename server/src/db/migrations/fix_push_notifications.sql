-- ═══════════════════════════════════════
-- MIGRATION: fix_push_notifications.sql
-- ═══════════════════════════════════════

-- ─────────────────────────────────────
-- 1. Push Subscriptions Table
-- Stores device push tokens per user
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  endpoint     TEXT NOT NULL,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  device_info  VARCHAR(255) NULL,
  is_active    BOOLEAN DEFAULT true,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_push_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  -- One subscription per endpoint per user
  UNIQUE KEY unique_user_endpoint
    (user_id, endpoint(500))
);

-- ─────────────────────────────────────
-- 2. Update notifications table
-- Add push delivery tracking
-- ─────────────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS
    push_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS
    push_sent_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS
    push_error VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS
    deep_link VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS
    notification_type ENUM(
      'report_ready',
      'report_approved',
      'report_rejected',
      'sync_complete',
      'catch_target_met',
      'general'
    ) DEFAULT 'general';

-- ─────────────────────────────────────
-- 3. Indexes
-- ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS
  idx_push_user_active
  ON push_subscriptions(user_id, is_active);

CREATE INDEX IF NOT EXISTS
  idx_notif_user_unread
  ON notifications(user_id, push_sent);
