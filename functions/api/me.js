import { badRequest, json, readJson, serverError, unauthorized } from '../../lib/http.js';
import { googleEnabled } from '../../lib/google.js';
import { publicUser } from '../../lib/session.js';
import { cleanName } from '../../lib/validate.js';

// Who is logged in (or null), and whether Google sign-in is switched on.
export function onRequestGet({ env, data }) {
  return json({
    user: data.user ? publicUser(data.user) : null,
    google: googleEnabled(env),
  });
}

// Change your display name. Google only sets it on the first sign-in, so a change here stays.
export async function onRequestPut({ request, env, data }) {
  if (!data.user) return unauthorized();
  const name = cleanName((await readJson(request))?.name);
  if (!name) return badRequest('Please enter a name.');
  try {
    await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, data.user.id).run();
    return json({ user: publicUser({ ...data.user, name }) });
  } catch (err) {
    return serverError(err, 'change name');
  }
}
