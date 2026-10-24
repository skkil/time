-- Every user-owned table keyed by a uuid id syncs through store from here on. Writes to them need an open
-- mutation (store_begin or store_begin_server); a later migration that rewrites their rows must run
-- SET LOCAL store.bypass = on first.
-- Not synced: app_user and user_identity (accounts), push_device and realtime_ticket (per-device server state).
SELECT store_register('setting', 'id', ARRAY['user_id']);
SELECT store_register('project_group', 'id', ARRAY['user_id']);
SELECT store_register('project', 'id', ARRAY['user_id']);
SELECT store_register('project_canvas', 'id');
SELECT store_register('section', 'id', ARRAY['user_id']);
SELECT store_register('item_type', 'id', ARRAY['user_id']);
SELECT store_register('item_status', 'id', ARRAY['user_id']);
SELECT store_register('milestone', 'id', ARRAY['user_id']);
SELECT store_register('saved_view', 'id', ARRAY['user_id']);
SELECT store_register('quarter', 'id', ARRAY['user_id']);
SELECT store_register('priority', 'id', ARRAY['user_id']);
SELECT store_register('week', 'id', ARRAY['user_id']);
SELECT store_register('outcome', 'id', ARRAY['user_id']);
SELECT store_register('day', 'id', ARRAY['user_id']);
SELECT store_register('task', 'id', ARRAY['user_id', 'reminded_for']);
SELECT store_register('task_dependency', 'id');
SELECT store_register('record_phase', 'id');
SELECT store_register('time_block', 'id', ARRAY['user_id']);
SELECT store_register('time_entry', 'id', ARRAY['user_id']);
SELECT store_register('running_timer', 'id', ARRAY['user_id']);
SELECT store_register('habit', 'id', ARRAY['user_id']);
SELECT store_register('habit_log', 'id');
SELECT store_register('ritual', 'id', ARRAY['user_id']);
SELECT store_register('ritual_run', 'id', ARRAY['user_id']);
SELECT store_register('user_preference', 'id', ARRAY['user_id']);
