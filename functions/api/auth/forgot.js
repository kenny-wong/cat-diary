import { badRequest, isoAt, json, readJson, serverError, tooMany } from '../../../lib/http.js';
import { randomToken, sha256 } from '../../../lib/crypto.js';
import { normalizeEmail } from '../../../lib/validate.js';
import { mailEnabled, resetEmail, sendMail } from '../../../lib/mail.js';
import { recentFailures, recordFailure } from '../../../lib/session.js';

const MAX_PER_HOUR = 3;

// Always answers the same way, so it can't be used to find out who has an account.
export async function onRequestPost({ request, env }) {
  if (!mailEnabled(env)) return json({ error: 'Password reset by email is not set up yet.' }, 503);
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  if (!email) return badRequest('Please enter a valid email address.');
  const key = `forgot:${email}`;
  try {
    if (await recentFailures(env.DB, key, 60) >= MAX_PER_HOUR) return tooMany();
    await recordFailure(env.DB, key);
    const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (user) {
      const token = randomToken();
      await env.DB.prepare('INSERT INTO password_resets (id, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(await sha256(token), user.id, isoAt(3600000)).run();
      try {
        await sendMail(env, email, resetEmail(`${new URL(request.url).origin}/#reset=${token}`));
      } catch (err) {
        console.error('reset email', err);
      }
    }
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'forgot');
  }
}
