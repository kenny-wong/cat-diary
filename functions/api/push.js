import { badRequest, json, readJson, serverError, unauthorized } from '../../lib/http.js';
import { isPushEndpoint, pushEnabled } from '../../lib/push.js';

const MAX_DEVICES = 10;

// The site's public push key, or null when push isn't set up.
export function onRequestGet({ env, data }) {
  if (!data.user) return unauthorized();
  return json({ key: pushEnabled(env) ? env.VAPID_PUBLIC_KEY : null });
}

// Turn notifications on for this device: the browser's PushSubscription as JSON.
export async function onRequestPost({ request, env, data }) {
  if (!data.user) return unauthorized();
  const sub = await readJson(request);
  const endpoint = sub?.endpoint;
  const { p256dh, auth } = sub?.keys || {};
  if (!isPushEndpoint(endpoint, { allowLocal: env.PUSH_ALLOW_LOCAL === '1' }) || endpoint.length > 1000) return badRequest('Bad push subscription.');
  if (typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh)) return badRequest('Bad push key.');
  if (typeof auth !== 'string' || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) return badRequest('Bad push secret.');
  const me = data.user.id;
  try {
    await env.DB.batch([
      // A device belongs to whoever turned notifications on last on it.
      env.DB.prepare(`INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (?, ?, ?, ?)
        ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`)
        .bind(endpoint, me, p256dh, auth),
      // Keep the newest few devices per person.
      env.DB.prepare(`DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint NOT IN
        (SELECT endpoint FROM push_subscriptions WHERE user_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT ${MAX_DEVICES})`).bind(me),
    ]);
    return json({ ok: true }, 201);
  } catch (err) {
    return serverError(err, 'push subscribe');
  }
}

// Turn notifications off for this device: { endpoint }
export async function onRequestDelete({ request, env, data }) {
  if (!data.user) return unauthorized();
  const endpoint = (await readJson(request))?.endpoint;
  if (typeof endpoint !== 'string') return badRequest('Missing endpoint.');
  try {
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(endpoint, data.user.id).run();
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'push unsubscribe');
  }
}
