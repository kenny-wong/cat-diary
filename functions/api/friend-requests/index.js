import { badRequest, json, readJson, serverError, unauthorized } from '../../../lib/http.js';
import { newId } from '../../../lib/crypto.js';
import { normalizeEmail } from '../../../lib/validate.js';
import { MAX_PENDING_REQUESTS, areFriends, friendNote, makeFriends } from '../../../lib/friends.js';
import { pushNote } from '../../../lib/push.js';

// Send a friend request to a Google email. It waits there until that person signs in and accepts.
// If they had already sent you one, you simply become friends.
export async function onRequestPost(context) {
  const { request, env, data } = context;
  if (!data.user) return unauthorized();
  const me = data.user;
  const email = normalizeEmail((await readJson(request))?.email);
  if (!email) return badRequest('Please enter a valid email address.');
  if (email === me.email) return badRequest("That's your own email.");
  try {
    const target = await env.DB.prepare('SELECT id, name, email FROM users WHERE email = ?').bind(email).first();
    if (target) {
      if (await areFriends(env.DB, me.id, target.id)) return json({ error: "You're already friends." }, 409);
      const theirs = await env.DB.prepare('SELECT 1 FROM friend_requests WHERE from_user = ? AND to_email = ?').bind(target.id, me.email).first();
      if (theirs) {
        const noteId = await makeFriends(env.DB, me, target);
        pushNote(context, target.id, noteId, `${me.name} accepted your friend request. You're friends now!`);
        return json({ status: 'friends', name: target.name });
      }
    }
    if (await env.DB.prepare('SELECT 1 FROM friend_requests WHERE from_user = ? AND to_email = ?').bind(me.id, email).first()) {
      return json({ status: 'sent' }, 201); // already waiting: no second notification
    }
    const pending = await env.DB.prepare('SELECT COUNT(*) AS n FROM friend_requests WHERE from_user = ?').bind(me.id).first();
    if (pending.n >= MAX_PENDING_REQUESTS) return json({ error: 'You have lots of requests waiting. Cancel some first.' }, 429);
    const steps = [env.DB.prepare('INSERT INTO friend_requests (id, from_user, to_email) VALUES (?, ?, ?)').bind(newId(), me.id, email)];
    // Someone without an account yet is told when they first sign in (see the Google callback).
    const noteId = newId();
    if (target) steps.push(friendNote(env.DB, target.id, me.id, 'friend_request', noteId));
    await env.DB.batch(steps);
    if (target) pushNote(context, target.id, noteId, `${me.name} sent you a friend request`);
    return json({ status: 'sent' }, 201);
  } catch (err) {
    return serverError(err, 'friend request');
  }
}
