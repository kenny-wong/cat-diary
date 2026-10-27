import { badRequest, isoAt, json, readJson, serverError, unauthorized } from '../../../lib/http.js';
import { newId } from '../../../lib/crypto.js';
import { isId } from '../../../lib/validate.js';
import { MAX_COMMENTS_PER_MINUTE, cleanComment, commentRecipients, visiblePage } from '../../../lib/talk.js';
import { pageLabel, pushNote, snippet } from '../../../lib/push.js';

// Comment on a page, or reply to a comment: { owner, entry, body, parentId? }
export async function onRequestPost(context) {
  const { request, env, data } = context;
  if (!data.user) return unauthorized();
  const b = await readJson(request);
  if (!isId(b?.owner) || !isId(b?.entry)) return badRequest('Bad page.');
  const body = cleanComment(b.body);
  if (!body) return badRequest('Write something first.');
  if (b.parentId != null && !isId(b.parentId)) return badRequest('Bad reply.');
  const me = data.user.id;
  const db = env.DB;
  try {
    const page = await visiblePage(db, me, b.owner, b.entry);
    if (!page) return json({ error: 'You can no longer see this page.' }, 404);
    const recent = await db.prepare('SELECT COUNT(*) AS n FROM comments WHERE author_id = ? AND created_at > ?').bind(me, isoAt(-60000)).first();
    if (recent.n >= MAX_COMMENTS_PER_MINUTE) return json({ error: 'Slow down a little, then try again.' }, 429);

    let parent = null;
    if (b.parentId) {
      parent = await db.prepare('SELECT id, parent_id, author_id FROM comments WHERE id = ? AND entry_owner = ? AND entry_id = ?')
        .bind(b.parentId, b.owner, b.entry).first();
      if (!parent) return json({ error: 'That comment was deleted.' }, 404);
    }
    const id = newId();
    const steps = [
      db.prepare('INSERT INTO comments (id, entry_owner, entry_id, author_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, b.owner, b.entry, me, parent ? (parent.parent_id || parent.id) : null, body, isoAt()),
    ];
    const notes = [...commentRecipients({ me, owner: b.owner, parentAuthor: parent?.author_id })].map(([userId, kind]) => ({ userId, kind, noteId: newId() }));
    for (const n of notes) {
      steps.push(db.prepare('INSERT INTO notifications (id, user_id, actor_id, kind, entry_owner, entry_id, comment_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(n.noteId, n.userId, me, n.kind, b.owner, b.entry, id, isoAt()));
    }
    await db.batch(steps);
    for (const n of notes) {
      const what = n.kind === 'reply' ? 'replied to your comment' : `commented on your page ${pageLabel(page.title)}`;
      pushNote(context, n.userId, n.noteId, `${data.user.name} ${what}: ${snippet(body)}`);
    }
    return json({ id }, 201);
  } catch (err) {
    return serverError(err, 'comment');
  }
}
