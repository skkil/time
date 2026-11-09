CREATE TABLE item_type (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  kind TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'event')),
  default_minutes INTEGER,
  checklist TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX item_type_project ON item_type(project_id);

CREATE TABLE item_status (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('backlog', 'todo', 'active', 'done', 'dropped')),
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX item_status_project ON item_status(project_id);

CREATE TABLE milestone (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX milestone_project ON milestone(project_id);

CREATE TABLE saved_view (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout TEXT NOT NULL CHECK (layout IN ('list', 'board', 'calendar', 'table')),
  group_by TEXT NOT NULL DEFAULT 'section'
    CHECK (group_by IN ('section', 'type', 'status', 'milestone', 'date', 'none')),
  filter TEXT NOT NULL DEFAULT '{}',
  sort TEXT NOT NULL DEFAULT 'manual',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX saved_view_project ON saved_view(project_id);

ALTER TABLE project ADD COLUMN preset TEXT NOT NULL DEFAULT 'simple';
ALTER TABLE project ADD COLUMN milestone_label TEXT NOT NULL DEFAULT '';

ALTER TABLE task ADD COLUMN type_id INTEGER REFERENCES item_type(id) ON DELETE SET NULL;
ALTER TABLE task ADD COLUMN status_id INTEGER REFERENCES item_status(id) ON DELETE SET NULL;
ALTER TABLE task ADD COLUMN milestone_id INTEGER REFERENCES milestone(id) ON DELETE SET NULL;
ALTER TABLE task ADD COLUMN location TEXT NOT NULL DEFAULT '';
ALTER TABLE task ADD COLUMN counts_as_time INTEGER NOT NULL DEFAULT 0;
ALTER TABLE task ADD COLUMN status_changed_at INTEGER;
CREATE INDEX task_type ON task(type_id);
CREATE INDEX task_status ON task(status_id);
