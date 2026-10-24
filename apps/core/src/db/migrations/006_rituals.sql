DROP INDEX task_label_label;
DROP TABLE task_label;
DROP INDEX label_external;
DROP TABLE label;

ALTER TABLE task ADD COLUMN rollover_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE task ADD COLUMN someday INTEGER NOT NULL DEFAULT 0;
ALTER TABLE task ADD COLUMN next_step TEXT NOT NULL DEFAULT '';
ALTER TABLE task ADD COLUMN must_on TEXT;
CREATE INDEX task_must_on ON task(must_on);

ALTER TABLE project ADD COLUMN kind TEXT NOT NULL DEFAULT 'area' CHECK (kind IN ('project', 'area'));
ALTER TABLE project ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'paused', 'done', 'dropped'));
ALTER TABLE project ADD COLUMN outcome TEXT NOT NULL DEFAULT '';
ALTER TABLE project ADD COLUMN weekly_minutes INTEGER CHECK (weekly_minutes > 0);
ALTER TABLE project ADD COLUMN target_date TEXT;
ALTER TABLE project ADD COLUMN kill_criteria TEXT NOT NULL DEFAULT '';
ALTER TABLE project ADD COLUMN review_every_weeks INTEGER NOT NULL DEFAULT 4
  CHECK (review_every_weeks IN (1, 2, 4));
ALTER TABLE project ADD COLUMN last_reviewed_at INTEGER;
ALTER TABLE project ADD COLUMN in_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE habit ADD COLUMN skip_days INTEGER NOT NULL DEFAULT 1 CHECK (skip_days BETWEEN 0 AND 2);
ALTER TABLE habit ADD COLUMN anchor TEXT NOT NULL DEFAULT '';

CREATE TABLE setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE ritual (
  kind TEXT PRIMARY KEY CHECK (kind IN ('morning', 'evening', 'wind_down', 'session', 'weekly')),
  enabled INTEGER NOT NULL,
  trigger TEXT NOT NULL
    CHECK (trigger IN ('first_open', 'at_time', 'end_of_day', 'after_timer_stop', 'manual')),
  at_minute INTEGER NOT NULL DEFAULT 0 CHECK (at_minute BETWEEN 0 AND 1439),
  weekdays INTEGER NOT NULL DEFAULT 127 CHECK (weekdays BETWEEN 1 AND 127),
  min_minutes INTEGER NOT NULL DEFAULT 20,
  steps TEXT NOT NULL
);

INSERT INTO ritual (kind, enabled, trigger, at_minute, weekdays, steps) VALUES
  ('morning', 0, 'first_open', 0, 127, 'feel,leftovers,pick_musts,timeblock'),
  ('evening', 0, 'end_of_day', 1050, 127, 'what_moved,leftovers,pick_musts,timeblock,one_line_note'),
  ('wind_down', 0, 'at_time', 1335, 127, 'brain_dump,habit_check,device_away'),
  ('session', 1, 'after_timer_stop', 0, 127, 'did_it_move,next_step_note,breathing_pause'),
  ('weekly', 1, 'first_open', 0, 1, 'weekly_review');

CREATE TABLE ritual_run (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL REFERENCES ritual(kind) ON DELETE CASCADE,
  date TEXT NOT NULL,
  task_id INTEGER REFERENCES task(id) ON DELETE SET NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  skipped INTEGER NOT NULL DEFAULT 0,
  step INTEGER NOT NULL DEFAULT 0,
  snoozed_until INTEGER
);
CREATE INDEX ritual_run_kind_date ON ritual_run(kind, date);
