DROP TRIGGER IF EXISTS store_undo_insert_task;
DROP TRIGGER IF EXISTS store_undo_update_task;
DROP TRIGGER IF EXISTS store_undo_delete_task;

ALTER TABLE task DROP COLUMN rollover_count;
