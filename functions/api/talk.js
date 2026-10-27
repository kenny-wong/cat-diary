import { badRequest, json, serverError, unauthorized } from '../../lib/http.js';
import { isId } from '../../lib/validate.js';
import { visiblePage } from '../../lib/talk.js';

// Comments and reactions on one page: GET /api/talk?owner=<user id>&entry=<page id>
export async function onRequestGet({ request, env, data }) {
  if (!data.user) return unauthorized();
  const url = new URL(request.url);
  const owner = url.searchParams.get('owner');
  const entry = url.searchParams.get('entry');
  if (!isId(owner) || !isId(entry)) return badRequest('Bad page.');
  const me = data.user.id;
  try {
    if (!(await visiblePage(env.DB, me, owner, entry))) return json({ error: 'Page not found.' }, 404);
    const [comments, reactions] = await env.DB.batch([
      env.DB.prepare(
        `SELECT c.id, c.parent_id, c.author_id, u.name AS author_name, c.body, c.created_at
         FROM comments c JOIN users u ON u.id = c.author_id
         WHERE c.entry_owner = ? AND c.entry_id = ? ORDER BY c.created_at, c.rowid`).bind(owner, entry),
      env.DB.prepare(
        `SELECT r.emoji, r.user_id, u.name FROM reactions r JOIN users u ON u.id = r.user_id
         WHERE r.entry_owner = ? AND r.entry_id = ? ORDER BY r.created_at`).bind(owner, entry),
    ]);
    const byEmoji = new Map();
    for (const r of reactions.results) {
      if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, { emoji: r.emoji, count: 0, mine: false, names: [] });
      const g = byEmoji.get(r.emoji);
      g.count++;
      g.names.push(r.name);
      if (r.user_id === me) g.mine = true;
    }
    return json({
      comments: comments.results.map(c => ({
        id: c.id, parentId: c.parent_id, authorId: c.author_id, authorName: c.author_name, body: c.body, createdAt: c.created_at,
        mine: c.author_id === me, canDelete: c.author_id === me || owner === me,
      })),
      reactions: [...byEmoji.values()],
    });
  } catch (err) {
    return serverError(err, 'talk');
  }
}
