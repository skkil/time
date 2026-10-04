CREATE TABLE push_device (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('expo', 'web')),
  token TEXT NOT NULL,
  p256dh TEXT,
  auth TEXT,
  label TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  last_seen_at BIGINT NOT NULL,
  UNIQUE (kind, token)
);
CREATE INDEX push_device_user ON push_device(user_id);
