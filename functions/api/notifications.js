import { isoAt, json, readJson, serverError, unauthorized } from '../../lib/http.js';
import { isId } from '../../lib/validate.js';

const KEEP_DAYS = 90;

// Your latest notifications and how many are unread.
export async function onRequestGet({ env, data }) {
  if (!data.user) return unauthorized();
  const me = data.user.id;
  try {
    const [items, unread] = await env.DB.batch([
      // A page's title is only shown while you can still see the page.
      env.DB.prepare(
        `SELECT n.id, n.kind, n.entry_owner, n.entry_id, n.emoji, n.read, n.created_at, u.name AS actor_name, c.body AS comment_body,
           CASE WHEN e.user_id = ?1 OR e.shared = 1 THEN json_extract(e.data, '$.title') END AS title,
           owner.name AS owner_name
         FROM notifications n
         JOIN users u ON u.id = n.actor_id
         LEFT JOIN users owner ON owner.id = n.entry_owner
         LEFT JOIN entries e ON e.user_id = n.entry_owner AND e.id = n.entry_id
         LEFT JOIN comments c ON c.id = n.comment_id
         WHERE n.user_id = ?1 ORDER BY n.created_at DESC, n.rowid DESC LIMIT 50`).bind(me),
      env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0').bind(me),
    ]);
    return json({
      unread: unread.results[0].n,
      items: items.results.map(n => ({
        id: n.id, kind: n.kind, owner: n.entry_owner, ownerName: n.owner_name, entryId: n.entry_id, emoji: n.emoji,
        read: n.read === 1, createdAt: n.created_at, actorName: n.actor_name, comment: n.comment_body, title: n.title,
      })),
    });
  } catch (err) {
    return serverError(err, 'notifications');
  }
}

// Mark notifications read: { all: true } or { ids: [...] }. Also tidies away old ones.
export async function onRequestPost({ request, env, data }) {
  if (!data.user) return unauthorized();
  const b = await readJson(request);
  const me = data.user.id;
  try {
    const steps = [env.DB.prepare('DELETE FROM notifications WHERE user_id = ? AND created_at < ?').bind(me, isoAt(-KEEP_DAYS * 86400000))];
    if (b?.all === true) {
      steps.push(env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').bind(me));
    } else if (Array.isArray(b?.ids)) {
      for (const id of b.ids.filter(isId).slice(0, 100)) {
        steps.push(env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?').bind(me, id));
      }
    }
    await env.DB.batch(steps);
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'read notifications');
  }
}
