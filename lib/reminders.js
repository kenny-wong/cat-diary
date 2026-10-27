// Daily reminders: who is due one, their writing streak, and what the notification says.
// public/app.js has its own streak() for the sidebar; keep the two in step.

export const REMIND_WINDOW = 60; // minutes after the chosen time in which a missed run can still send it

export const isTime = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export function isTimeZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// The date (YYYY-MM-DD) and minutes since midnight at `now` in a time zone.
export function localNow(now, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// The person's local date if a reminder is due now ({ remind_at, time_zone, reminded_on } from users), else null.
export function dueDate(user, now) {
  if (!isTime(user.remind_at) || !isTimeZone(user.time_zone)) return null;
  const { date, minutes } = localNow(now, user.time_zone);
  const [h, m] = user.remind_at.split(':').map(Number);
  const late = minutes - (h * 60 + m);
  return late >= 0 && late < REMIND_WINDOW && user.reminded_on !== date ? date : null;
}

const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Days in a row with at least one page, counting back from today (or from yesterday while today has none yet).
export function streak(dates, today) {
  const have = new Set(dates);
  let day = have.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (have.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export const reminderText = days => (days >= 2
  ? `🔥 You're on a ${days}-day streak! Write today's page to keep it going.`
  : "✏️ How was your day? Your diary is waiting for today's page.");
