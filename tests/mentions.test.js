import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MENTIONS, findMentions } from '../lib/mentions.js';

const people = [{ id: 'k', name: 'Kenny Wong' }, { id: 'uk', name: 'Kenny Wong UK' }, { id: 'c', name: 'Chloe' }, { id: 'n', name: '' }];

test('finds whole @names in any case', () => {
  assert.deepEqual(findMentions('Played with @chloe today!', people), ['c']);
  assert.deepEqual(findMentions('@Chloe and @Kenny Wong', people), ['k', 'c']);
  assert.deepEqual(findMentions('no mentions here', people), []);
  assert.deepEqual(findMentions(null, people), []);
});

test('a name must end where the word ends', () => {
  assert.deepEqual(findMentions('@Chloes', people), []);
  assert.deepEqual(findMentions('@Chloe_x', people), []);
  assert.deepEqual(findMentions('(@Chloe)', people), ['c']);
});

test('longer names win and are used up', () => {
  assert.deepEqual(findMentions('hi @Kenny Wong UK', people), ['uk']);
  assert.deepEqual(findMentions('@Kenny Wong UK and @Kenny Wong', people), ['uk', 'k']);
});

test('someone mentioned twice counts once; no more than the cap', () => {
  assert.deepEqual(findMentions('@Chloe @Chloe', people), ['c']);
  const many = Array.from({ length: 15 }, (_, i) => ({ id: `p${i}`, name: `Friend ${String.fromCharCode(65 + i)}` }));
  assert.equal(findMentions(many.map(p => `@${p.name}`).join(' '), many).length, MAX_MENTIONS);
});

test('an email address is not a mention of its domain', () => {
  assert.deepEqual(findMentions('mail me at kenny@Chloe', people), []);
  assert.deepEqual(findMentions('mail kenny@Chloe, thanks @Chloe', people), ['c']);
});
