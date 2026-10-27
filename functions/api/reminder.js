import { badRequest, json, readJson, serverError, unauthorized } from '../../lib/http.js';
import { isTime, isTimeZone } from '../../lib/reminders.js';

// Daily reminder on or off: { time: 'HH:MM' | null, timeZone }. It goes to every device with notifications on.
export async function onRequestPut({ request, env, data }) {
  if (!data.user) return unauthorized();
  const body = await readJson(request);
  const time = body?.time ?? null;
  if (time !== null && !isTime(time)) return badRequest('Please pick a time.');
  if (time !== null && !isTimeZone(body.timeZone)) return badRequest('Unknown time zone.');
  try {
    await env.DB.prepare('UPDATE users SET remind_at = ?, time_zone = COALESCE(?, time_zone) WHERE id = ?')
      .bind(time, time === null ? null : body.timeZone, data.user.id).run();
    return json({ time });
  } catch (err) {
    return serverError(err, 'save reminder');
  }
}
