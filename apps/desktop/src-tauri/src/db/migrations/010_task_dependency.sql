CREATE TABLE task_dependency (
  task_id INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  blocked_by_id INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, blocked_by_id),
  CHECK (task_id != blocked_by_id)
);

CREATE INDEX task_dependency_blocked_by ON task_dependency(blocked_by_id);
