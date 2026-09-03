ALTER TABLE project ADD COLUMN view TEXT NOT NULL DEFAULT 'list' CHECK (view IN ('list', 'board'));
ALTER TABLE project ADD COLUMN external_id TEXT;

CREATE TABLE section (
  id INTEGER PRIMARY KEY,
  project_id INTEGER REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  collapsed INTEGER NOT NULL DEFAULT 0,
  external_id TEXT
);

CREATE TABLE label (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  color TEXT NOT NULL DEFAULT 'graphite',
  external_id TEXT
);

CREATE TABLE task_label (
  task_id INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES label(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

ALTER TABLE task ADD COLUMN section_id INTEGER REFERENCES section(id) ON DELETE CASCADE;
ALTER TABLE task ADD COLUMN parent_id INTEGER REFERENCES task(id) ON DELETE CASCADE;
ALTER TABLE task ADD COLUMN priority INTEGER NOT NULL DEFAULT 4 CHECK (priority BETWEEN 1 AND 4);
ALTER TABLE task ADD COLUMN due_time INTEGER CHECK (due_time BETWEEN 0 AND 1439);
ALTER TABLE task ADD COLUMN deadline TEXT;
ALTER TABLE task ADD COLUMN recurrence TEXT;
ALTER TABLE task ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE task ADD COLUMN external_id TEXT;

UPDATE task SET position = id;

CREATE UNIQUE INDEX project_external ON project(external_id);
CREATE UNIQUE INDEX section_external ON section(external_id);
CREATE UNIQUE INDEX label_external ON label(external_id);
CREATE UNIQUE INDEX task_external ON task(external_id);
CREATE INDEX section_project ON section(project_id);
CREATE INDEX task_section ON task(section_id);
CREATE INDEX task_parent ON task(parent_id);
CREATE INDEX task_label_label ON task_label(label_id);
