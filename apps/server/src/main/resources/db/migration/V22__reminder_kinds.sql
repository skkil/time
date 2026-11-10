ALTER TABLE push_device ADD COLUMN kinds TEXT NOT NULL DEFAULT 'task,block,event';

CREATE TABLE reminder_sent (
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  sent_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE INDEX reminder_sent_at ON reminder_sent (sent_at);
