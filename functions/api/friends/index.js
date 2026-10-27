import { json, serverError, unauthorized } from '../../../lib/http.js';

// Your friends, requests sent to you, and requests you're still waiting on.
export async function onRequestGet({ env, data }) {
  if (!data.user) return unauthorized();
  const me = data.user;
  try {
    const [friends, incoming, outgoing] = await env.DB.batch([
      env.DB.prepare(
        `SELECT u.id, u.name, u.email, f.best, u.last_active_at, u.last_wrote_at FROM friendships f JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = ? ORDER BY f.best DESC, u.name COLLATE NOCASE`).bind(me.id),
      env.DB.prepare(
        `SELECT r.id, u.name, u.email FROM friend_requests r JOIN users u ON u.id = r.from_user
         WHERE r.to_email = ? ORDER BY r.created_at DESC`).bind(me.email),
      env.DB.prepare(
        `SELECT r.id, r.to_email AS email, u.name FROM friend_requests r LEFT JOIN users u ON u.email = r.to_email
         WHERE r.from_user = ? ORDER BY r.created_at DESC`).bind(me.id),
    ]);
    return json({
      friends: friends.results.map(({ last_active_at: lastActive, last_wrote_at: lastWrote, ...f }) => ({ ...f, best: f.best === 1, lastActive, lastWrote })),
      incoming: incoming.results,
      outgoing: outgoing.results,
    });
  } catch (err) {
    return serverError(err, 'list friends');
  }
}
