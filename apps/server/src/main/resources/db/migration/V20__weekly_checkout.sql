-- The weekly review moved into the evening checkout, so the standalone weekly ritual stops opening by itself unless
-- someone set it to, as time-core's migration 023 does on each device. The rows change under store.bypass, so their
-- accounts are baselined again and a device pulling from version 0 receives the new trigger.
SET LOCAL store.bypass = on;

DELETE FROM sync_baseline
WHERE user_id IN (SELECT user_id FROM ritual WHERE kind = 'weekly' AND trigger = 'first_open');

UPDATE ritual SET trigger = 'manual' WHERE kind = 'weekly' AND trigger = 'first_open';
