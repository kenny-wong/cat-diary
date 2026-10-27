import { badRequest, json, readJson, serverError, tooMany } from '../../../lib/http.js';
import { verifyPassword } from '../../../lib/crypto.js';
import { normalizeEmail } from '../../../lib/validate.js';
import { createSession, recentFailures, recordFailure } from '../../../lib/session.js';

const MAX_FAILURES = 10; // per email, per 15 minutes

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  if (!email || typeof body.password !== 'string' || !body.password) return badRequest('Please enter your email and password.');
  const key = `login:${email}`;
  try {
    if (await recentFailures(env.DB, key, 15) >= MAX_FAILURES) return tooMany();
    const user = await env.DB.prepare('SELECT id, email, name, password_hash, google_sub FROM users WHERE email = ?').bind(email).first();
    if (user && !user.password_hash) {
      return json({ error: 'This account uses Google. Use "Continue with Google" to log in.' }, 401);
    }
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      await recordFailure(env.DB, key);
      return json({ error: 'Wrong email or password.' }, 401);
    }
    const setCookie = await createSession(env.DB, user.id);
    return json({ user: { id: user.id, email: user.email, name: user.name, hasPassword: true, hasGoogle: !!user.google_sub } }, 200, { 'Set-Cookie': setCookie });
  } catch (err) {
    return serverError(err, 'login');
  }
}
