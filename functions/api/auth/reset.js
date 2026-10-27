import { badRequest, isoAt, json, readJson, serverError } from '../../../lib/http.js';
import { hashPassword, sha256 } from '../../../lib/crypto.js';
import { passwordProblem } from '../../../lib/validate.js';
import { createSession } from '../../../lib/session.js';

// Sets a new password from an emailed reset link, logs out every other device, and logs this one in.
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (typeof body?.token !== 'string' || !body.token) return badRequest('This reset link is not valid.');
  const problem = passwordProblem(body.password);
  if (problem) return badRequest(problem);
  try {
    const reset = await env.DB.prepare('SELECT user_id FROM password_resets WHERE id = ? AND expires_at > ?')
      .bind(await sha256(body.token), isoAt()).first();
    if (!reset) return badRequest('This reset link has expired or was already used. Please ask for a new one.');
    const userId = reset.user_id;
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?').bind(await hashPassword(body.password), userId),
      env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    ]);
    return json({ ok: true }, 200, { 'Set-Cookie': await createSession(env.DB, userId) });
  } catch (err) {
    return serverError(err, 'reset');
  }
}
