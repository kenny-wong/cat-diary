import { cookie, getCookie } from '../../../../lib/http.js';
import { newId, timingSafeEqual } from '../../../../lib/crypto.js';
import { GOOGLE_STATE_COOKIE, exchangeCode, googleEnabled, readIdToken, redirectUri } from '../../../../lib/google.js';
import { createSession } from '../../../../lib/session.js';
import { friendNote } from '../../../../lib/friends.js';
import { cleanName } from '../../../../lib/validate.js';

function redirect(request, hash, setCookies = []) {
  const headers = new Headers({ Location: `${new URL(request.url).origin}/${hash}`, 'Cache-Control': 'no-store' });
  for (const c of [cookie(GOOGLE_STATE_COOKIE, '', 0), ...setCookies]) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}

// Google sends the browser back here after sign-in. A first sign-in creates the diary.
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
    if (user) {
      // Follow Google email changes, unless another diary already uses that address.
      await db.prepare('UPDATE users SET email = ?1 WHERE id = ?2 AND NOT EXISTS (SELECT 1 FROM users WHERE email = ?1 AND id != ?2)')
        .bind(g.email, user.id).run();
    } else {
      // A different Google account already has this email (Google lets addresses be reused): don't hand that diary over.
      if (await db.prepare('SELECT 1 FROM users WHERE email = ?').bind(g.email).first()) return redirect(request, '#auth-error=taken');
      user = { id: newId() };
      await db.prepare('INSERT INTO users (id, email, name, google_sub) VALUES (?, ?, ?, ?)')
        .bind(user.id, g.email, cleanName(g.name) || g.email.split('@')[0], g.sub).run();
      // Friend requests sent before this person had a diary: tell them now.
      const { results: waiting } = await db.prepare('SELECT DISTINCT from_user FROM friend_requests WHERE to_email = ?').bind(g.email).all();
      if (waiting.length) await db.batch(waiting.map(r => friendNote(db, user.id, r.from_user, 'friend_request')));
    }
    return redirect(request, '', [await createSession(db, user.id)]);
  } catch (err) {
    console.error('google callback', err);
    return redirect(request, '#auth-error=google');
  }
}
