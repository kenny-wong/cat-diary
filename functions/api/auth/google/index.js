import { cookie } from '../../../../lib/http.js';
import { randomToken } from '../../../../lib/crypto.js';
import { GOOGLE_STATE_COOKIE, googleAuthUrl, googleEnabled, redirectUri } from '../../../../lib/google.js';

// Sends the browser to Google's sign-in page.
export function onRequestGet({ request, env }) {
  if (!googleEnabled(env)) return Response.redirect(`${new URL(request.url).origin}/#auth-error=google-off`, 302);
  const state = randomToken(24);
  return new Response(null, {
    status: 302,
    headers: {
      Location: googleAuthUrl({ clientId: env.GOOGLE_CLIENT_ID, redirectUri: redirectUri(request), state }),
      'Set-Cookie': cookie(GOOGLE_STATE_COOKIE, state, 600),
      'Cache-Control': 'no-store',
    },
  });
}
