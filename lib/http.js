// Small helpers shared by every API route.

export const json = (data, status = 200, headers = {}) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export const badRequest = error => json({ error }, 400);
export const unauthorized = () => json({ error: 'Please log in again.' }, 401);
export const tooMany = () => json({ error: 'Too many tries. Please wait a few minutes and try again.' }, 429);

export function serverError(err, where) {
  console.error(where, err);
  return json({ error: 'Something went wrong. Please try again.' }, 500);
}

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

// ISO-8601 UTC without milliseconds, matching the database's strftime defaults.
export const isoAt = (msFromNow = 0) => new Date(Date.now() + msFromNow).toISOString().replace(/\.\d{3}Z$/, 'Z');
