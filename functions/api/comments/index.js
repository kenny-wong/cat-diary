import { badRequest, isoAt, json, readJson, serverError, unauthorized } from '../../../lib/http.js';
import { newId } from '../../../lib/crypto.js';
import { isId } from '../../../lib/validate.js';
import { MAX_COMMENTS_PER_MINUTE, cleanComment, commentRecipients, visiblePage } from '../../../lib/talk.js';
import { pageLabel, pushNote, snippet } from '../../../lib/push.js';
import { findMentions, mentionable } from '../../../lib/mentions.js';

// Comment on a page, or reply to a comment: { owner, entry, body, parentId? }
// Friends mentioned as "@Name" are told too, if they can see the page; the answer lists those who can't (notSeen).
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
    // Someone already told about this comment (as the page owner, or the one replied to) isn't told twice.
    const people = body.includes('@') ? await mentionable(db, me) : [];
    const notSeen = [];
    for (const id of findMentions(body, people)) {
      if (notes.some(n => n.userId === id)) continue;
      if (await visiblePage(db, id, b.owner, b.entry)) notes.push({ userId: id, kind: 'mention', noteId: newId() });
      else notSeen.push(people.find(p => p.id === id).name);
    }
    for (const n of notes) {
      steps.push(db.prepare('INSERT INTO notifications (id, user_id, actor_id, kind, entry_owner, entry_id, comment_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(n.noteId, n.userId, me, n.kind, b.owner, b.entry, id, isoAt()));
    }
    await db.batch(steps);
    const ownerName = people.find(p => p.id === b.owner)?.name;
    for (const n of notes) {
      const whose = n.userId === b.owner ? 'your' : b.owner === me ? 'their' : `${ownerName || 'a friend'}'s`;
      const what = n.kind === 'reply' ? 'replied to your comment'
        : n.kind === 'mention' ? `mentioned you in a comment on ${whose} page${pageLabel(page.title)}`
          : `commented on your page${pageLabel(page.title)}`;
      pushNote(context, n.userId, n.noteId, `${data.user.name} ${what}: ${snippet(body)}`);
    }
    return json({ id, notSeen }, 201);
  } catch (err) {
    return serverError(err, 'comment');
  }
}
