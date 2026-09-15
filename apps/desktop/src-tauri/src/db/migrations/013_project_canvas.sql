CREATE TABLE project_canvas (
  project_id INTEGER PRIMARY KEY REFERENCES project(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
