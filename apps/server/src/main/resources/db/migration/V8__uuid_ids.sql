CREATE FUNCTION v8_uuid7(ts_ms BIGINT, seq BIGINT) RETURNS UUID LANGUAGE sql VOLATILE AS $$
  SELECT (
    lpad(to_hex((ts_ms << 16) | 28672 | ((seq >> 30) & 4095)), 16, '0') ||
    lpad(to_hex(x'8000000000000000'::BIT(64)::BIGINT | ((seq & 1073741823) << 32)
                | floor(random() * 4294967296)::BIGINT), 16, '0')
  )::UUID
$$;

CREATE TABLE v8_id_map (
  tbl TEXT NOT NULL,
  old_id BIGINT NOT NULL,
  new_id UUID NOT NULL UNIQUE,
  PRIMARY KEY (tbl, old_id)
);

CREATE FUNCTION v8_map(t TEXT, old BIGINT) RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT new_id FROM v8_id_map WHERE tbl = t AND old_id = old
$$;

DELETE FROM undo_snapshot;

CREATE TEMPORARY TABLE v8_fk (owner REGCLASS, name TEXT, definition TEXT);

DO $$
DECLARE
  identity_tables TEXT[] := ARRAY[
    'project_group', 'project', 'section', 'item_type', 'item_status', 'milestone', 'saved_view', 'quarter',
    'priority', 'outcome', 'task', 'time_block', 'time_entry', 'habit', 'ritual_run', 'undo_snapshot'];
  keyed_tables TEXT[] := ARRAY[
    'setting', 'project_canvas', 'week', 'day', 'task_dependency', 'record_phase', 'running_timer', 'habit_log',
    'ritual', 'user_preference'];
  ts BIGINT := floor(extract(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  seq BIGINT := 0;
  added BIGINT;
  t TEXT;
  r RECORD;
  natural_key TEXT;
BEGIN
  FOREACH t IN ARRAY identity_tables LOOP
    EXECUTE format(
      'INSERT INTO v8_id_map SELECT %L, id, v8_uuid7(%s, %s + row_number() OVER (ORDER BY id)) FROM %I',
      t, ts, seq, t);
    GET DIAGNOSTICS added = ROW_COUNT;
    seq := seq + added;
  END LOOP;

  INSERT INTO v8_fk
  SELECT c.conrelid::REGCLASS, c.conname, pg_get_constraintdef(c.oid)
  FROM pg_constraint c
  WHERE c.contype = 'f' AND c.connamespace = current_schema()::REGNAMESPACE
    AND c.confrelid::REGCLASS::TEXT IN (SELECT unnest(identity_tables || ARRAY['week', 'ritual']));

  FOR r IN SELECT owner, name FROM v8_fk LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.owner, r.name);
  END LOOP;

  FOREACH t IN ARRAY identity_tables LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id DROP IDENTITY', t);
  END LOOP;

  FOR r IN
    WITH columns AS (
      SELECT unnest(identity_tables) AS owner, 'id' AS col, unnest(identity_tables) AS target
      UNION ALL
      SELECT fk.owner::TEXT, cols.col, cols.target
      FROM v8_fk fk,
        LATERAL (
          SELECT substring(fk.definition FROM '^FOREIGN KEY \(([a-z_]+)\) REFERENCES') AS col,
                 substring(fk.definition FROM 'REFERENCES ([a-z_]+)\(id\)') AS target
        ) cols
      WHERE cols.col IS NOT NULL AND cols.target IS NOT NULL
    )
    SELECT owner,
      string_agg(format('ALTER COLUMN %I TYPE UUID USING v8_map(%L, %I)', col, target, col), ', ') AS changes
    FROM columns GROUP BY owner
  LOOP
    EXECUTE format('ALTER TABLE %I %s', r.owner, r.changes);
  END LOOP;

  FOREACH t IN ARRAY keyed_tables LOOP
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY array_position(k.conkey, a.attnum))
      INTO natural_key
    FROM pg_constraint k
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
    WHERE k.conrelid = t::REGCLASS AND k.contype = 'p';
    EXECUTE format('ALTER TABLE %I ADD COLUMN id UUID', t);
    EXECUTE format(
      'UPDATE %I SET id = v8_uuid7(%s, %s + s.n) FROM '
      '(SELECT ctid AS row_ctid, row_number() OVER (ORDER BY %s) AS n FROM %I) s WHERE %I.ctid = s.row_ctid',
      t, ts, seq, natural_key, t, t);
    GET DIAGNOSTICS added = ROW_COUNT;
    seq := seq + added;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, t || '_pkey');
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', t, t || '_pkey');
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (%s)', t, t || '_key', natural_key);
  END LOOP;

  FOR r IN SELECT owner, name, definition FROM v8_fk LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.owner, r.name, r.definition);
  END LOOP;
END
$$;

DROP TABLE v8_fk;
DROP FUNCTION v8_map(TEXT, BIGINT);
DROP TABLE v8_id_map;
DROP FUNCTION v8_uuid7(BIGINT, BIGINT);

ALTER TABLE app_user ADD COLUMN scope_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid();
