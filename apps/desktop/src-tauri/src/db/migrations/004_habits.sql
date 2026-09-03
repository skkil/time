ALTER TABLE habit ADD COLUMN kind TEXT NOT NULL DEFAULT 'build' CHECK (kind IN ('build', 'quit', 'limit'));
ALTER TABLE habit ADD COLUMN goal REAL NOT NULL DEFAULT 1 CHECK (goal >= 0);
ALTER TABLE habit ADD COLUMN unit TEXT NOT NULL DEFAULT 'times' CHECK (unit IN ('times', 'minutes'));
ALTER TABLE habit ADD COLUMN days INTEGER NOT NULL DEFAULT 127 CHECK (days BETWEEN 1 AND 127);
ALTER TABLE habit ADD COLUMN time_of_day TEXT NOT NULL DEFAULT 'anytime'
  CHECK (time_of_day IN ('anytime', 'morning', 'afternoon', 'evening'));
ALTER TABLE habit ADD COLUMN area TEXT NOT NULL DEFAULT '';
ALTER TABLE habit ADD COLUMN start_date TEXT;
ALTER TABLE habit ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE habit ADD COLUMN track_source TEXT CHECK (track_source IN ('website', 'app', 'project'));
ALTER TABLE habit ADD COLUMN track_patterns TEXT NOT NULL DEFAULT '';
ALTER TABLE habit ADD COLUMN track_project_id INTEGER REFERENCES project(id) ON DELETE SET NULL;

UPDATE habit SET
  position = id,
  start_date = COALESCE(
    (SELECT MIN(date) FROM habit_log WHERE habit_log.habit_id = habit.id),
    date('now', 'localtime')
  );

CREATE TABLE habit_log_next (
  habit_id INTEGER NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT CHECK (status IN ('done', 'failed', 'skipped')),
  value REAL NOT NULL DEFAULT 0 CHECK (value >= 0),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  PRIMARY KEY (habit_id, date)
);

INSERT INTO habit_log_next (habit_id, date, status, value)
SELECT habit_id, date, CASE done WHEN 1 THEN 'done' ELSE 'failed' END, done FROM habit_log;

DROP TABLE habit_log;
ALTER TABLE habit_log_next RENAME TO habit_log;
CREATE INDEX habit_log_date ON habit_log(date);
