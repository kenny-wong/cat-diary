-- Comments (with replies), emoji reactions and notifications on diary pages.

-- Replies point at the first comment of their thread (parent_id), so threads are one level deep.
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  entry_owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX comments_entry ON comments(entry_owner, entry_id, created_at);
CREATE INDEX comments_author ON comments(author_id, created_at);

CREATE TABLE reactions (
  entry_owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (entry_owner, entry_id, user_id, emoji)
);

-- kind: 'comment' (on your page), 'reply' (to your comment) or 'reaction' (on your page).
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  entry_owner TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  emoji TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX notifications_user ON notifications(user_id, created_at);
