ALTER TABLE organization RENAME TO project_group;
ALTER TABLE project RENAME COLUMN organization_id TO group_id;
