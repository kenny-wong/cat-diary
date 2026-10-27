import { json } from '../../lib/http.js';
import { googleEnabled } from '../../lib/google.js';
import { publicUser } from '../../lib/session.js';

// Who is logged in (or null), and whether Google sign-in is switched on.
export function onRequestGet({ env, data }) {
  return json({
    user: data.user ? publicUser(data.user) : null,
    google: googleEnabled(env),
  });
}
