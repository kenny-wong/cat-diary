import { badRequest, json, readJson, serverError, unauthorized } from '../../../lib/http.js';
import { checkEntry, isId } from '../../../lib/validate.js';

// Save one diary page (create or replace).
export async function onRequestPut({ request, env, data, params }) {
  if (!data.user) return unauthorized();
  const checked = checkEntry(params.id, await readJson(request));
  if (checked.error) return badRequest(checked.error);
  try {
    await env.DB.prepare(
      `INSERT INTO entries (user_id, id, date, data, updated_at, shared) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, id) DO UPDATE SET date = excluded.date, data = excluded.data, updated_at = excluded.updated_at, shared = excluded.shared`)
      .bind(data.user.id, params.id, checked.date, checked.data, checked.updatedAt, checked.shared).run();
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'save page');
  }
}

export async function onRequestDelete({ env, data, params }) {
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad page id.');
  try {
    // A torn-out page takes its comments, reactions and notifications with it.
    const page = [data.user.id, params.id];
    await env.DB.batch([
      env.DB.prepare('DELETE FROM entries WHERE user_id = ? AND id = ?').bind(...page),
      env.DB.prepare('DELETE FROM comments WHERE entry_owner = ? AND entry_id = ?').bind(...page),
      env.DB.prepare('DELETE FROM reactions WHERE entry_owner = ? AND entry_id = ?').bind(...page),
      env.DB.prepare('DELETE FROM notifications WHERE entry_owner = ? AND entry_id = ?').bind(...page),
    ]);
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'delete page');
  }
}
