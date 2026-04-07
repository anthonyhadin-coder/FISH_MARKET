-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: fix_send_to_owner.sql
-- Run: mysql -u root -p fish_market < server/src/db/migrations/fix_send_to_owner.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 1. Boat Reports Table
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS boat_reports (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  boat_id        INT NOT NULL,
  agent_id       INT NOT NULL,
  owner_id       INT NOT NULL,
  report_date    DATE NOT NULL,
  total_weight   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_amount   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status         ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reject_reason  VARCHAR(500) NULL,
  sent_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at    DATETIME NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Prevent duplicate report for same boat+date
  UNIQUE KEY unique_boat_date (boat_id, report_date),

  CONSTRAINT fk_report_boat  FOREIGN KEY (boat_id)  REFERENCES boats(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_agent FOREIGN KEY (agent_id) REFERENCES users(id),
  CONSTRAINT fk_report_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- ─────────────────────────────────────
-- 2. Report Items (catch snapshot)
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS boat_report_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  report_id   INT NOT NULL,
  fish_name   VARCHAR(100) NOT NULL,
  weight      DECIMAL(10,2) NOT NULL,
  rate        DECIMAL(10,2) NOT NULL,
  total       DECIMAL(12,2) GENERATED ALWAYS AS (weight * rate) STORED,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_item_report FOREIGN KEY (report_id) REFERENCES boat_reports(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────
-- 3. Performance Indexes
-- ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_report_owner ON boat_reports(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_report_boat  ON boat_reports(boat_id, report_date);
CREATE INDEX IF NOT EXISTS idx_report_agent ON boat_reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_items_report ON boat_report_items(report_id);

-- ─────────────────────────────────────
-- 4. Verify migration succeeded
-- ─────────────────────────────────────
SELECT 'boat_reports created ✅'      AS status WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'boat_reports');
SELECT 'boat_report_items created ✅' AS status WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'boat_report_items');
