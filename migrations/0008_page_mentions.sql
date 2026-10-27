-- Friends already told that they were mentioned ("@Name") on a diary page, so later saves of the
-- same page don't tell them again. Mentions in comments are told once, when the comment is sent.
-- New notification kinds: 'tag' (mentioned on a page) and 'mention' (mentioned in a comment).
CREATE TABLE page_mentions (
  entry_owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (entry_owner, entry_id, user_id)
);
