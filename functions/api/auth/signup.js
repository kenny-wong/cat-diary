import { badRequest, json, readJson, serverError } from '../../../lib/http.js';
import { hashPassword, newId } from '../../../lib/crypto.js';
import { cleanName, normalizeEmail, passwordProblem } from '../../../lib/validate.js';
import { createSession } from '../../../lib/session.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  if (!email) return badRequest('Please enter a valid email address.');
  const problem = passwordProblem(body.password);
  if (problem) return badRequest(problem);
  try {
    const existing = await env.DB.prepare('SELECT password_hash FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return json({ error: existing.password_hash
        ? 'There is already an account with this email. Try logging in.'
        : 'This email already has an account that uses Google. Use "Continue with Google".' }, 409);
    }
    const user = { id: newId(), email, name: cleanName(body.name) || email.split('@')[0], hasPassword: true, hasGoogle: false };
    await env.DB.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
      .bind(user.id, email, user.name, await hashPassword(body.password)).run();
    return json({ user }, 201, { 'Set-Cookie': await createSession(env.DB, user.id) });
  } catch (err) {
    return serverError(err, 'signup');
  }
}
