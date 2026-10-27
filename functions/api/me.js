import { json } from '../../lib/http.js';
import { googleEnabled } from '../../lib/google.js';
import { mailEnabled } from '../../lib/mail.js';
import { publicUser } from '../../lib/session.js';

// Who is logged in (or null), plus which login options are switched on.
export function onRequestGet({ env, data }) {
  return json({
    user: data.user ? publicUser(data.user) : null,
    google: googleEnabled(env),
    reset: mailEnabled(env),
  });
}
