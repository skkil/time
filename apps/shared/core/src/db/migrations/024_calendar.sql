CREATE TABLE calendar_source (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE calendar_event (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES calendar_source(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  link TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  updated_at INTEGER NOT NULL
);

CREATE INDEX calendar_event_start ON calendar_event(start_at);
CREATE INDEX calendar_event_source ON calendar_event(source_id);
