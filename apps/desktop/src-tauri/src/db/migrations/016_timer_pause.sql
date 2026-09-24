ALTER TABLE running_timer ADD COLUMN paused_at INTEGER;
ALTER TABLE running_timer ADD COLUMN banked_seconds INTEGER NOT NULL DEFAULT 0;
