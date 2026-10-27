// Pages Functions can't run on a timer, so this Worker wakes the diary's reminder route every 15 minutes.
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const res = await fetch(`${env.SITE}/api/cron/reminders`, { method: 'POST', headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
      console.log('reminders', res.status, await res.text());
    })());
  },
};
