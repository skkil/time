-- Outcomes and priorities list in creation order. Ids no longer say that
-- once other devices and the server mint them, so keep it in a column;
-- existing rows keep their current (id) order.
ALTER TABLE outcome ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE priority ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
UPDATE outcome SET created_at = (SELECT COUNT(*) FROM outcome o WHERE o.id < outcome.id);
UPDATE priority SET created_at = (SELECT COUNT(*) FROM priority p WHERE p.id < priority.id);
