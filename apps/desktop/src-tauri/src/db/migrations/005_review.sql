CREATE TABLE outcome_next (
  id INTEGER PRIMARY KEY,
  week_start TEXT NOT NULL REFERENCES week(start_date) ON DELETE CASCADE,
  priority_id INTEGER REFERENCES priority(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'achieved', 'carried', 'dropped')),
  carried_from INTEGER REFERENCES outcome(id) ON DELETE SET NULL
);
INSERT INTO outcome_next (id, week_start, priority_id, title, status)
  SELECT id, week_start, priority_id, title, status FROM outcome;
DROP TABLE outcome;
ALTER TABLE outcome_next RENAME TO outcome;
CREATE INDEX outcome_week ON outcome(week_start);

ALTER TABLE task ADD COLUMN outcome_id INTEGER REFERENCES outcome(id) ON DELETE SET NULL;
CREATE INDEX task_outcome ON task(outcome_id);

ALTER TABLE week ADD COLUMN felt INTEGER CHECK (felt BETWEEN 1 AND 5);
ALTER TABLE week ADD COLUMN step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE week ADD COLUMN reviewed_at INTEGER;
UPDATE week SET change = improvement WHERE change = '' AND improvement != '';

ALTER TABLE day ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0;

ALTER TABLE priority ADD COLUMN note TEXT NOT NULL DEFAULT '';
