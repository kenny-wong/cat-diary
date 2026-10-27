// Password reset emails, sent through Resend (https://resend.com).

export const mailEnabled = env => !!(env.RESEND_API_KEY && env.MAIL_FROM);

export function resetEmail(link) {
  return {
    subject: 'Reset your My Little Diary password',
    text: `Hi!\n\nSomeone (hopefully you) asked to reset the password for your diary.\n\n` +
      `Open this link within an hour to choose a new password:\n${link}\n\n` +
      `If you didn't ask for this, just ignore this email. Your password stays the same.\n\n🐾 My Little Diary`,
  };
}

export async function sendMail(env, to, { subject, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}
