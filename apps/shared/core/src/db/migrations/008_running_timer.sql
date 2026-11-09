CREATE TABLE running_timer (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  description TEXT NOT NULL DEFAULT '',
  project_id INTEGER REFERENCES project(id) ON DELETE SET NULL,
  task_id INTEGER REFERENCES task(id) ON DELETE SET NULL,
  started_at INTEGER NOT NULL
);
