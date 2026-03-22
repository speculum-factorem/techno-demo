-- Однократно на VPS, если auth-service уже оставил таблицы без колонок / с NULL после неудачного ddl-auto.
-- Подключение: psql -h postgres -U $POSTGRES_USER -d authdb -f repair-auth-schema-postgres.sql
-- (или docker compose exec postgres psql -U ... -d authdb < ...)

ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean;
UPDATE users SET active = true WHERE active IS NULL;
ALTER TABLE users ALTER COLUMN active SET DEFAULT true;
ALTER TABLE users ALTER COLUMN active SET NOT NULL;

ALTER TABLE organization_invite_codes ADD COLUMN IF NOT EXISTS consumable_once boolean;
UPDATE organization_invite_codes SET consumable_once = false WHERE consumable_once IS NULL;
ALTER TABLE organization_invite_codes ALTER COLUMN consumable_once SET DEFAULT false;
ALTER TABLE organization_invite_codes ALTER COLUMN consumable_once SET NOT NULL;

ALTER TABLE organization_invite_codes ADD COLUMN IF NOT EXISTS default_app_role varchar(32);
ALTER TABLE organization_invite_codes ADD COLUMN IF NOT EXISTS invited_email varchar(255);
