-- Runs after the caller fills temp.id_map (tbl, old, new) with one UUIDv7 per
-- existing row, in id order. Every table keeps its columns, constraints and
-- indexes; integer ids and the columns pointing at them become TEXT.

CREATE TABLE project_group_new (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  position INTEGER NOT NULL DEFAULT 0
);
INSERT INTO project_group_new (id, name, position)
SELECT m.new, g.name, g.position
  FROM project_group g JOIN id_map m ON m.tbl = 'project_group' AND m.old = g.id;

CREATE TABLE project_new (
  id TEXT PRIMARY KEY NOT NULL,
  parent_id TEXT REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'graphite',
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  view TEXT NOT NULL DEFAULT 'list' CHECK (view IN ('list', 'board')),
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'done', 'dropped')),
  outcome TEXT NOT NULL DEFAULT '',
  weekly_minutes INTEGER CHECK (weekly_minutes > 0),
  target_date TEXT,
  kill_criteria TEXT NOT NULL DEFAULT '',
  review_every_weeks INTEGER NOT NULL DEFAULT 4 CHECK (review_every_weeks IN (1, 2, 4)),
  last_reviewed_at INTEGER,
  in_order INTEGER NOT NULL DEFAULT 0,
  preset TEXT NOT NULL DEFAULT 'simple',
  milestone_label TEXT NOT NULL DEFAULT '',
  group_id TEXT REFERENCES project_group(id) ON DELETE SET NULL
);
INSERT INTO project_new
SELECT m.new,
       (SELECT new FROM id_map WHERE tbl = 'project' AND old = p.parent_id),
       p.name, p.color, p.position, p.archived, p.view, p.external_id, p.status, p.outcome,
       p.weekly_minutes, p.target_date, p.kill_criteria, p.review_every_weeks,
       p.last_reviewed_at, p.in_order, p.preset, p.milestone_label,
       (SELECT new FROM id_map WHERE tbl = 'project_group' AND old = p.group_id)
  FROM project p JOIN id_map m ON m.tbl = 'project' AND m.old = p.id;

CREATE TABLE section_new (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  collapsed INTEGER NOT NULL DEFAULT 0,
  external_id TEXT
);
INSERT INTO section_new
SELECT m.new,
       (SELECT new FROM id_map WHERE tbl = 'project' AND old = s.project_id),
       s.name, s.position, s.collapsed, s.external_id
  FROM section s JOIN id_map m ON m.tbl = 'section' AND m.old = s.id;

CREATE TABLE quarter_new (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  start_date TEXT NOT NULL UNIQUE
);
INSERT INTO quarter_new
SELECT m.new, q.label, q.start_date
  FROM quarter q JOIN id_map m ON m.tbl = 'quarter' AND m.old = q.id;

CREATE TABLE priority_new (
  id TEXT PRIMARY KEY NOT NULL,
  quarter_id TEXT NOT NULL REFERENCES quarter(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
INSERT INTO priority_new
SELECT m.new, q.new, p.title, p.note
  FROM priority p
  JOIN id_map m ON m.tbl = 'priority' AND m.old = p.id
  JOIN id_map q ON q.tbl = 'quarter' AND q.old = p.quarter_id;

CREATE TABLE outcome_new (
  id TEXT PRIMARY KEY NOT NULL,
  week_start TEXT NOT NULL REFERENCES week(start_date) ON DELETE CASCADE,
  priority_id TEXT REFERENCES priority(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'achieved', 'carried', 'dropped')),
  carried_from TEXT REFERENCES outcome(id) ON DELETE SET NULL
);
INSERT INTO outcome_new
SELECT m.new, o.week_start,
       (SELECT new FROM id_map WHERE tbl = 'priority' AND old = o.priority_id),
       o.title, o.status,
       (SELECT new FROM id_map WHERE tbl = 'outcome' AND old = o.carried_from)
  FROM outcome o JOIN id_map m ON m.tbl = 'outcome' AND m.old = o.id;

CREATE TABLE item_type_new (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  kind TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'event', 'record')),
  default_minutes INTEGER,
  checklist TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
INSERT INTO item_type_new
SELECT m.new, p.new, t.name, t.icon, t.kind, t.default_minutes, t.checklist, t.position
  FROM item_type t
  JOIN id_map m ON m.tbl = 'item_type' AND m.old = t.id
  JOIN id_map p ON p.tbl = 'project' AND p.old = t.project_id;

CREATE TABLE item_status_new (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('backlog', 'todo', 'active', 'done', 'dropped')),
  position INTEGER NOT NULL DEFAULT 0
);
INSERT INTO item_status_new
SELECT m.new, p.new, s.name, s.category, s.position
  FROM item_status s
  JOIN id_map m ON m.tbl = 'item_status' AND m.old = s.id
  JOIN id_map p ON p.tbl = 'project' AND p.old = s.project_id;

CREATE TABLE milestone_new (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
INSERT INTO milestone_new
SELECT m.new, p.new, s.name, s.date, s.position
  FROM milestone s
  JOIN id_map m ON m.tbl = 'milestone' AND m.old = s.id
  JOIN id_map p ON p.tbl = 'project' AND p.old = s.project_id;

CREATE TABLE saved_view_new (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout TEXT NOT NULL CHECK (layout IN ('list', 'board', 'calendar', 'table')),
  group_by TEXT NOT NULL DEFAULT 'section'
    CHECK (group_by IN ('section', 'type', 'status', 'milestone', 'date', 'none')),
  filter TEXT NOT NULL DEFAULT '{}',
  sort TEXT NOT NULL DEFAULT 'manual',
  position INTEGER NOT NULL DEFAULT 0
);
INSERT INTO saved_view_new
SELECT m.new, p.new, v.name, v.layout, v.group_by, v.filter, v.sort, v.position
  FROM saved_view v
  JOIN id_map m ON m.tbl = 'saved_view' AND m.old = v.id
  JOIN id_map p ON p.tbl = 'project' AND p.old = v.project_id;

CREATE TABLE task_new (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  project_id TEXT REFERENCES project(id) ON DELETE CASCADE,
  due_date TEXT,
  estimate_minutes INTEGER CHECK (estimate_minutes > 0),
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  section_id TEXT REFERENCES section(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES task(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 4 CHECK (priority BETWEEN 1 AND 4),
  due_time INTEGER CHECK (due_time BETWEEN 0 AND 1439),
  deadline TEXT,
  recurrence TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  external_id TEXT,
  outcome_id TEXT REFERENCES outcome(id) ON DELETE SET NULL,
  rollover_count INTEGER NOT NULL DEFAULT 0,
  someday INTEGER NOT NULL DEFAULT 0,
  next_step TEXT NOT NULL DEFAULT '',
  must_on TEXT,
  type_id TEXT REFERENCES item_type(id) ON DELETE SET NULL,
  status_id TEXT REFERENCES item_status(id) ON DELETE SET NULL,
  milestone_id TEXT REFERENCES milestone(id) ON DELETE SET NULL,
  location TEXT NOT NULL DEFAULT '',
  counts_as_time INTEGER NOT NULL DEFAULT 0,
  status_changed_at INTEGER,
  phase_id TEXT REFERENCES item_status(id) ON DELETE SET NULL,
  reminded_for TEXT
);
INSERT INTO task_new
SELECT m.new, t.title, t.notes,
       (SELECT new FROM id_map WHERE tbl = 'project' AND old = t.project_id),
       t.due_date, t.estimate_minutes, t.completed_at, t.created_at,
       (SELECT new FROM id_map WHERE tbl = 'section' AND old = t.section_id),
       (SELECT new FROM id_map WHERE tbl = 'task' AND old = t.parent_id),
       t.priority, t.due_time, t.deadline, t.recurrence, t.position, t.external_id,
       (SELECT new FROM id_map WHERE tbl = 'outcome' AND old = t.outcome_id),
       t.rollover_count, t.someday, t.next_step, t.must_on,
       (SELECT new FROM id_map WHERE tbl = 'item_type' AND old = t.type_id),
       (SELECT new FROM id_map WHERE tbl = 'item_status' AND old = t.status_id),
       (SELECT new FROM id_map WHERE tbl = 'milestone' AND old = t.milestone_id),
       t.location, t.counts_as_time, t.status_changed_at,
       (SELECT new FROM id_map WHERE tbl = 'item_status' AND old = t.phase_id),
       t.reminded_for
  FROM task t JOIN id_map m ON m.tbl = 'task' AND m.old = t.id;

CREATE TABLE time_block_new (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  CHECK (end_at > start_at)
);
INSERT INTO time_block_new
SELECT m.new, t.new, b.start_at, b.end_at
  FROM time_block b
  JOIN id_map m ON m.tbl = 'time_block' AND m.old = b.id
  JOIN id_map t ON t.tbl = 'task' AND t.old = b.task_id;

CREATE TABLE time_entry_new (
  id TEXT PRIMARY KEY NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  project_id TEXT REFERENCES project(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES task(id) ON DELETE SET NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  CHECK (ended_at >= started_at)
);
INSERT INTO time_entry_new
SELECT m.new, e.description,
       (SELECT new FROM id_map WHERE tbl = 'project' AND old = e.project_id),
       (SELECT new FROM id_map WHERE tbl = 'task' AND old = e.task_id),
       e.started_at, e.ended_at
  FROM time_entry e JOIN id_map m ON m.tbl = 'time_entry' AND m.old = e.id;

CREATE TABLE habit_new (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'build' CHECK (kind IN ('build', 'quit', 'limit')),
  goal REAL NOT NULL DEFAULT 1 CHECK (goal >= 0),
  unit TEXT NOT NULL DEFAULT 'times' CHECK (unit IN ('times', 'minutes')),
  days INTEGER NOT NULL DEFAULT 127 CHECK (days BETWEEN 1 AND 127),
  time_of_day TEXT NOT NULL DEFAULT 'anytime'
    CHECK (time_of_day IN ('anytime', 'morning', 'afternoon', 'evening')),
  area TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  track_source TEXT CHECK (track_source IN ('website', 'app', 'project')),
  track_patterns TEXT NOT NULL DEFAULT '',
  track_project_id TEXT REFERENCES project(id) ON DELETE SET NULL,
  skip_days INTEGER NOT NULL DEFAULT 1 CHECK (skip_days BETWEEN 0 AND 2),
  anchor TEXT NOT NULL DEFAULT ''
);
INSERT INTO habit_new
SELECT m.new, h.name, h.archived, h.kind, h.goal, h.unit, h.days, h.time_of_day, h.area,
       h.start_date, h.position, h.track_source, h.track_patterns,
       (SELECT new FROM id_map WHERE tbl = 'project' AND old = h.track_project_id),
       h.skip_days, h.anchor
  FROM habit h JOIN id_map m ON m.tbl = 'habit' AND m.old = h.id;

CREATE TABLE habit_log_new (
  habit_id TEXT NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT CHECK (status IN ('done', 'failed', 'skipped')),
  value REAL NOT NULL DEFAULT 0 CHECK (value >= 0),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  PRIMARY KEY (habit_id, date)
);
INSERT INTO habit_log_new
SELECT h.new, l.date, l.status, l.value, l.source
  FROM habit_log l JOIN id_map h ON h.tbl = 'habit' AND h.old = l.habit_id;

CREATE TABLE ritual_run_new (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL REFERENCES ritual(kind) ON DELETE CASCADE,
  date TEXT NOT NULL,
  task_id TEXT REFERENCES task(id) ON DELETE SET NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  skipped INTEGER NOT NULL DEFAULT 0,
  step INTEGER NOT NULL DEFAULT 0,
  snoozed_until INTEGER
);
INSERT INTO ritual_run_new
SELECT m.new, r.kind, r.date,
       (SELECT new FROM id_map WHERE tbl = 'task' AND old = r.task_id),
       r.started_at, r.finished_at, r.skipped, r.step, r.snoozed_until
  FROM ritual_run r JOIN id_map m ON m.tbl = 'ritual_run' AND m.old = r.id;

CREATE TABLE running_timer_new (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  description TEXT NOT NULL DEFAULT '',
  project_id TEXT REFERENCES project(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES task(id) ON DELETE SET NULL,
  started_at INTEGER NOT NULL,
  paused_at INTEGER,
  banked_seconds INTEGER NOT NULL DEFAULT 0
);
INSERT INTO running_timer_new
SELECT r.id, r.description,
       (SELECT new FROM id_map WHERE tbl = 'project' AND old = r.project_id),
       (SELECT new FROM id_map WHERE tbl = 'task' AND old = r.task_id),
       r.started_at, r.paused_at, r.banked_seconds
  FROM running_timer r;

CREATE TABLE task_dependency_new (
  task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  blocked_by_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, blocked_by_id),
  CHECK (task_id != blocked_by_id)
);
INSERT INTO task_dependency_new
SELECT t.new, b.new
  FROM task_dependency d
  JOIN id_map t ON t.tbl = 'task' AND t.old = d.task_id
  JOIN id_map b ON b.tbl = 'task' AND b.old = d.blocked_by_id;

CREATE TABLE record_phase_new (
  task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  status_id TEXT NOT NULL REFERENCES item_status(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (task_id, status_id)
);
INSERT INTO record_phase_new
SELECT t.new, s.new, r.notes
  FROM record_phase r
  JOIN id_map t ON t.tbl = 'task' AND t.old = r.task_id
  JOIN id_map s ON s.tbl = 'item_status' AND s.old = r.status_id;

CREATE TABLE project_canvas_new (
  project_id TEXT PRIMARY KEY NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
INSERT INTO project_canvas_new
SELECT p.new, c.content, c.updated_at
  FROM project_canvas c JOIN id_map p ON p.tbl = 'project' AND p.old = c.project_id;

DROP TABLE project_canvas;
DROP TABLE record_phase;
DROP TABLE task_dependency;
DROP TABLE running_timer;
DROP TABLE ritual_run;
DROP TABLE habit_log;
DROP TABLE habit;
DROP TABLE time_entry;
DROP TABLE time_block;
DROP TABLE task;
DROP TABLE saved_view;
DROP TABLE milestone;
DROP TABLE item_status;
DROP TABLE item_type;
DROP TABLE outcome;
DROP TABLE priority;
DROP TABLE quarter;
DROP TABLE section;
DROP TABLE project;
DROP TABLE project_group;

ALTER TABLE project_group_new RENAME TO project_group;
ALTER TABLE project_new RENAME TO project;
ALTER TABLE section_new RENAME TO section;
ALTER TABLE quarter_new RENAME TO quarter;
ALTER TABLE priority_new RENAME TO priority;
ALTER TABLE outcome_new RENAME TO outcome;
ALTER TABLE item_type_new RENAME TO item_type;
ALTER TABLE item_status_new RENAME TO item_status;
ALTER TABLE milestone_new RENAME TO milestone;
ALTER TABLE saved_view_new RENAME TO saved_view;
ALTER TABLE task_new RENAME TO task;
ALTER TABLE time_block_new RENAME TO time_block;
ALTER TABLE time_entry_new RENAME TO time_entry;
ALTER TABLE habit_new RENAME TO habit;
ALTER TABLE habit_log_new RENAME TO habit_log;
ALTER TABLE ritual_run_new RENAME TO ritual_run;
ALTER TABLE running_timer_new RENAME TO running_timer;
ALTER TABLE task_dependency_new RENAME TO task_dependency;
ALTER TABLE record_phase_new RENAME TO record_phase;
ALTER TABLE project_canvas_new RENAME TO project_canvas;

CREATE INDEX project_parent ON project(parent_id);
CREATE UNIQUE INDEX project_external ON project(external_id);
CREATE INDEX section_project ON section(project_id);
CREATE UNIQUE INDEX section_external ON section(external_id);
CREATE INDEX outcome_week ON outcome(week_start);
CREATE INDEX item_type_project ON item_type(project_id);
CREATE INDEX item_status_project ON item_status(project_id);
CREATE INDEX milestone_project ON milestone(project_id);
CREATE INDEX saved_view_project ON saved_view(project_id);
CREATE INDEX task_project ON task(project_id);
CREATE INDEX task_due_date ON task(due_date);
CREATE UNIQUE INDEX task_external ON task(external_id);
CREATE INDEX task_section ON task(section_id);
CREATE INDEX task_parent ON task(parent_id);
CREATE INDEX task_outcome ON task(outcome_id);
CREATE INDEX task_must_on ON task(must_on);
CREATE INDEX task_type ON task(type_id);
CREATE INDEX task_status ON task(status_id);
CREATE INDEX task_phase ON task(phase_id);
CREATE INDEX time_block_start ON time_block(start_at);
CREATE INDEX time_block_task ON time_block(task_id);
CREATE INDEX time_entry_started ON time_entry(started_at);
CREATE INDEX time_entry_task ON time_entry(task_id);
CREATE INDEX habit_log_date ON habit_log(date);
CREATE INDEX ritual_run_kind_date ON ritual_run(kind, date);
CREATE INDEX task_dependency_blocked_by ON task_dependency(blocked_by_id);
