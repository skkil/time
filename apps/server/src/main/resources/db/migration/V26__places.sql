-- Saved places: a task can happen at one of them. Deleting a place only clears it from its tasks.
CREATE TABLE place (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX place_name ON place(user_id, lower(name));

ALTER TABLE task ADD COLUMN place_id UUID REFERENCES place(id) ON DELETE SET NULL;

SELECT store_register('place', 'id', ARRAY['user_id']);
