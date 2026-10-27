import { json, serverError } from '../../../lib/http.js';
import { timingSafeEqual } from '../../../lib/crypto.js';
import { sendPush } from '../../../lib/push.js';
import { dueDate, reminderText, streak } from '../../../lib/reminders.js';

// Called every 15 minutes by the my-little-diary-cron Worker (cron/), with the shared CRON_SECRET.
// Everyone whose reminder time has come and who has no page for today yet gets a push.
export async function onRequestPost({ request, env }) {
  if (!env.CRON_SECRET || !timingSafeEqual(request.headers.get('Authorization') || '', `Bearer ${env.CRON_SECRET}`)) {
    return json({ error: 'Not found.' }, 404);
  }
  const now = new Date();
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, remind_at, time_zone, reminded_on FROM users
       WHERE remind_at IS NOT NULL AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = users.id)`).all();
    let sent = 0;
    for (const user of results) {
      const today = dueDate(user, now);
      if (!today) continue;
      await env.DB.prepare('UPDATE users SET reminded_on = ? WHERE id = ?').bind(today, user.id).run();
      const { results: days } = await env.DB.prepare(
        'SELECT DISTINCT date FROM entries WHERE user_id = ? AND date <= ? ORDER BY date DESC LIMIT 400').bind(user.id, today).all();
      const dates = days.map(d => d.date);
      if (dates[0] === today) continue; // already wrote today
      await sendPush(env, user.id, { title: 'My Little Diary', body: reminderText(streak(dates, today)), tag: 'reminder', url: '/' });
      sent++;
    }
    return json({ checked: results.length, sent });
  } catch (err) {
    return serverError(err, 'reminders');
  }
}
