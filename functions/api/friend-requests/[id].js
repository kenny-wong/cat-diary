import { badRequest, json, serverError, unauthorized } from '../../../lib/http.js';
import { isId } from '../../../lib/validate.js';
import { makeFriends } from '../../../lib/friends.js';

// Accept a request someone sent to your email.
export async function onRequestPost({ env, data, params }) {
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad request id.');
  const me = data.user;
  try {
    const from = await env.DB.prepare(
      'SELECT u.id, u.email, u.name FROM friend_requests r JOIN users u ON u.id = r.from_user WHERE r.id = ? AND r.to_email = ?')
      .bind(params.id, me.email).first();
    if (!from) return json({ error: 'This request is no longer there.' }, 404);
    await makeFriends(env.DB, me, from);
    return json({ ok: true, name: from.name });
  } catch (err) {
    return serverError(err, 'accept friend');
  }
}

// Decline a request sent to you, or cancel one you sent.
export async function onRequestDelete({ env, data, params }) {
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad request id.');
  try {
    await env.DB.prepare('DELETE FROM friend_requests WHERE id = ? AND (from_user = ? OR to_email = ?)')
      .bind(params.id, data.user.id, data.user.email).run();
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'delete friend request');
  }
}
