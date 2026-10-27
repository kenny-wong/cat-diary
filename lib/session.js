// Login sessions: a random token in an HttpOnly cookie, its SHA-256 in the database.
import { randomToken, sha256 } from './crypto.js';
import { cookie, getCookie, isoAt } from './http.js';

export const SESSION_COOKIE = 'sid';
const SESSION_DAYS = 30;
const DAY = 86400000;

export async function createSession(db, userId) {
  const token = randomToken();
  await db.batch([
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), userId, isoAt(SESSION_DAYS * DAY)),
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(isoAt()),
  ]);
  return cookie(SESSION_COOKIE, token, SESSION_DAYS * 86400);
}

export async function getSessionUser(db, request) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return db.prepare(
    `SELECT u.id, u.email, u.name, u.prefs, u.last_active_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?`)
    .bind(await sha256(token), isoAt()).first();
}

export async function endSession(db, request) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) await db.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
  return cookie(SESSION_COOKIE, '', 0);
}

export const publicUser = u => ({ id: u.id, email: u.email, name: u.name });
