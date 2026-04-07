CREATE TABLE IF NOT EXISTS beta_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    type ENUM('feedback', 'bug') NOT NULL,
    rating INT,
    message TEXT NOT NULL,
    user_agent TEXT,
    url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('new', 'triaged', 'fixed', 'closed') DEFAULT 'new',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
