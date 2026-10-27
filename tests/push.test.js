import test from 'node:test';
import assert from 'node:assert/strict';
import { b64url, encryptPayload, isPushEndpoint, unb64url, vapidAuth } from '../lib/push.js';

const enc = new TextEncoder();
const subtle = crypto.subtle;

async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// What the browser does with a push message (RFC 8291), written independently of lib/push.js.
async function browserDecrypt(body, uaKeys, uaPublic, authSecret) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const asKey = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, uaKeys.privateKey, 256));
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(authSecret, shared, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, cipher));
  assert.equal(plain[plain.length - 1], 2, 'last-record delimiter');
  return { rs, idlen, text: new TextDecoder().decode(plain.slice(0, -1)) };
}

async function newBrowser() {
  const uaKeys = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPublic = new Uint8Array(await subtle.exportKey('raw', uaKeys.publicKey));
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return { uaKeys, uaPublic, authSecret, keys: { p256dh: b64url(uaPublic), auth: b64url(authSecret) } };
}

test('base64url round trip', () => {
  for (const n of [0, 1, 2, 3, 16, 65]) {
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    assert.deepEqual(unb64url(b64url(bytes)), bytes);
  }
});

test('a push message decrypts in the browser to the same text', async () => {
  const b = await newBrowser();
  const message = JSON.stringify({ title: 'My Little Diary', body: 'Bea commented on your page “Beach day” 🐚' });
  const body = await encryptPayload(message, b.keys);
  const out = await browserDecrypt(body, b.uaKeys, b.uaPublic, b.authSecret);
  assert.equal(out.text, message);
  assert.equal(out.rs, 4096);
  assert.equal(out.idlen, 65);
});

test('each message uses a fresh key and salt', async () => {
  const b = await newBrowser();
  const one = await encryptPayload('hi', b.keys);
  const two = await encryptPayload('hi', b.keys);
  assert.notDeepEqual(one, two);
});

test('another browser cannot read the message', async () => {
  const b = await newBrowser();
  const other = await newBrowser();
  const body = await encryptPayload('secret', b.keys);
  await assert.rejects(browserDecrypt(body, other.uaKeys, b.uaPublic, b.authSecret));
});

test('VAPID header carries a valid ES256 token for the push service', async () => {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = b64url(await subtle.exportKey('raw', pair.publicKey));
  const privateJwk = await subtle.exportKey('jwk', pair.privateKey);
  const header = await vapidAuth('https://fcm.googleapis.com/fcm/send/abc', { publicKey, privateJwk, subject: 'https://my-little-diary.pages.dev' }, 1000);
  const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, publicKey);
  const [h, c, s] = token.split('.');
  const claims = JSON.parse(new TextDecoder().decode(unb64url(c)));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(unb64url(h))), { typ: 'JWT', alg: 'ES256' });
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.exp, 1000 + 12 * 3600);
  assert.equal(claims.sub, 'https://my-little-diary.pages.dev');
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, unb64url(s), enc.encode(`${h}.${c}`));
  assert.equal(ok, true);
});

test('only real push services are accepted as endpoints', () => {
  assert.equal(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'), true);
  assert.equal(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'), true);
  assert.equal(isPushEndpoint('https://web.push.apple.com/abc'), true);
  assert.equal(isPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=abc'), true);
  assert.equal(isPushEndpoint('https://evil.example/fcm.googleapis.com'), false);
  assert.equal(isPushEndpoint('https://fcm.googleapis.com.evil.example/x'), false);
  assert.equal(isPushEndpoint('http://fcm.googleapis.com/x'), false);
  assert.equal(isPushEndpoint('http://localhost:9999/x'), false);
  assert.equal(isPushEndpoint('http://localhost:9999/x', { allowLocal: true }), true);
  assert.equal(isPushEndpoint('not a url'), false);
});
