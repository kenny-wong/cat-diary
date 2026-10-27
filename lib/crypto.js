// Password hashing and random tokens, using Web Crypto (works in Workers and Node).

// Workers cap PBKDF2 at 100,000 iterations.
const ITERATIONS = 100000;
const enc = new TextEncoder();

const toB64 = bytes => btoa(String.fromCharCode(...bytes));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export function randomToken(bytes = 32) {
  return toB64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const newId = () => randomToken(12);

export async function sha256(text) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
  return [...digest].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16)), iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(bits)}`;
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, stored) {
  const [kind, iterations, salt] = String(stored || '').split('$');
  if (kind !== 'pbkdf2' || !salt) return false;
  try {
    return timingSafeEqual(await hashPassword(password, fromB64(salt), Number(iterations)), stored);
  } catch {
    return false;
  }
}
