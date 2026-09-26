CREATE TABLE app_user (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT,
  name TEXT NOT NULL DEFAULT '',
  time_zone TEXT NOT NULL DEFAULT 'UTC',
  created_at BIGINT NOT NULL
);

CREATE TABLE user_identity (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (issuer, subject)
);
CREATE INDEX user_identity_user ON user_identity(user_id);

CREATE TABLE setting (
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE project_group (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX project_group_name ON project_group(user_id, lower(name));

CREATE TABLE project (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'graphite',
  position BIGINT NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  view TEXT NOT NULL DEFAULT 'list',
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'done', 'dropped')),
  outcome TEXT NOT NULL DEFAULT '',
  weekly_minutes INTEGER CHECK (weekly_minutes > 0),
  target_date DATE,
  kill_criteria TEXT NOT NULL DEFAULT '',
  review_every_weeks INTEGER NOT NULL DEFAULT 4 CHECK (review_every_weeks IN (1, 2, 4)),
  last_reviewed_at BIGINT,
  in_order BOOLEAN NOT NULL DEFAULT FALSE,
  preset TEXT NOT NULL DEFAULT 'simple',
  milestone_label TEXT NOT NULL DEFAULT '',
  group_id BIGINT REFERENCES project_group(id) ON DELETE SET NULL
);
CREATE INDEX project_user ON project(user_id);
CREATE INDEX project_parent ON project(parent_id);
CREATE UNIQUE INDEX project_external ON project(user_id, external_id);

CREATE TABLE project_canvas (
  project_id BIGINT PRIMARY KEY REFERENCES project(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL
);

CREATE TABLE section (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  project_id BIGINT REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position BIGINT NOT NULL DEFAULT 0,
  collapsed BOOLEAN NOT NULL DEFAULT FALSE,
  external_id TEXT
);
CREATE INDEX section_user ON section(user_id);
CREATE INDEX section_project ON section(project_id);
CREATE UNIQUE INDEX section_external ON section(user_id, external_id);

CREATE TABLE item_type (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  kind TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'event', 'record')),
  default_minutes INTEGER,
  checklist TEXT NOT NULL DEFAULT '',
  position BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX item_type_user ON item_type(user_id);
CREATE INDEX item_type_project ON item_type(project_id);

CREATE TABLE item_status (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('backlog', 'todo', 'active', 'done', 'dropped')),
  position BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX item_status_user ON item_status(user_id);
CREATE INDEX item_status_project ON item_status(project_id);

CREATE TABLE milestone (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE,
  position BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX milestone_user ON milestone(user_id);
CREATE INDEX milestone_project ON milestone(project_id);

CREATE TABLE saved_view (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout TEXT NOT NULL CHECK (layout IN ('list', 'board', 'calendar', 'table')),
  group_by TEXT NOT NULL DEFAULT 'section'
    CHECK (group_by IN ('section', 'type', 'status', 'milestone', 'date', 'none')),
  filter TEXT NOT NULL DEFAULT '{}',
  sort TEXT NOT NULL DEFAULT 'manual',
  position BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX saved_view_user ON saved_view(user_id);
CREATE INDEX saved_view_project ON saved_view(project_id);

CREATE TABLE quarter (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  UNIQUE (user_id, start_date)
);

CREATE TABLE priority (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  quarter_id BIGINT NOT NULL REFERENCES quarter(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX priority_quarter ON priority(quarter_id);

CREATE TABLE week (
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  worked TEXT NOT NULL DEFAULT '',
  fell_short TEXT NOT NULL DEFAULT '',
  change TEXT NOT NULL DEFAULT '',
  felt INTEGER CHECK (felt BETWEEN 1 AND 5),
  step INTEGER NOT NULL DEFAULT 0,
  reviewed_at BIGINT,
  PRIMARY KEY (user_id, start_date)
);

CREATE TABLE outcome (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  week_start DATE NOT NULL,
  priority_id BIGINT REFERENCES priority(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'achieved', 'carried', 'dropped')),
  carried_from BIGINT REFERENCES outcome(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id, week_start) REFERENCES week(user_id, start_date) ON DELETE CASCADE
);
CREATE INDEX outcome_week ON outcome(user_id, week_start);

CREATE TABLE day (
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  felt INTEGER CHECK (felt BETWEEN 1 AND 5),
  reflection TEXT NOT NULL DEFAULT '',
  closed_at BIGINT,
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE task (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  project_id BIGINT REFERENCES project(id) ON DELETE CASCADE,
  due_date DATE,
  estimate_minutes INTEGER CHECK (estimate_minutes > 0),
  completed_at BIGINT,
  created_at BIGINT NOT NULL,
  section_id BIGINT REFERENCES section(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES task(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 4 CHECK (priority BETWEEN 1 AND 4),
  due_time INTEGER CHECK (due_time BETWEEN 0 AND 1439),
  deadline DATE,
  recurrence TEXT,
  position BIGINT NOT NULL DEFAULT 0,
  external_id TEXT,
  outcome_id BIGINT REFERENCES outcome(id) ON DELETE SET NULL,
  rollover_count INTEGER NOT NULL DEFAULT 0,
  someday BOOLEAN NOT NULL DEFAULT FALSE,
  next_step TEXT NOT NULL DEFAULT '',
  must_on DATE,
  type_id BIGINT REFERENCES item_type(id) ON DELETE SET NULL,
  status_id BIGINT REFERENCES item_status(id) ON DELETE SET NULL,
  milestone_id BIGINT REFERENCES milestone(id) ON DELETE SET NULL,
  location TEXT NOT NULL DEFAULT '',
  counts_as_time BOOLEAN NOT NULL DEFAULT FALSE,
  status_changed_at BIGINT,
  phase_id BIGINT REFERENCES item_status(id) ON DELETE SET NULL,
  reminded_for TEXT
);
CREATE INDEX task_user ON task(user_id);
CREATE INDEX task_project ON task(project_id);
CREATE INDEX task_due_date ON task(user_id, due_date);
CREATE INDEX task_section ON task(section_id);
CREATE INDEX task_parent ON task(parent_id);
CREATE INDEX task_outcome ON task(outcome_id);
CREATE INDEX task_must_on ON task(user_id, must_on);
CREATE INDEX task_type ON task(type_id);
CREATE INDEX task_status ON task(status_id);
CREATE INDEX task_phase ON task(phase_id);
CREATE UNIQUE INDEX task_external ON task(user_id, external_id);

CREATE TABLE task_dependency (
  task_id BIGINT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  blocked_by_id BIGINT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, blocked_by_id),
  CHECK (task_id <> blocked_by_id)
);
CREATE INDEX task_dependency_blocked_by ON task_dependency(blocked_by_id);

CREATE TABLE record_phase (
  task_id BIGINT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  status_id BIGINT NOT NULL REFERENCES item_status(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (task_id, status_id)
);

CREATE TABLE time_block (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  task_id BIGINT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  start_at BIGINT NOT NULL,
  end_at BIGINT NOT NULL,
  CHECK (end_at > start_at)
);
CREATE INDEX time_block_start ON time_block(user_id, start_at);
CREATE INDEX time_block_task ON time_block(task_id);

CREATE TABLE time_entry (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  project_id BIGINT REFERENCES project(id) ON DELETE SET NULL,
  task_id BIGINT REFERENCES task(id) ON DELETE SET NULL,
  started_at BIGINT NOT NULL,
  ended_at BIGINT NOT NULL,
  CHECK (ended_at >= started_at)
);
CREATE INDEX time_entry_started ON time_entry(user_id, started_at);
CREATE INDEX time_entry_task ON time_entry(task_id);
CREATE INDEX time_entry_project ON time_entry(project_id);

CREATE TABLE running_timer (
  user_id BIGINT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  project_id BIGINT REFERENCES project(id) ON DELETE SET NULL,
  task_id BIGINT REFERENCES task(id) ON DELETE SET NULL,
  started_at BIGINT NOT NULL,
  paused_at BIGINT,
  banked_seconds BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE habit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  kind TEXT NOT NULL DEFAULT 'build' CHECK (kind IN ('build', 'quit', 'limit')),
  goal DOUBLE PRECISION NOT NULL DEFAULT 1 CHECK (goal >= 0),
  unit TEXT NOT NULL DEFAULT 'times' CHECK (unit IN ('times', 'minutes')),
  days INTEGER NOT NULL DEFAULT 127 CHECK (days BETWEEN 1 AND 127),
  time_of_day TEXT NOT NULL DEFAULT 'anytime'
    CHECK (time_of_day IN ('anytime', 'morning', 'afternoon', 'evening')),
  area TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  position BIGINT NOT NULL DEFAULT 0,
  track_source TEXT CHECK (track_source IN ('website', 'app', 'project')),
  track_patterns TEXT NOT NULL DEFAULT '',
  track_project_id BIGINT REFERENCES project(id) ON DELETE SET NULL,
  skip_days INTEGER NOT NULL DEFAULT 1 CHECK (skip_days BETWEEN 0 AND 2),
  anchor TEXT NOT NULL DEFAULT ''
);
CREATE INDEX habit_user ON habit(user_id);

CREATE TABLE habit_log (
  habit_id BIGINT NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('done', 'failed', 'skipped')),
  value DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (value >= 0),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  PRIMARY KEY (habit_id, date)
);
CREATE INDEX habit_log_date ON habit_log(date);

CREATE TABLE ritual (
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('morning', 'evening', 'wind_down', 'session', 'weekly')),
  enabled BOOLEAN NOT NULL,
  trigger TEXT NOT NULL
    CHECK (trigger IN ('first_open', 'at_time', 'end_of_day', 'after_timer_stop', 'manual')),
  at_minute INTEGER NOT NULL DEFAULT 0 CHECK (at_minute BETWEEN 0 AND 1439),
  weekdays INTEGER NOT NULL DEFAULT 127 CHECK (weekdays BETWEEN 1 AND 127),
  min_minutes INTEGER NOT NULL DEFAULT 20,
  steps TEXT NOT NULL,
  PRIMARY KEY (user_id, kind)
);

CREATE TABLE ritual_run (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  kind TEXT NOT NULL,
  date DATE NOT NULL,
  task_id BIGINT REFERENCES task(id) ON DELETE SET NULL,
  started_at BIGINT NOT NULL,
  finished_at BIGINT,
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  step INTEGER NOT NULL DEFAULT 0,
  snoozed_until BIGINT,
  FOREIGN KEY (user_id, kind) REFERENCES ritual(user_id, kind) ON DELETE CASCADE
);
CREATE INDEX ritual_run_kind_date ON ritual_run(user_id, kind, date);

CREATE TABLE undo_snapshot (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX undo_snapshot_user ON undo_snapshot(user_id, created_at);
