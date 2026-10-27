import { json, serverError } from '../../../lib/http.js';
import { endSession } from '../../../lib/session.js';

export async function onRequestPost({ request, env }) {
  try {
    return json({ ok: true }, 200, { 'Set-Cookie': await endSession(env.DB, request) });
  } catch (err) {
    return serverError(err, 'logout');
  }
}
