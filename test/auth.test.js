import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolveIdentity, sessionCookie, constantEqual } from '../server/auth.js';

const cookie = 'a'.repeat(32);
const csrf = 'c'.repeat(32);
const req = { headers: { cookie: `other=private; aistat_session=${cookie}`, host: 'evil.example', 'x-user-id': '999', authorization: 'untrusted' } };
const good = () => new Response(JSON.stringify({ user_id: 7, username: 'ADMIN', csrf }), { headers: { 'content-type': 'application/json' } });

test('root introspection uses a fixed URL and only the session cookie, ignoring browser identity claims and username', async () => {
  const actor = await resolveIdentity(req, async (url, options) => {
    assert.equal(url, 'https://aistat.app/api/session');
    assert.deepEqual(options.headers, { cookie: `aistat_session=${cookie}`, accept: 'application/json' });
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    return good();
  });
  assert.deepEqual(actor, { id: '7', name: 'Аккаунт 7', csrf, sessionHash: createHash('sha256').update(cookie).digest('hex') });
  assert.equal(actor.isAdmin, undefined);
});

test('missing, malformed and duplicate cookies never call the auth network', async () => {
  for (const value of ['', 'x=a', 'aistat_session=short', `aistat_session=${cookie}; aistat_session=${cookie}`, `aistat_session=${cookie}%0a`]) {
    assert.equal(sessionCookie(value), null);
    assert.equal(await resolveIdentity({ headers: { cookie: value } }, async () => assert.fail('network must not run')), null);
  }
  assert.equal(sessionCookie(`aistat_session=${cookie}`), cookie);
  assert.equal(constantEqual(undefined, csrf), false);
  assert.equal(constantEqual(csrf, csrf), true);
  assert.equal(constantEqual('bad', csrf), false);
});

test('revocation is honored on each request and no successful identity is cached', async () => {
  let calls = 0;
  const request = async () => ++calls === 1 ? good() : new Response('', { status: 401 });
  assert.equal((await resolveIdentity(req, request)).id, '7');
  assert.equal(await resolveIdentity(req, request), null);
  assert.equal(calls, 2);
  assert.equal(await resolveIdentity(req, async () => new Response('', { status: 403 })), null);
});

test('redirects, errors, HTML, oversized and malformed identity responses fail closed', async () => {
  const variants = [
    () => new Response('', { status: 303, headers: { location: 'https://evil.example' } }),
    () => new Response('', { status: 500 }),
    () => new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('x'.repeat(8193), { headers: { 'content-type': 'application/json' } }),
    () => new Response('{', { headers: { 'content-type': 'application/json' } }),
    ...[null, [], { user_id: 0, csrf }, { user_id: '7', csrf }, { user_id: true, csrf }, { user_id: Number.MAX_SAFE_INTEGER + 1, csrf },
      { user_id: 7, csrf: 'short' }, { username: 'ADMIN', csrf }].map(body => () => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })),
  ];
  for (const response of variants) await assert.rejects(resolveIdentity(req, async () => response()), { status: 503, code: 'auth_unavailable' });
  await assert.rejects(resolveIdentity(req, async () => { throw new Error('network offline'); }), { status: 503, code: 'auth_unavailable' });
});
