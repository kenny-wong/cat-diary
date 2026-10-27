// Checks for everything the browser sends to the API.

export const MAX_PHOTO_BYTES = 1900000; // D1 rows are capped at 2,000,000 bytes
export const MAX_ENTRY_BYTES = 500000;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ID_RE = /^[a-z0-9]{1,40}$/i;

export const isId = id => typeof id === 'string' && ID_RE.test(id);

export const cleanName = name => (typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 60) : '');

// Google account emails, as typed by a friend: trimmed and lower-cased.
export function normalizeEmail(email) {
  if (typeof email !== 'string') return null;
  const e = email.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

// A diary page as stored: the browser owns its shape, the server only checks id, date, size
// and reads whether friends may see it.
export function checkEntry(id, entry) {
  if (!isId(id)) return { error: 'Bad page id.' };
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { error: 'Missing page.' };
  if (entry.id !== id) return { error: 'Page id does not match.' };
  if (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return { error: 'Bad page date.' };
  if (!Array.isArray(entry.stickers)) return { error: 'Bad stickers.' };
  const data = JSON.stringify(entry);
  if (data.length > MAX_ENTRY_BYTES) return { error: 'This page is too big to save.' };
  const updatedAt = Number.isFinite(entry.updatedAt) ? Math.round(entry.updatedAt) : Date.now();
  return { date: entry.date, updatedAt, data, shared: entry.shared === true ? 1 : 0 };
}

const THEMES = ['cat', 'sakura', 'ocean', 'forest', 'night', 'kraft'];
export function cleanPrefs(prefs) {
  const p = prefs && typeof prefs === 'object' ? prefs : {};
  return {
    defaultTheme: THEMES.includes(p.defaultTheme) ? p.defaultTheme : 'cat',
    view: p.view === 'list' ? 'list' : 'calendar',
    shareNewPages: p.shareNewPages === true,
  };
}

// Sniff the real image type from its first bytes rather than trusting the header.
export function sniffImage(bytes) {
  const b = bytes.subarray(0, 12);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}
