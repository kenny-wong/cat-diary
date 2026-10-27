import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, randomToken, sha256, timingSafeEqual } from '../lib/crypto.js';

test('a hashed password verifies, a wrong one does not', async () => {
  const stored = await hashPassword('purr-purr-123');
  assert.match(stored, /^pbkdf2\$100000\$/);
  assert.equal(await verifyPassword('purr-purr-123', stored), true);
  assert.equal(await verifyPassword('purr-purr-124', stored), false);
});

test('the same password hashes differently each time (random salt)', async () => {
  assert.notEqual(await hashPassword('same-password'), await hashPassword('same-password'));
});

test('verifyPassword rejects missing or malformed hashes', async () => {
  assert.equal(await verifyPassword('x', null), false);
  assert.equal(await verifyPassword('x', 'plain-text'), false);
  assert.equal(await verifyPassword('x', 'pbkdf2$100000$!!!$abc'), false);
});

test('tokens are url-safe and unique', () => {
  const a = randomToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, randomToken());
});

test('sha256 gives hex', async () => {
  assert.equal(await sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('timingSafeEqual', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true);
  assert.equal(timingSafeEqual('abc', 'abd'), false);
  assert.equal(timingSafeEqual('abc', null), false);
});
