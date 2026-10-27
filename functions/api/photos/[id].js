import { badRequest, json, serverError, unauthorized } from '../../../lib/http.js';
import { MAX_PHOTO_BYTES, isId, sniffImage } from '../../../lib/validate.js';

const MAX_USER_BYTES = 500 * 1024 * 1024; // photo space per account

export async function onRequestGet({ env, data, params }) {
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad photo id.');
  try {
    const row = await env.DB.prepare('SELECT mime, data FROM photos WHERE user_id = ? AND id = ?').bind(data.user.id, params.id).first();
    if (!row) return json({ error: 'Photo not found.' }, 404);
    const bytes = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data);
    // Photo ids never get new content, so the browser may keep them for good.
    return new Response(bytes, { headers: { 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=31536000, immutable' } });
  } catch (err) {
    return serverError(err, 'get photo');
  }
}

export async function onRequestPut({ request, env, data, params }) {
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad photo id.');
  if (Number(request.headers.get('Content-Length')) > MAX_PHOTO_BYTES) return json({ error: 'This photo is too big.' }, 413);
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return badRequest('Missing photo.');
    if (bytes.length > MAX_PHOTO_BYTES) return json({ error: 'This photo is too big.' }, 413);
    const mime = sniffImage(bytes);
    if (!mime) return badRequest('Please use a JPG, PNG, WebP or GIF image.');
    const used = await env.DB.prepare('SELECT COALESCE(SUM(length(data)), 0) AS n FROM photos WHERE user_id = ?').bind(data.user.id).first();
    if (used.n + bytes.length > MAX_USER_BYTES) return json({ error: 'Your photo space is full. Remove some photos first.' }, 413);
    await env.DB.prepare('INSERT OR REPLACE INTO photos (user_id, id, mime, data) VALUES (?, ?, ?, ?)')
      .bind(data.user.id, params.id, mime, bytes).run();
    return json({ ok: true }, 201);
  } catch (err) {
    return serverError(err, 'save photo');
  }
}

// Only deletes a photo that no saved page still uses.
export async function onRequestDelete({ env, data, params }) {
  if (!data.user) return unauthorized();
  if (!isId(params.id)) return badRequest('Bad photo id.');
  try {
    const inUse = await env.DB.prepare('SELECT 1 FROM entries WHERE user_id = ? AND instr(data, ?) > 0 LIMIT 1')
      .bind(data.user.id, `"photo:${params.id}"`).first();
    if (inUse) return json({ error: 'A page still uses this photo.' }, 409);
    await env.DB.prepare('DELETE FROM photos WHERE user_id = ? AND id = ?').bind(data.user.id, params.id).run();
    return json({ ok: true });
  } catch (err) {
    return serverError(err, 'delete photo');
  }
}
