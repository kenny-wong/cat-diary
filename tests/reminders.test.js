import test from 'node:test';
import assert from 'node:assert/strict';
import { dueDate, isTime, isTimeZone, localNow, reminderText, streak } from '../lib/reminders.js';

test('reminder times are HH:MM on a 24-hour clock', () => {
  for (const ok of ['00:00', '07:30', '19:45', '23:59']) assert.ok(isTime(ok), ok);
  for (const bad of ['24:00', '7:30', '19:60', '', null, 1930, '19:30:00']) assert.ok(!isTime(bad), String(bad));
});

test('time zones must be real IANA names', () => {
  assert.ok(isTimeZone('Europe/London'));
  assert.ok(isTimeZone('Asia/Hong_Kong'));
  assert.ok(!isTimeZone('Mars/Olympus'));
  assert.ok(!isTimeZone(''));
  assert.ok(!isTimeZone(undefined));
  assert.ok(!isTimeZone('x'.repeat(65)));
});

test('local date and time follow the time zone, including summer time', () => {
  const now = new Date('2026-07-01T23:30:00Z');
  assert.deepEqual(localNow(now, 'Europe/London'), { date: '2026-07-02', minutes: 30 }); // BST
  assert.deepEqual(localNow(now, 'America/New_York'), { date: '2026-07-01', minutes: 19 * 60 + 30 });
  assert.deepEqual(localNow(new Date('2026-12-01T00:00:00Z'), 'Europe/London'), { date: '2026-12-01', minutes: 0 });
});

test('a reminder is due from its time for an hour, once a day', () => {
  const user = { remind_at: '19:30', time_zone: 'Europe/London', reminded_on: null };
  const at = iso => new Date(iso);
  assert.equal(dueDate(user, at('2026-12-01T19:29:00Z')), null);
  assert.equal(dueDate(user, at('2026-12-01T19:30:00Z')), '2026-12-01');
  assert.equal(dueDate(user, at('2026-12-01T20:29:00Z')), '2026-12-01');
  assert.equal(dueDate(user, at('2026-12-01T20:30:00Z')), null);
  assert.equal(dueDate({ ...user, reminded_on: '2026-12-01' }, at('2026-12-01T19:45:00Z')), null);
  assert.equal(dueDate({ ...user, reminded_on: '2026-11-30' }, at('2026-12-01T19:45:00Z')), '2026-12-01');
  assert.equal(dueDate({ ...user, remind_at: null }, at('2026-12-01T19:45:00Z')), null);
  assert.equal(dueDate({ ...user, time_zone: 'Nowhere/Land' }, at('2026-12-01T19:45:00Z')), null);
});

test('streaks count days in a row back from today, or from yesterday before today is written', () => {
  assert.equal(streak([], '2026-10-27'), 0);
  assert.equal(streak(['2026-10-27'], '2026-10-27'), 1);
  assert.equal(streak(['2026-10-25', '2026-10-26', '2026-10-27'], '2026-10-27'), 3);
  assert.equal(streak(['2026-10-25', '2026-10-26'], '2026-10-27'), 2);
  assert.equal(streak(['2026-10-24', '2026-10-25'], '2026-10-27'), 0);
  assert.equal(streak(['2026-10-27', '2026-10-27', '2026-10-25'], '2026-10-27'), 1);
  assert.equal(streak(['2026-02-28', '2026-03-01'], '2026-03-01'), 2); // across a month end
  assert.equal(streak(['2026-12-31', '2027-01-01'], '2027-01-02'), 2); // across a year end
});

test('the reminder mentions a streak worth keeping', () => {
  assert.match(reminderText(5), /5-day streak/);
  assert.doesNotMatch(reminderText(1), /streak/);
  assert.doesNotMatch(reminderText(0), /streak/);
});
