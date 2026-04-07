-- =========================================================
-- DB Migration: Add Slip Review Workflow
-- Run once against your fish_market database
-- =========================================================

-- 1. Update shared_slips table to support approve/reject workflow
ALTER TABLE shared_slips
  MODIFY COLUMN status ENUM('sent', 'read', 'approved', 'rejected') NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL;

-- 2. Create notifications table for in-app agent alerts
CREATE TABLE IF NOT EXISTS notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     VARCHAR(1000) NOT NULL,
  type        ENUM('info', 'success', 'warning', 'error') NOT NULL DEFAULT 'info',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_notify_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

-- Index for fast notification fetching
CREATE INDEX IF NOT EXISTS idx_notifications_user 
  ON notifications(user_id, is_read);
