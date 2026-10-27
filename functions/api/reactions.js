import { badRequest, isoAt, json, readJson, serverError, unauthorized } from '../../lib/http.js';
import { newId } from '../../lib/crypto.js';
import { isId } from '../../lib/validate.js';
import { REACTIONS, visiblePage } from '../../lib/talk.js';

// Toggle an emoji reaction on a page: { owner, entry, emoji } -> { on }
export async function onRequestPost({ request, env, data }) {
  if (!data.user) return unauthorized();
  const b = await readJson(request);
  if (!isId(b?.owner) || !isId(b?.entry)) return badRequest('Bad page.');
  if (!REACTIONS.includes(b.emoji)) return badRequest('Pick one of the emoji.');
  const me = data.user.id;
  const db = env.DB;
  try {
    if (!(await visiblePage(db, me, b.owner, b.entry))) return json({ error: 'You can no longer see this page.' }, 404);
    const removed = await db.prepare('DELETE FROM reactions WHERE entry_owner = ? AND entry_id = ? AND user_id = ? AND emoji = ?')
      .bind(b.owner, b.entry, me, b.emoji).run();
    if (removed.meta.changes) {
      await db.prepare("DELETE FROM notifications WHERE kind = 'reaction' AND actor_id = ? AND entry_owner = ? AND entry_id = ? AND emoji = ?")
        .bind(me, b.owner, b.entry, b.emoji).run();
      return json({ on: false });
    }
    const steps = [db.prepare('INSERT INTO reactions (entry_owner, entry_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(b.owner, b.entry, me, b.emoji, isoAt())];
    if (b.owner !== me) {
      steps.push(db.prepare("INSERT INTO notifications (id, user_id, actor_id, kind, entry_owner, entry_id, emoji, created_at) VALUES (?, ?, ?, 'reaction', ?, ?, ?, ?)")
        .bind(newId(), b.owner, me, b.owner, b.entry, b.emoji, isoAt()));
    }
    await db.batch(steps);
    return json({ on: true });
  } catch (err) {
    return serverError(err, 'reaction');
  }
}
