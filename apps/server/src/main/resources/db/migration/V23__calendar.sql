-- Google Calendar, read by the server and synced to devices. An account's tokens stay on the server, encrypted;
-- its calendars and their events sync through store, with ids from natural keys so a re-import lands on the same rows.
-- Devices only toggle a calendar's visibility and never write events.
CREATE TABLE calendar_account (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT,
  refresh_token_enc TEXT NOT NULL,
  access_token_enc TEXT,
  expires_at BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reauth')),
  failures INT NOT NULL DEFAULT 0,
  next_sync_at BIGINT NOT NULL DEFAULT 0,
  synced_at BIGINT,
  created_at BIGINT NOT NULL,
  UNIQUE (user_id, provider, subject)
);

CREATE INDEX calendar_account_due ON calendar_account (next_sync_at) WHERE status = 'active';

CREATE TABLE calendar_connect (
  state TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  verifier TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE TABLE calendar_source (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES calendar_account(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  position INT NOT NULL DEFAULT 0,
  sync_token TEXT,
  full_synced_at BIGINT,
  UNIQUE (account_id, external_id)
);

CREATE INDEX calendar_source_user ON calendar_source (user_id);

CREATE TABLE calendar_event (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES calendar_source(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at BIGINT NOT NULL,
  end_at BIGINT NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  location TEXT,
  link TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  updated_at BIGINT NOT NULL,
  UNIQUE (source_id, external_id)
);

CREATE INDEX calendar_event_window ON calendar_event (user_id, start_at);

SELECT store_register('calendar_source', 'id', ARRAY['user_id', 'sync_token', 'full_synced_at']);
SELECT store_register('calendar_event', 'id', ARRAY['user_id']);
