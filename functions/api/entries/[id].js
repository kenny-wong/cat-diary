import { badRequest, isoAt, json, readJson, serverError, unauthorized } from '../../../lib/http.js';
import { newId } from '../../../lib/crypto.js';
import { checkEntry, isId } from '../../../lib/validate.js';
import { findMentions, mentionable } from '../../../lib/mentions.js';
import { pageLabel, pushNote } from '../../../lib/push.js';

// Friends mentioned as "@Name" on a shared page are told, once per page. Resolves to their names.
async function tellMentioned(context, me, entryId, entry) {
  const db = context.env.DB;
  const str = v => (typeof v === 'string' ? v : '');
  const text = `${str(entry.title)}
${str(entry.body)}`;
  if (!text.includes('@')) return [];
  const friends = await mentionable(db, me.id);
  const ids = findMentions(text, friends);
  if (!ids.length) return [];
  const told = new Set((await db.prepare('SELECT user_id FROM page_mentions WHERE entry_owner = ? AND entry_id = ?')
    .bind(me.id, entryId).all()).results.map(r => r.user_id));
  const fresh = friends.filter(f => ids.includes(f.id) && !told.has(f.id)).map(f => ({ ...f, noteId: newId() }));
  if (!fresh.length) return [];
  await db.batch(fresh.flatMap(f => [
    db.prepare('INSERT OR IGNORE INTO page_mentions (entry_owner, entry_id, user_id) VALUES (?, ?, ?)').bind(me.id, entryId, f.id),
    db.prepare("INSERT INTO notifications (id, user_id, actor_id, kind, entry_owner, entry_id, created_at) VALUES (?, ?, ?, 'tag', ?, ?, ?)")
      .bind(f.noteId, f.id, me.id, me.id, entryId, isoAt()),
  ]));
  for (const f of fresh) pushNote(context, f.id, f.noteId, `${me.name} mentioned you on their page${pageLabel(str(entry.title))}`);
  return fresh.map(f => f.name);
}

// Save one diary page (create or replace). Answers with the friends just told they were mentioned.
export async function onRequestPut(context) {
  const { request, env, data, params } = context;
  if (!data.user) return unauthorized();
  const entry = await readJson(request);
  const checked = checkEntry(params.id, entry);
  if (checked.error) return badRequest(checked.error);
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO entries (user_id, id, date, data, updated_at, shared) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, id) DO UPDATE SET date = excluded.date, data = excluded.data, updated_at = excluded.updated_at, shared = excluded.shared`)
        .bind(data.user.id, params.id, checked.date, checked.data, checked.updatedAt, checked.shared),
      // Any saved page, private or shared, counts as writing (friends see when, never what).
      env.DB.prepare('UPDATE users SET last_wrote_at = ? WHERE id = ?').bind(isoAt(), data.user.id),
    ]);
  } catch (err) {
    return serverError(err, 'save page');
  }
  // Only shared pages: a friend can't open a private one. Sharing it later tells them then.
  let mentioned = [];
  if (checked.shared) {
    try {
      mentioned = await tellMentioned(context, data.user, params.id, entry);
    } catch (err) {
      console.error('page mentions', err); // the page itself is saved
    }
  }
  return json({ ok: true, mentioned });
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
      env.DB.prepare('DELETE FROM page_mentions WHERE entry_owner = ? AND entry_id = ?').bind(...page),
    ]);
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'delete page');
  }
}
