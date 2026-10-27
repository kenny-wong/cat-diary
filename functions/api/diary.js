import { json, serverError, unauthorized } from '../../lib/http.js';
import { cleanPrefs } from '../../lib/validate.js';

// Every page of the logged-in user's diary, plus their settings.
export async function onRequestGet({ env, data }) {
  if (!data.user) return unauthorized();
  try {
    const { results } = await env.DB.prepare('SELECT data FROM entries WHERE user_id = ?').bind(data.user.id).all();
    let prefs = {};
    try { prefs = JSON.parse(data.user.prefs); } catch { /* defaults below */ }
    return json({ entries: results.map(r => JSON.parse(r.data)), prefs: cleanPrefs(prefs) });
  } catch (err) {
    return serverError(err, 'load diary');
  }
}
