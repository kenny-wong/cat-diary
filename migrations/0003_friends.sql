-- Friends: requests by email, mutual friendships, one best friend each, and pages shared with friends.

-- A request is sent to an email address, so it can wait for someone who hasn't signed in yet.
CREATE TABLE friend_requests (
  id TEXT PRIMARY KEY,
  from_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (from_user, to_email)
);
CREATE INDEX friend_requests_to ON friend_requests(to_email);

-- Two rows per friendship, one for each side, so each person keeps their own "best friend" mark.
CREATE TABLE friendships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  best INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, friend_id)
);
CREATE UNIQUE INDEX friendships_one_best ON friendships(user_id) WHERE best = 1;

-- 1 = friends can read this page, 0 = private. Mirrors the page JSON's "shared" flag.
ALTER TABLE entries ADD COLUMN shared INTEGER NOT NULL DEFAULT 0;
CREATE INDEX entries_shared ON entries(user_id, shared);
