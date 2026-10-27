import { badRequest, json, readJson, serverError, unauthorized } from '../../lib/http.js';
import { cleanPrefs } from '../../lib/validate.js';

export async function onRequestPut({ request, env, data }) {
  if (!data.user) return unauthorized();
  const body = await readJson(request);
  if (!body) return badRequest('Missing settings.');
  try {
    const prefs = cleanPrefs(body);
    await env.DB.prepare('UPDATE users SET prefs = ? WHERE id = ?').bind(JSON.stringify(prefs), data.user.id).run();
    return json({ prefs });
  } catch (err) {
    return serverError(err, 'save prefs');
  }
}
