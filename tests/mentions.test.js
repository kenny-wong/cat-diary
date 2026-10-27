import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MENTIONS, findMentions, mentionChanges, mentionCounts, scanMentions } from '../lib/mentions.js';

const people = [{ id: 'k', name: 'Kenny Wong' }, { id: 'uk', name: 'Kenny Wong UK' }, { id: 'c', name: 'Chloe' }, { id: 'n', name: '' }];

test('finds whole @names in any case', () => {
  assert.deepEqual(findMentions('Played with @chloe today!', people), ['c']);
  assert.deepEqual(findMentions('@Chloe and @Kenny Wong', people), ['c', 'k']); // in the order written
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

const friends = [{ id: 'c', name: 'Chloe Wong' }, { id: 'uk', name: 'Kenny Wong UK' }, { id: 'k2', name: 'Kenny Lee' }];

test('a first name is enough when only one friend has it', () => {
  assert.deepEqual(findMentions('@Hayley, @Chloe\nTrain', friends), ['c']);
  assert.deepEqual(findMentions('thanks @chloe!', friends), ['c']);
  assert.deepEqual(findMentions('@Chloe Wong and @Chloe', friends), ['c']);
});

test('names nobody has, and first names several friends share, are reported', () => {
  const r = scanMentions('@Hayley go to Volleyball with @Kenny and @Kenny Lee, at 3@pm, mail a@b.com, @9am', friends);
  assert.deepEqual(r.ids, ['k2']);
  assert.deepEqual(r.unknown, ['Hayley']);
  assert.deepEqual(r.unclear, ['Kenny']);
});

test('spans point at the mention in the text', () => {
  const text = 'Hi @Chloe and @Kenny Wong UK!';
  const r = scanMentions(text, friends);
  assert.deepEqual(r.spans.map(({ s, e }) => text.slice(s, e)), ['@Chloe', '@Kenny Wong UK']);
});

test('a page tells on each new mention, and again after a tag is removed and added back', () => {
  let told = new Map();
  const save = text => {
    const { tell, set, drop } = mentionChanges(mentionCounts(text, friends), told);
    told = new Map([...told, ...set]);
    drop.forEach(id => told.delete(id));
    return tell;
  };
  assert.deepEqual(save('hi @Chloe Wong'), ['c']);
  assert.deepEqual(save('hi @Chloe Wong, more words'), []);
  assert.deepEqual(save('hi @Chloe Wong. Later @Chloe again'), ['c']);
  assert.deepEqual(save('hi. Later @Chloe again'), []); // one removed
  assert.deepEqual(save('hi'), []); // all removed
  assert.deepEqual(save('hi @Chloe'), ['c']); // added back
  assert.deepEqual(save('hi @Chloe and @Kenny Lee'), ['k2']);
});
