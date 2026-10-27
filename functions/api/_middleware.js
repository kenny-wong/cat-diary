import { json, serverError } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';

// Runs before every /api route: blocks cross-site writes and looks up who is logged in.
export async function onRequest({ request, env, data, next }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'Cross-site request blocked.' }, 403);
  }
  try {
    data.user = await getSessionUser(env.DB, request);
  } catch (err) {
    return serverError(err, 'session lookup');
  }
  const res = await next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  return res;
}
