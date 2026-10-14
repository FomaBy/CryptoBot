import { createHash, timingSafeEqual } from 'node:crypto';
import { boundedJson } from './http-json.js';

export function sessionCookie(header = '') {
  const parts = header.split(';').map(x => x.trim()).filter(x => x.startsWith('aistat_session='));
  if (parts.length !== 1) return null;
  const value = parts[0].slice('aistat_session='.length);
  return /^[A-Za-z0-9_-]{20,256}$/.test(value) ? value : null;
}

export function constantEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The root server resolves the opaque cookie against its own revocable session DB.
// Never accept user identity from browser headers or the shared username label.
export async function resolveIdentity(req, request = fetch) {
  const cookie = sessionCookie(req.headers.cookie);
  if (!cookie) return null;
  let response;
  try {
    response = await request('https://aistat.app/api/session', {
      headers: { cookie: `aistat_session=${cookie}`, accept: 'application/json' },
      redirect: 'manual', signal: AbortSignal.timeout(7000)
    });
  } catch { throw Object.assign(new Error('Сервис входа временно недоступен.'), { status: 503, code: 'auth_unavailable' }); }
  if (response.status === 401 || response.status === 403) return null;
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')) {
    throw Object.assign(new Error('Не удалось проверить вход.'), { status: 503, code: 'auth_unavailable' });
  }
  let body;
  try { body = await boundedJson(response, 8192); } catch { throw Object.assign(new Error('Не удалось проверить вход.'), { status: 503, code: 'auth_unavailable' }); }
  if (!body || !Number.isSafeInteger(body.user_id) || body.user_id < 1 || typeof body.csrf !== 'string' || body.csrf.length < 20 || body.csrf.length > 256) {
    throw Object.assign(new Error('Некорректный ответ сервиса входа.'), { status: 503, code: 'auth_unavailable' });
  }
  return { id: String(body.user_id), name: `Аккаунт ${body.user_id}`, csrf: body.csrf, sessionHash: createHash('sha256').update(cookie).digest('hex') };
}
