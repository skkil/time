-- Tasks no longer count how often they were moved.
ALTER TABLE task DROP COLUMN rollover_count;
