import { badRequest, json, serverError, unauthorized } from '../../../lib/http.js';
import { isId } from '../../../lib/validate.js';

// Delete a comment (and its replies): your own, or any comment on your own page.
export async function onRequestDelete({ env, data, params }) {
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad comment.');
  try {
    const c = await env.DB.prepare('SELECT author_id, entry_owner FROM comments WHERE id = ?').bind(params.id).first();
    if (!c) return json({ ok: true });
    if (c.author_id !== data.user.id && c.entry_owner !== data.user.id) return json({ error: "You can't delete this comment." }, 403);
    await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(params.id).run();
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'delete comment');
  }
}
