CREATE TABLE realtime_ticket (
  ticket TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
CREATE INDEX realtime_ticket_expiry ON realtime_ticket(expires_at);

CREATE TABLE user_preference (
  user_id BIGINT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  "values" JSONB NOT NULL DEFAULT '{}',
  updated_at BIGINT NOT NULL
);
