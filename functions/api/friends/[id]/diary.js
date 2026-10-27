import { badRequest, json, serverError, unauthorized } from '../../../../lib/http.js';
import { isId } from '../../../../lib/validate.js';
import { areFriends } from '../../../../lib/friends.js';

// A friend's diary: only the pages they share with friends.
export async function onRequestGet({ env, data, params }) {
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad friend id.');
  try {
    if (!(await areFriends(env.DB, data.user.id, params.id))) return json({ error: 'Not your friend.' }, 404);
    const friend = await env.DB.prepare('SELECT id, name FROM users WHERE id = ?').bind(params.id).first();
    const { results } = await env.DB.prepare('SELECT data FROM entries WHERE user_id = ? AND shared = 1').bind(params.id).all();
    return json({ friend, entries: results.map(r => JSON.parse(r.data)) });
  } catch (err) {
    return serverError(err, 'friend diary');
  }
}
