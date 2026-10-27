-- Rows identified by a natural key take UuidV5(scope_id, '<table>/<key parts joined by />'), as named in
-- docs/decisions/0001-sync-with-store.md ("Natural keys"); any foreign key to their ids follows.
SET LOCAL store.bypass = on;

CREATE FUNCTION v15_uuid5(namespace UUID, name TEXT) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(set_byte(set_byte(h, 6, (get_byte(h, 6) & 15) | 80), 8, (get_byte(h, 8) & 63) | 128), 'hex')::UUID
  FROM (SELECT substring(digest(uuid_send(namespace) || convert_to(name, 'UTF8'), 'sha1') FROM 1 FOR 16) AS h) d
$$;

CREATE TEMPORARY TABLE v15_key (tbl TEXT NOT NULL, old_id UUID NOT NULL, new_id UUID NOT NULL, PRIMARY KEY (tbl, old_id));

INSERT INTO v15_key
SELECT 'setting', s.id, v15_uuid5(u.scope_id, 'setting/' || s.key)
FROM setting s JOIN app_user u ON u.id = s.user_id
UNION ALL
SELECT 'project_canvas', c.id, v15_uuid5(u.scope_id, 'project_canvas/' || c.project_id::TEXT)
FROM project_canvas c JOIN project p ON p.id = c.project_id JOIN app_user u ON u.id = p.user_id
UNION ALL
SELECT 'week', w.id, v15_uuid5(u.scope_id, 'week/' || to_char(w.start_date, 'YYYY-MM-DD'))
FROM week w JOIN app_user u ON u.id = w.user_id
UNION ALL
SELECT 'day', d.id, v15_uuid5(u.scope_id, 'day/' || to_char(d.date, 'YYYY-MM-DD'))
FROM day d JOIN app_user u ON u.id = d.user_id
UNION ALL
SELECT 'task_dependency', d.id,
       v15_uuid5(u.scope_id, 'task_dependency/' || d.task_id::TEXT || '/' || d.blocked_by_id::TEXT)
FROM task_dependency d JOIN task t ON t.id = d.task_id JOIN app_user u ON u.id = t.user_id
UNION ALL
SELECT 'record_phase', r.id, v15_uuid5(u.scope_id, 'record_phase/' || r.task_id::TEXT || '/' || r.status_id::TEXT)
FROM record_phase r JOIN task t ON t.id = r.task_id JOIN app_user u ON u.id = t.user_id
UNION ALL
SELECT 'running_timer', r.id, v15_uuid5(u.scope_id, 'running_timer')
FROM running_timer r JOIN app_user u ON u.id = r.user_id
UNION ALL
SELECT 'habit_log', l.id, v15_uuid5(u.scope_id, 'habit_log/' || l.habit_id::TEXT || '/' || to_char(l.date, 'YYYY-MM-DD'))
FROM habit_log l JOIN habit h ON h.id = l.habit_id JOIN app_user u ON u.id = h.user_id
UNION ALL
SELECT 'ritual', r.id, v15_uuid5(u.scope_id, 'ritual/' || r.kind)
FROM ritual r JOIN app_user u ON u.id = r.user_id
UNION ALL
SELECT 'user_preference', p.id, v15_uuid5(u.scope_id, 'user_preference')
FROM user_preference p JOIN app_user u ON u.id = p.user_id;

DELETE FROM v15_key WHERE old_id = new_id;

CREATE TEMPORARY TABLE v15_fk (owner REGCLASS, name TEXT, col TEXT, target TEXT, definition TEXT);

INSERT INTO v15_fk
SELECT c.conrelid::REGCLASS, c.conname, a.attname, c.confrelid::REGCLASS::TEXT, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
JOIN pg_attribute t ON t.attrelid = c.confrelid AND t.attnum = c.confkey[1]
WHERE c.contype = 'f' AND c.connamespace = current_schema()::REGNAMESPACE AND cardinality(c.conkey) = 1
  AND t.attname = 'id' AND c.confrelid::REGCLASS::TEXT IN (SELECT DISTINCT tbl FROM v15_key);

DO $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  FOR r IN SELECT * FROM v15_fk LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.owner, r.name);
    EXECUTE format(
      'UPDATE %s o SET %I = k.new_id FROM v15_key k WHERE k.tbl = %L AND k.old_id = o.%I',
      r.owner, r.col, r.target, r.col);
  END LOOP;
  FOR t IN SELECT DISTINCT tbl FROM v15_key LOOP
    EXECUTE format('UPDATE %I o SET id = k.new_id FROM v15_key k WHERE k.tbl = %L AND k.old_id = o.id', t, t);
  END LOOP;
  FOR r IN SELECT * FROM v15_fk LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.owner, r.name, r.definition);
  END LOOP;
END
$$;

DROP TABLE v15_fk;
DROP TABLE v15_key;
DROP FUNCTION v15_uuid5(UUID, TEXT);
