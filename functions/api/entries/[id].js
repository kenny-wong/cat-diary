import { badRequest, isoAt, json, readJson, serverError, unauthorized } from '../../../lib/http.js';
import { newId } from '../../../lib/crypto.js';
import { checkEntry, isId } from '../../../lib/validate.js';
import { mentionChanges, mentionCounts, mentionable } from '../../../lib/mentions.js';
import { pageLabel, pushNote } from '../../../lib/push.js';

// A shared page tells the friends it mentions as "@Name": whenever it mentions someone more often than at its
// last shared save. Re-saving the same text tells nobody; removing a tag and adding it back tells them again.
// Private saves aren't counted, so mentions written while private are told once the page is shared.
// Resolves to the names of those just told.
async function tellMentioned(context, me, entryId, entry) {
  const db = context.env.DB;
  const page = [me.id, entryId];
  const str = v => (typeof v === 'string' ? v : '');
  const text = `${str(entry.title)}
${str(entry.body)}`;
  if (!text.includes('@')) {
    await db.prepare('DELETE FROM page_mentions WHERE entry_owner = ? AND entry_id = ?').bind(...page).run();
    return [];
  }
  const friends = await mentionable(db, me.id);
  const counts = mentionCounts(text, friends);
  const told = new Map((await db.prepare('SELECT user_id, times FROM page_mentions WHERE entry_owner = ? AND entry_id = ?')
    .bind(...page).all()).results.map(r => [r.user_id, r.times]));
  const { tell, set, drop } = mentionChanges(counts, told);
  const fresh = friends.filter(f => tell.includes(f.id)).map(f => ({ ...f, noteId: newId() }));
  const steps = [
    ...set.map(([id, n]) => db.prepare(`INSERT INTO page_mentions (entry_owner, entry_id, user_id, times) VALUES (?, ?, ?, ?)
      ON CONFLICT (entry_owner, entry_id, user_id) DO UPDATE SET times = excluded.times`).bind(...page, id, n)),
    ...drop.map(id => db.prepare('DELETE FROM page_mentions WHERE entry_owner = ? AND entry_id = ? AND user_id = ?').bind(...page, id)),
    ...fresh.map(f => db.prepare("INSERT INTO notifications (id, user_id, actor_id, kind, entry_owner, entry_id, created_at) VALUES (?, ?, ?, 'tag', ?, ?, ?)")
      .bind(f.noteId, f.id, me.id, me.id, entryId, isoAt())),
  ];
  if (steps.length) await db.batch(steps);
  if (!fresh.length) return [];
  const where = str(entry.title) ? `the page${pageLabel(str(entry.title))}` : 'a page';
  for (const f of fresh) pushNote(context, f.id, f.noteId, `${me.name} has mentioned you on ${where}`);
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
