CREATE TABLE project_next (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'graphite',
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

INSERT INTO project_next (id, name, position, archived)
SELECT id, name, id, archived FROM project;

CREATE TABLE task (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  project_id INTEGER REFERENCES project(id) ON DELETE CASCADE,
  due_date TEXT,
  estimate_minutes INTEGER CHECK (estimate_minutes > 0),
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE time_block (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  CHECK (end_at > start_at)
);

CREATE TABLE time_entry (
  id INTEGER PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  project_id INTEGER REFERENCES project(id) ON DELETE SET NULL,
  task_id INTEGER REFERENCES task(id) ON DELETE SET NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  CHECK (ended_at >= started_at)
);

INSERT INTO time_entry (description, project_id, started_at, ended_at)
SELECT note, project_id, started_at, COALESCE(ended_at, started_at) FROM focus;

DROP TABLE focus;
DROP TABLE project;
ALTER TABLE project_next RENAME TO project;

ALTER TABLE day DROP COLUMN plan_morning;
ALTER TABLE day DROP COLUMN plan_afternoon;
ALTER TABLE day DROP COLUMN plan_evening;

CREATE INDEX project_parent ON project(parent_id);
CREATE INDEX task_project ON task(project_id);
CREATE INDEX task_due_date ON task(due_date);
CREATE INDEX time_block_start ON time_block(start_at);
CREATE INDEX time_block_task ON time_block(task_id);
CREATE INDEX time_entry_started ON time_entry(started_at);
CREATE INDEX time_entry_task ON time_entry(task_id);
