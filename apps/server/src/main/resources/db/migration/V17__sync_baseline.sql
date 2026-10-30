-- An account whose store log holds every synced row it owns. BaselineJob logs each older account's rows once with
-- store_capture_existing (rows from before V13 or rewritten under store.bypass, as V15 did) and records the version
-- that holds them; accounts created from here on are logged from their first row, so they start with a NULL version.
CREATE TABLE sync_baseline (
  user_id BIGINT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  version BIGINT,
  done_at BIGINT NOT NULL
);
