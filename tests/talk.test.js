import test from 'node:test';
import assert from 'node:assert/strict';
import { REACTIONS, cleanComment, commentRecipients } from '../lib/talk.js';

test('comments are trimmed, capped and never empty', () => {
  assert.equal(cleanComment('  so cute!  '), 'so cute!');
  assert.equal(cleanComment('   \n  '), null);
  assert.equal(cleanComment(42), null);
  assert.equal(cleanComment('a\r\n\r\n\r\n\r\nb'), 'a\n\nb');
  assert.equal(cleanComment('x'.repeat(1500)).length, 1000);
});

test('a comment on a friend page notifies the owner', () => {
  assert.deepEqual([...commentRecipients({ me: 'a', owner: 'b' })], [['b', 'comment']]);
});

test('commenting on your own page notifies nobody', () => {
  assert.deepEqual([...commentRecipients({ me: 'a', owner: 'a' })], []);
});

test('a reply notifies the person replied to and the owner, once each', () => {
  assert.deepEqual(new Map(commentRecipients({ me: 'a', owner: 'b', parentAuthor: 'c' })), new Map([['b', 'comment'], ['c', 'reply']]));
  // the owner replying to a friend's comment on their own page
  assert.deepEqual([...commentRecipients({ me: 'b', owner: 'b', parentAuthor: 'c' })], [['c', 'reply']]);
  // replying to the owner's own comment: the owner hears it as a reply, not twice
  assert.deepEqual([...commentRecipients({ me: 'a', owner: 'b', parentAuthor: 'b' })], [['b', 'reply']]);
  // replying to yourself
  assert.deepEqual([...commentRecipients({ me: 'a', owner: 'b', parentAuthor: 'a' })], [['b', 'comment']]);
});

test('reaction emoji are a fixed set', () => {
  assert.equal(REACTIONS.length, 8);
  assert.ok(REACTIONS.includes('❤️'));
});
