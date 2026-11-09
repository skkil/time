-- Outcomes and priorities keep their order in `position` (1, 2, 3… within a
-- week or a quarter), as on the server, instead of `created_at`. Rebuilt
-- rather than altered so store's capture triggers go with the old column;
-- the engine registers the tables again after migrating.
CREATE TABLE priority_new (
  id TEXT PRIMARY KEY NOT NULL,
  quarter_id TEXT NOT NULL REFERENCES quarter(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
INSERT INTO priority_new (id, quarter_id, title, note, position)
SELECT id, quarter_id, title, note,
       ROW_NUMBER() OVER (PARTITION BY quarter_id ORDER BY created_at, id)
  FROM priority;

CREATE TABLE outcome_new (
  id TEXT PRIMARY KEY NOT NULL,
  week_start TEXT NOT NULL REFERENCES week(start_date) ON DELETE CASCADE,
  priority_id TEXT REFERENCES priority(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'achieved', 'carried', 'dropped')),
  carried_from TEXT REFERENCES outcome(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0
);
INSERT INTO outcome_new (id, week_start, priority_id, title, status, carried_from, position)
SELECT id, week_start, priority_id, title, status, carried_from,
       ROW_NUMBER() OVER (PARTITION BY week_start ORDER BY created_at, id)
  FROM outcome;

DROP TABLE outcome;
DROP TABLE priority;
ALTER TABLE priority_new RENAME TO priority;
ALTER TABLE outcome_new RENAME TO outcome;
CREATE INDEX outcome_week ON outcome(week_start);
