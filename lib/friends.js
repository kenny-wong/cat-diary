// Friendships are stored as two rows (one per side), so each person keeps their own "best friend" mark.

export const MAX_PENDING_REQUESTS = 50;

// Make two users friends and clear any requests between them, in one transaction.
export function makeFriends(db, a, b) {
  return db.batch([
    db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').bind(a.id, b.id),
    db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').bind(b.id, a.id),
    db.prepare('DELETE FROM friend_requests WHERE (from_user = ? AND to_email = ?) OR (from_user = ? AND to_email = ?)')
      .bind(a.id, b.email, b.id, a.email),
  ]);
}

export async function areFriends(db, userId, friendId) {
  return !!(await db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').bind(userId, friendId).first());
}
