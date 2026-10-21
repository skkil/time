CREATE TABLE quarter (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  start_date TEXT NOT NULL UNIQUE
);

CREATE TABLE priority (
  id INTEGER PRIMARY KEY,
  quarter_id INTEGER NOT NULL REFERENCES quarter(id) ON DELETE CASCADE,
  title TEXT NOT NULL
);

CREATE TABLE week (
  start_date TEXT PRIMARY KEY,
  improvement TEXT NOT NULL DEFAULT '',
  worked TEXT NOT NULL DEFAULT '',
  fell_short TEXT NOT NULL DEFAULT '',
  change TEXT NOT NULL DEFAULT ''
);

CREATE TABLE outcome (
  id INTEGER PRIMARY KEY,
  week_start TEXT NOT NULL REFERENCES week(start_date) ON DELETE CASCADE,
  priority_id INTEGER REFERENCES priority(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'achieved', 'dropped'))
);

CREATE TABLE project (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE focus (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project(id),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  offline INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX focus_started_at ON focus(started_at);
CREATE UNIQUE INDEX focus_single_active ON focus((ended_at IS NULL)) WHERE ended_at IS NULL;

CREATE TABLE day (
  date TEXT PRIMARY KEY,
  felt INTEGER CHECK (felt BETWEEN 1 AND 5),
  reflection TEXT NOT NULL DEFAULT '',
  plan_morning TEXT NOT NULL DEFAULT '',
  plan_afternoon TEXT NOT NULL DEFAULT '',
  plan_evening TEXT NOT NULL DEFAULT '',
  closed_at INTEGER
);

CREATE TABLE habit (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE habit_log (
  habit_id INTEGER NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  done INTEGER NOT NULL,
  PRIMARY KEY (habit_id, date)
);
