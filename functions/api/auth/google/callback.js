import { cookie, getCookie } from '../../../../lib/http.js';
import { newId, timingSafeEqual } from '../../../../lib/crypto.js';
import { GOOGLE_STATE_COOKIE, exchangeCode, googleEnabled, readIdToken, redirectUri } from '../../../../lib/google.js';
import { createSession } from '../../../../lib/session.js';
import { cleanName } from '../../../../lib/validate.js';

function redirect(request, hash, setCookies = []) {
  const headers = new Headers({ Location: `${new URL(request.url).origin}/${hash}`, 'Cache-Control': 'no-store' });
  for (const c of [cookie(GOOGLE_STATE_COOKIE, '', 0), ...setCookies]) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}

// Google sends the browser back here after sign-in.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('error')) return redirect(request, ''); // the user cancelled
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!googleEnabled(env) || !code || !state || !timingSafeEqual(state, getCookie(request, GOOGLE_STATE_COOKIE))) {
    return redirect(request, '#auth-error=google');
  }
  try {
    const idToken = await exchangeCode({ code, clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: redirectUri(request) });
    const g = readIdToken(idToken, env.GOOGLE_CLIENT_ID);
    const db = env.DB;

    let user = await db.prepare('SELECT id FROM users WHERE google_sub = ?').bind(g.sub).first();
    if (!user) {
      const byEmail = await db.prepare('SELECT id, name, email_verified FROM users WHERE email = ?').bind(g.email).first();
      if (byEmail && byEmail.email_verified) {
        await db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').bind(g.sub, byEmail.id).run();
      } else if (byEmail) {
        // Nobody ever proved they own this email, so whoever set its password could be someone else.
        // Google has now proved it: the Google user takes the account over, and the old password and sessions stop working.
        await db.batch([
          db.prepare('UPDATE users SET google_sub = ?, email_verified = 1, password_hash = NULL WHERE id = ?').bind(g.sub, byEmail.id),
          db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(byEmail.id),
        ]);
      } else {
        await db.prepare('INSERT INTO users (id, email, name, google_sub, email_verified) VALUES (?, ?, ?, ?, 1)')
          .bind(newId(), g.email, cleanName(g.name) || g.email.split('@')[0], g.sub).run();
      }
      user = await db.prepare('SELECT id FROM users WHERE google_sub = ?').bind(g.sub).first();
    }
    return redirect(request, '', [await createSession(db, user.id)]);
  } catch (err) {
    console.error('google callback', err);
    return redirect(request, '#auth-error=google');
  }
}
