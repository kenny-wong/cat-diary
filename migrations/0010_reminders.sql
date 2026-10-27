-- Daily reminder: the person's chosen local time ('HH:MM', NULL = off), their time zone, and the local
-- date of the last reminder, so each day gets at most one.
ALTER TABLE users ADD COLUMN remind_at TEXT;
ALTER TABLE users ADD COLUMN time_zone TEXT;
ALTER TABLE users ADD COLUMN reminded_on TEXT;
