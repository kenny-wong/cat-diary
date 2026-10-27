import { isoAt, json, serverError } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';

const ACTIVE_EVERY = 60000; // record "last active" at most once a minute per person

// Runs before every /api route: blocks cross-site writes, looks up who is logged in,
// and notes that they are active (the diary only calls the API while it's on screen).
export async function onRequest(context) {
  const { request, env, data, next } = context;
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'Cross-site request blocked.' }, 403);
  }
  try {
    data.user = await getSessionUser(env.DB, request);
  } catch (err) {
    return serverError(err, 'session lookup');
  }
  const u = data.user;
  if (u && !(u.last_active_at > isoAt(-ACTIVE_EVERY))) {
    context.waitUntil(env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').bind(isoAt(), u.id).run().catch(() => {}));
  }
  const res = await next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  return res;
}
