CREATE TABLE item_type_new (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  kind TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'event', 'record')),
  default_minutes INTEGER,
  checklist TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
INSERT INTO item_type_new SELECT id, project_id, name, icon, kind, default_minutes, checklist, position
  FROM item_type;
DROP TABLE item_type;
ALTER TABLE item_type_new RENAME TO item_type;
CREATE INDEX item_type_project ON item_type(project_id);

ALTER TABLE task ADD COLUMN phase_id INTEGER REFERENCES item_status(id) ON DELETE SET NULL;
CREATE INDEX task_phase ON task(phase_id);

CREATE TABLE record_phase (
  task_id INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  status_id INTEGER NOT NULL REFERENCES item_status(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (task_id, status_id)
);
