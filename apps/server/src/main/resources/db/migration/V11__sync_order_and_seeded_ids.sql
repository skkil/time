ALTER TABLE priority ADD COLUMN position BIGINT NOT NULL DEFAULT 0;
UPDATE priority p SET position = s.n
FROM (SELECT id, row_number() OVER (PARTITION BY quarter_id ORDER BY id) AS n FROM priority) s
WHERE p.id = s.id;

ALTER TABLE outcome ADD COLUMN position BIGINT NOT NULL DEFAULT 0;
UPDATE outcome o SET position = s.n
FROM (SELECT id, row_number() OVER (PARTITION BY user_id, week_start ORDER BY id) AS n FROM outcome) s
WHERE o.id = s.id;

CREATE FUNCTION v11_uuid5(namespace UUID, name TEXT) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(set_byte(set_byte(h, 6, (get_byte(h, 6) & 15) | 80), 8, (get_byte(h, 8) & 63) | 128), 'hex')::UUID
  FROM (SELECT substring(digest(uuid_send(namespace) || convert_to(name, 'UTF8'), 'sha1') FROM 1 FOR 16) AS h) d
$$;

UPDATE ritual r SET id = v11_uuid5(u.scope_id, 'ritual/' || r.kind)
FROM app_user u
WHERE u.id = r.user_id;

DROP FUNCTION v11_uuid5(UUID, TEXT);
