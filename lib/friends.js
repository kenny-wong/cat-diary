// Friendships are stored as two rows (one per side), so each person keeps their own "best friend" mark.
import { newId } from './crypto.js';
import { isoAt } from './http.js';

export const MAX_PENDING_REQUESTS = 50;
export const MAX_BEST_FRIENDS = 4;

// Friend notifications ('friend_request', 'friend_accept') are not about a page, so their page columns are ''.
export const friendNote = (db, toUserId, actorId, kind, id = newId()) =>
  db.prepare("INSERT INTO notifications (id, user_id, actor_id, kind, entry_owner, entry_id, created_at) VALUES (?, ?, ?, ?, '', '', ?)")
    .bind(id, toUserId, actorId, kind, isoAt());

// Remove the "sent you a friend request" notification once that request is gone.
export const clearRequestNote = (db, toUserId, fromUserId) =>
  db.prepare("DELETE FROM notifications WHERE kind = 'friend_request' AND user_id = ? AND actor_id = ?").bind(toUserId, fromUserId);

// `me` accepts `them` (or both had asked each other): make them friends, clear the requests and their
// notifications, and tell `them`, all in one transaction. Resolves to the id of the notification for `them`.
export async function makeFriends(db, me, them) {
  const noteId = newId();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').bind(me.id, them.id),
    db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').bind(them.id, me.id),
    db.prepare('DELETE FROM friend_requests WHERE (from_user = ? AND to_email = ?) OR (from_user = ? AND to_email = ?)')
      .bind(me.id, them.email, them.id, me.email),
    clearRequestNote(db, me.id, them.id),
    clearRequestNote(db, them.id, me.id),
    friendNote(db, them.id, me.id, 'friend_accept', noteId),
  ]);
  return noteId;
}

export async function areFriends(db, userId, friendId) {
  return !!(await db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').bind(userId, friendId).first());
}
