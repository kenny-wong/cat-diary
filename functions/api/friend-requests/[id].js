import { badRequest, json, serverError, unauthorized } from '../../../lib/http.js';
import { isId } from '../../../lib/validate.js';
import { clearRequestNote, makeFriends } from '../../../lib/friends.js';
import { pushNote } from '../../../lib/push.js';

// Accept a request someone sent to your email.
export async function onRequestPost(context) {
  const { env, data, params } = context;
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad request id.');
  const me = data.user;
  try {
    const from = await env.DB.prepare(
      'SELECT u.id, u.email, u.name FROM friend_requests r JOIN users u ON u.id = r.from_user WHERE r.id = ? AND r.to_email = ?')
      .bind(params.id, me.email).first();
    if (!from) return json({ error: 'This request is no longer there.' }, 404);
    const noteId = await makeFriends(env.DB, me, from);
    pushNote(context, from.id, noteId, `${me.name} accepted your friend request. You're friends now!`);
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
    const req = await env.DB.prepare(
      `SELECT r.from_user, u.id AS to_user FROM friend_requests r LEFT JOIN users u ON u.email = r.to_email
       WHERE r.id = ? AND (r.from_user = ? OR r.to_email = ?)`)
      .bind(params.id, data.user.id, data.user.email).first();
    if (!req) return json({ ok: true });
    const steps = [env.DB.prepare('DELETE FROM friend_requests WHERE id = ?').bind(params.id)];
    if (req.to_user) steps.push(clearRequestNote(env.DB, req.to_user, req.from_user));
    await env.DB.batch(steps);
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'delete friend request');
  }
}
