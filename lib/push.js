// Web Push: encrypt a message for one browser (RFC 8291, aes128gcm) and sign the request with
// the site's VAPID key (RFC 8292). Plain Web Crypto, so it runs in Workers and in Node tests.

const enc = new TextEncoder();

export const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// Encrypt `payload` (a string) for a subscription's keys ({ p256dh, auth }, base64url).
// salt and serverKeys may be passed in for tests; normally they are random per message.
export async function encryptPayload(payload, keys, { salt = crypto.getRandomValues(new Uint8Array(16)), serverKeys } = {}) {
  const uaPublic = unb64url(keys.p256dh);
  const authSecret = unb64url(keys.auth);
  const server = serverKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', server.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, server.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const plain = concat(enc.encode(payload), new Uint8Array([2])); // 2 marks the last (only) record
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain));

  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096); // record size
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

// "vapid t=<signed JWT>, k=<public key>" for one push service.
export async function vapidAuth(endpoint, { publicKey, privateJwk, subject }, nowSeconds = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = obj => b64url(enc.encode(JSON.stringify(obj)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 3600, sub: subject })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned));
  return `vapid t=${unsigned}.${b64url(sig)}, k=${publicKey}`;
}

// Only real browser push services may be stored as endpoints, so the server never posts anywhere else.
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
export function isPushEndpoint(endpoint, { allowLocal = false } = {}) {
  try {
    const u = new URL(endpoint);
    if (allowLocal && u.protocol === 'http:' && u.hostname === 'localhost') return true;
    return u.protocol === 'https:' && PUSH_HOSTS.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export const pushEnabled = env => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

// Push a just-created notification to the person's devices, after the response is sent.
// Tapping it opens the diary at that notification (/#note=<id>).
export function pushNote(context, userId, noteId, text) {
  context.waitUntil(sendPush(context.env, userId, { title: 'My Little Diary', body: text, tag: noteId, url: `/#note=${noteId}` }));
}

export const snippet = (text, max = 100) => (text.length > max ? `${text.slice(0, max)}…` : text);
export const pageLabel = title => (title ? `“${title}”` : 'a page');

// Send one message to every device a user turned notifications on for. Devices whose
// subscription has ended (404/410) are forgotten. Never throws.
export async function sendPush(env, userId, message) {
  if (!pushEnabled(env)) return;
  try {
    const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').bind(userId).all();
    const vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateJwk: JSON.parse(env.VAPID_PRIVATE_KEY), subject: env.VAPID_SUBJECT || 'https://my-little-diary.pages.dev' };
    const body = JSON.stringify(message);
    await Promise.all(results.map(async sub => {
      try {
        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            Authorization: await vapidAuth(sub.endpoint, vapid),
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: '86400',
            Urgency: 'normal',
          },
          body: await encryptPayload(body, sub),
        });
        if (res.status === 404 || res.status === 410) {
          await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
        } else if (!res.ok) {
          console.error('push failed', res.status, await res.text());
        }
      } catch (err) {
        console.error('push error', err);
      }
    }));
  } catch (err) {
    console.error('push', err);
  }
}
