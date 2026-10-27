// "@Name" mentions of friends, in diary pages and comments.

export const MAX_MENTIONS = 10;

const WORD_CHAR = /[\p{L}\p{N}_]/u;

// Which of `people` ({ id, name }) the text mentions as "@Name": whole name, any case, and not inside
// a word (so not an email address). Longer names are matched first and used up, so "@Kenny Wong UK"
// doesn't also mention "Kenny Wong".
export function findMentions(text, people) {
  if (typeof text !== 'string' || !text.includes('@')) return [];
  let rest = text.toLowerCase();
  const found = [];
  const named = people.filter(p => p.name).sort((a, b) => b.name.length - a.name.length);
  for (const p of named) {
    const needle = `@${p.name.toLowerCase()}`;
    let hit = false;
    for (let i = rest.indexOf(needle); i !== -1; i = rest.indexOf(needle, i + 1)) {
      const before = rest[i - 1], after = rest[i + needle.length];
      if ((before && WORD_CHAR.test(before)) || (after && WORD_CHAR.test(after))) continue;
      hit = true;
      rest = rest.slice(0, i) + ' '.repeat(needle.length) + rest.slice(i + needle.length);
    }
    if (hit && !found.includes(p.id)) found.push(p.id);
  }
  return found.slice(0, MAX_MENTIONS);
}

// Everyone `userId` can mention: their friends.
export async function mentionable(db, userId) {
  const { results } = await db.prepare('SELECT u.id, u.name FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ?')
    .bind(userId).all();
  return results;
}
