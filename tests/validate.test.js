import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEntry, cleanName, cleanPrefs, isId, normalizeEmail, passwordProblem, sniffImage, MAX_PHOTO_BYTES } from '../lib/validate.js';

test('emails are trimmed, lower-cased and checked', () => {
  assert.equal(normalizeEmail('  Kitty@Example.COM '), 'kitty@example.com');
  assert.equal(normalizeEmail('not-an-email'), null);
  assert.equal(normalizeEmail(42), null);
});

test('passwords need 8 to 200 characters', () => {
  assert.ok(passwordProblem('short'));
  assert.equal(passwordProblem('long enough'), null);
  assert.ok(passwordProblem('x'.repeat(201)));
});

test('names are tidied', () => {
  assert.equal(cleanName('  Mochi   the  cat '), 'Mochi the cat');
  assert.equal(cleanName(null), '');
});

test('ids are short alphanumerics', () => {
  assert.equal(isId('lq3k2abc12'), true);
  assert.equal(isId('../etc'), false);
  assert.equal(isId(''), false);
});

const page = { id: 'abc123', date: '2026-10-27', title: 'Hi', body: 'Meow', stickers: [], updatedAt: 1761550000000 };

test('a good page passes and is stored as JSON', () => {
  const r = checkEntry('abc123', page);
  assert.equal(r.error, undefined);
  assert.equal(r.date, '2026-10-27');
  assert.equal(r.updatedAt, 1761550000000);
  assert.deepEqual(JSON.parse(r.data), page);
});

test('bad pages are refused', () => {
  assert.ok(checkEntry('abc123', { ...page, id: 'other' }).error);
  assert.ok(checkEntry('abc123', { ...page, date: 'yesterday' }).error);
  assert.ok(checkEntry('abc123', { ...page, stickers: 'x' }).error);
  assert.ok(checkEntry('abc123', null).error);
  assert.ok(checkEntry('abc123', { ...page, body: 'x'.repeat(600000) }).error);
});

test('prefs fall back to defaults', () => {
  assert.deepEqual(cleanPrefs({ defaultTheme: 'night', view: 'list' }), { defaultTheme: 'night', view: 'list' });
  assert.deepEqual(cleanPrefs({ defaultTheme: 'evil', view: 1 }), { defaultTheme: 'cat', view: 'calendar' });
});

test('image types are recognised from their bytes', () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), 'image/png');
  assert.equal(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8')), 'image/webp');
  assert.equal(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>')), null);
});

test('photo limit leaves room inside a 2 MB database row', () => {
  assert.ok(MAX_PHOTO_BYTES < 2000000);
});
