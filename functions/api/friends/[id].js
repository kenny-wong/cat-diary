import { badRequest, json, readJson, serverError, unauthorized } from '../../../lib/http.js';
import { isId } from '../../../lib/validate.js';
import { MAX_BEST_FRIENDS, areFriends } from '../../../lib/friends.js';

// Mark (or unmark) this friend as one of your best friends (up to MAX_BEST_FRIENDS).
export async function onRequestPut({ request, env, data, params }) {
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad friend id.');
  const body = await readJson(request);
  if (typeof body?.best !== 'boolean') return badRequest('Missing best.');
  const me = data.user.id;
  try {
    if (!(await areFriends(env.DB, me, params.id))) return json({ error: 'Not your friend.' }, 404);
    if (body.best) {
      const others = await env.DB.prepare('SELECT COUNT(*) AS n FROM friendships WHERE user_id = ? AND best = 1 AND friend_id != ?').bind(me, params.id).first();
      if (others.n >= MAX_BEST_FRIENDS) return json({ error: `You can have up to ${MAX_BEST_FRIENDS} best friends. Unmark one first.` }, 409);
    }
    await env.DB.prepare('UPDATE friendships SET best = ? WHERE user_id = ? AND friend_id = ?').bind(body.best ? 1 : 0, me, params.id).run();
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'best friend');
  }
}

// Stop being friends (for both people).
export async function onRequestDelete({ env, data, params }) {
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad friend id.');
  try {
    await env.DB.prepare('DELETE FROM friendships WHERE (user_id = ?1 AND friend_id = ?2) OR (user_id = ?2 AND friend_id = ?1)')
      .bind(data.user.id, params.id).run();
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'remove friend');
  }
}
