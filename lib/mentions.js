// "@Name" mentions of friends, in diary pages and comments.

export const MAX_MENTIONS = 10;

const WORD_CHAR = /[\p{L}\p{N}_]/u;

// Who of `people` ({ id, name }) the text mentions. Never inside a word (so not an email address), any case.
// - "@Full Name": longest names first, so "@Kenny Wong UK" doesn't also mention "Kenny Wong".
// - "@First": a first name alone is enough when only one of the people has it.
// Returns { ids, spans: [{ s, e, id }], unknown: words nobody has, unclear: first names several people have }.
// public/app.js `scanMentions` mirrors this for highlighting; keep the two in step.
export function scanMentions(text, people) {
  const out = { ids: [], spans: [], unknown: [], unclear: [] };
  if (typeof text !== 'string' || !text.includes('@')) return out;
  const lower = text.toLowerCase();
  const free = i => !WORD_CHAR.test(lower[i - 1] || '');
  const taken = (s, e) => out.spans.some(x => s < x.e && e > x.s);
  const named = people.filter(p => p.name);
  for (const p of [...named].sort((a, b) => b.name.length - a.name.length)) {
    const needle = `@${p.name.toLowerCase()}`;
    for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + 1)) {
      const e = i + needle.length;
      if (free(i) && !WORD_CHAR.test(lower[e] || '') && !taken(i, e)) out.spans.push({ s: i, e, id: p.id });
    }
  }
  const first = p => p.name.toLowerCase().split(/\s+/)[0];
  for (const m of lower.matchAll(/@(\p{L}[\p{L}\p{N}_]*)/gu)) {
    const s = m.index;
    const e = s + m[0].length;
    if (!free(s) || taken(s, e)) continue;
    const same = named.filter(p => first(p) === m[1]);
    const word = text.slice(s + 1, e);
    if (same.length === 1) out.spans.push({ s, e, id: same[0].id });
    else if (!(same.length ? out.unclear : out.unknown).includes(word)) (same.length ? out.unclear : out.unknown).push(word);
  }
  out.spans.sort((a, b) => a.s - b.s);
  for (const { id } of out.spans) if (!out.ids.includes(id)) out.ids.push(id);
  out.ids = out.ids.slice(0, MAX_MENTIONS);
  return out;
}

export const findMentions = (text, people) => scanMentions(text, people).ids;

// How many times the text mentions each of `people`: Map id -> count.
export function mentionCounts(text, people) {
  const counts = new Map();
  for (const { id } of scanMentions(text, people).spans) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

// After saving a shared page: `counts` is how often it mentions each friend now, `told` how often it did at
// the last shared save (Map id -> times). Friends mentioned more often than before are told (so removing a
// tag and adding it back tells them again); `set` / `drop` bring the stored counts up to date.
export function mentionChanges(counts, told) {
  const tell = [...counts].filter(([id, n]) => n > (told.get(id) || 0)).map(([id]) => id).slice(0, MAX_MENTIONS);
  const set = [...counts].filter(([id, n]) => n !== told.get(id));
  const drop = [...told.keys()].filter(id => !counts.has(id));
  return { tell, set, drop };
}

// Everyone `userId` can mention: their friends.
export async function mentionable(db, userId) {
  const { results } = await db.prepare('SELECT u.id, u.name FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ?')
    .bind(userId).all();
  return results;
}
