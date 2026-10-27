-- When each person last had the diary open (updated at most once a minute) and last wrote a page.
ALTER TABLE users ADD COLUMN last_active_at TEXT;
ALTER TABLE users ADD COLUMN last_wrote_at TEXT;

-- Start "last wrote" from the newest saved page (its own timestamp, in milliseconds).
UPDATE users SET last_wrote_at = (
  SELECT strftime('%Y-%m-%dT%H:%M:%SZ', MAX(updated_at) / 1000, 'unixepoch') FROM entries WHERE entries.user_id = users.id
);
