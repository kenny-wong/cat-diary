// Comments, reactions and notifications on diary pages.

export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🐱', '🎉', '🥰'];
export const MAX_COMMENT = 1000;
export const MAX_COMMENTS_PER_MINUTE = 20;

// Trimmed comment text, at most 1000 characters and two blank lines in a row; null if empty.
export function cleanComment(body) {
  if (typeof body !== 'string') return null;
  const text = body.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text ? text.slice(0, MAX_COMMENT) : null;
}

// Who should hear about a new comment: the page owner, and the person being replied to.
// Returns a map of user id -> notification kind, never including the commenter.
export function commentRecipients({ me, owner, parentAuthor }) {
  const to = new Map();
  if (owner !== me) to.set(owner, 'comment');
  if (parentAuthor && parentAuthor !== me) to.set(parentAuthor, 'reply');
  return to;
}

// A page can be talked about by its owner, and by the owner's friends while the page is shared.
// Returns the page's title and date, or null.
export function visiblePage(db, viewerId, ownerId, entryId) {
  if (viewerId === ownerId) {
    return db.prepare("SELECT json_extract(data, '$.title') AS title, date FROM entries WHERE user_id = ? AND id = ?")
      .bind(ownerId, entryId).first();
  }
  return db.prepare(
    `SELECT json_extract(e.data, '$.title') AS title, e.date FROM entries e
     JOIN friendships f ON f.user_id = ? AND f.friend_id = e.user_id
     WHERE e.user_id = ? AND e.id = ? AND e.shared = 1`)
    .bind(viewerId, ownerId, entryId).first();
}
