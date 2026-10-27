import { badRequest, json, readJson, serverError, unauthorized } from '../../../lib/http.js';
import { isId } from '../../../lib/validate.js';
import { areFriends } from '../../../lib/friends.js';

// Mark (or unmark) this friend as your one best friend.
export async function onRequestPut({ request, env, data, params }) {
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad friend id.');
  const body = await readJson(request);
  if (typeof body?.best !== 'boolean') return badRequest('Missing best.');
  try {
    if (!(await areFriends(env.DB, data.user.id, params.id))) return json({ error: 'Not your friend.' }, 404);
    const steps = [env.DB.prepare('UPDATE friendships SET best = 0 WHERE user_id = ?').bind(data.user.id)];
    if (body.best) {
      steps.push(env.DB.prepare('UPDATE friendships SET best = 1 WHERE user_id = ? AND friend_id = ?').bind(data.user.id, params.id));
    }
    await env.DB.batch(steps);
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
