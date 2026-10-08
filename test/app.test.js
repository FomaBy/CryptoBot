import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Wallet } from 'ethers';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';

const origin = 'https://aistat.app';
const actors = {
  a: { id: '101', name: 'A', csrf: 'test-csrf-account-a-long', sessionHash: 'session-a' },
  b: { id: '202', name: 'B', csrf: 'test-csrf-account-b-long', sessionHash: 'session-b' },
  rotated: { id: '101', name: 'A', csrf: 'test-csrf-account-a-new', sessionHash: 'session-a-new' },
};
const task = { title: 'Private A task', description: 'Only A sees this', acceptance: 'Evidence exists', priority: 'p1' };

async function fixture(t, options = {}) {
  const store = createStore(options.filename ?? ':memory:');
  const server = createApp({ store, origin, identity: async req => actors[req.headers['x-test-actor']] ?? null,
    verifyEOA: options.verifyEOA ?? (async () => true), network: async () => ({ status: 'unavailable', chainId: 4663 }), analyses: options.analyses ?? (async () => ({ test: true })) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    store.close();
  }
  t.after(close);
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, { actor = 'a', method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(base + '/bot/api/' + path, { method, headers: { 'x-test-actor': actor,
      origin, 'x-csrf-token': actors[actor]?.csrf ?? '', 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json(), headers: res.headers };
  }
  return { store, call, close };
}

async function challenge(call, wallet, actor = 'a') {
  const response = await call('wallets/challenge', { actor, method: 'POST', body: { address: wallet.address, provider: 'Test wallet' } });
  assert.equal(response.status, 201);
  return { ...response.body, signature: await wallet.signMessage(response.body.message) };
}
const verify = (call, proof, actor = 'a') => call('wallets/verify', { actor, method: 'POST', body: { challengeId: proof.id, signature: proof.signature } });

test('protected data requires login; public session and health reveal no account data', async t => {
  const { call } = await fixture(t);
  for (const path of ['overview', 'tasks', 'wallets', 'audit', 'analyses']) {
    const response = await call(path, { actor: 'none' });
    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'authentication_required');
  }
  const session = await call('session', { actor: 'none' });
  assert.equal(session.body.authenticated, false);
  assert.equal(session.body.user, undefined);
  const health = await call('health', { actor: 'none' });
  assert.equal(health.body.liveEnabled, false);
  assert.equal(health.body.paperEnabled, false);
  const overview = await call('overview');
  assert.deepEqual(overview.body.positions, []);
  assert.equal(overview.body.validatedWallets, 0);
  assert.equal(overview.body.pnl, null);
  assert.deepEqual((await call('wallets')).body.wallets, []);
});

test('analysis proxy requires a session and accepts only an exact snapshot selector', async t => {
  let calls = 0; let selected;
  const { call } = await fixture(t, { analyses: async id => { calls++; selected = id; return { snapshotId: id }; } });
  assert.equal((await call('analyses', { actor: 'none' })).status, 401);
  assert.equal(calls, 0);
  const id = 'a'.repeat(64);
  const result = await call('analyses?snapshot=' + id);
  assert.equal(result.status, 200); assert.equal(selected, id);
  assert.equal((await call('analyses?url=https://evil.example')).status, 400);
  assert.equal((await call('analyses?snapshot=' + id + '&snapshot=' + id)).status, 400);
});

test('tenant isolation covers tasks, settings, wallets and audit; unknown owner/status fields cannot grant authority', async t => {
  const { call } = await fixture(t);
  const created = await call('tasks', { method: 'POST', body: task });
  assert.equal(created.status, 201);
  assert.equal(created.body.task.status, 'planned');
  const id = created.body.task.id;
  assert.deepEqual((await call('tasks', { actor: 'b' })).body.tasks, []);
  assert.equal((await call(`tasks/${id}`, { actor: 'b', method: 'PATCH', body: { status: 'cancelled' } })).status, 404);
  assert.equal((await call(`tasks/${id}`, { method: 'PATCH', body: { status: 'done' } })).status, 400);
  for (const extra of [{ account_id: '202' }, { owner: '202' }, { status: 'done' }, { authorized: true }]) {
    assert.equal((await call('tasks', { method: 'POST', body: { ...task, ...extra } })).status, 400);
  }
  assert.equal((await call('settings', { method: 'PUT', body: { preset: 5000 } })).status, 200);
  assert.equal((await call('overview')).body.preset, 5000);
  assert.equal((await call('overview', { actor: 'b' })).body.preset, 150);
  assert.equal((await call('settings', { method: 'PUT', body: { preset: 1000, account_id: '202' } })).status, 400);
  const proof = await challenge(call, Wallet.createRandom());
  const linked = await verify(call, proof);
  assert.equal(linked.status, 200);
  assert.equal(linked.body.spendingPermission, false);
  assert.deepEqual((await call('wallets', { actor: 'b' })).body.wallets, []);
  const walletId = linked.body.wallet.id;
  assert.equal((await call(`wallets/${walletId}`, { actor: 'b', method: 'DELETE' })).status, 404);
  assert.deepEqual((await call('audit', { actor: 'b' })).body.events, []);
  assert.equal((await call('wallets')).body.wallets.length, 1);
  const deleted = await call(`wallets/${walletId}`, { method: 'DELETE' });
  assert.equal(deleted.body.onChainRevocation, false);
  assert.equal(deleted.body.spendingPermission, false);
});

test('CSRF and exact origin are independently required for mutations', async t => {
  const { call } = await fixture(t);
  for (const headers of [ { origin: '' }, { origin: 'https://evil.example' }, { 'x-csrf-token': '' },
    { 'x-csrf-token': actors.b.csrf }, { origin: 'https://aistat.app.evil.example' } ]) {
    assert.equal((await call('tasks', { method: 'POST', body: task, headers })).status, 403);
  }
  assert.deepEqual((await call('tasks')).body.tasks, []);
});

test('EOA proof is bound to exact message, account, session and expiration; replay is rejected', async t => {
  const { call, store } = await fixture(t);
  const wallet = Wallet.createRandom();
  const proof = await challenge(call, wallet);
  assert.match(proof.message, /^aistat\.app wants you to sign in/);
  assert.match(proof.message, /URI: https:\/\/aistat\.app\/bot\//);
  assert.match(proof.message, /Chain ID: 4663/);
  assert.match(proof.message, /No transaction or permission to spend funds/);
  assert.equal((await verify(call, proof, 'b')).status, 409);
  assert.equal((await verify(call, proof, 'rotated')).status, 409);
  const wrong = { ...proof, signature: await Wallet.createRandom().signMessage(proof.message) };
  assert.equal((await verify(call, wrong)).status, 400);
  for (const message of [proof.message.replace('4663', '1'), proof.message.replace('aistat.app', 'evil.example')]) {
    assert.equal((await verify(call, { ...proof, signature: await wallet.signMessage(message) })).status, 400);
  }
  assert.equal((await verify(call, proof)).status, 200);
  assert.equal((await verify(call, proof)).status, 409);
  const expired = await challenge(call, wallet);
  store.db.prepare('UPDATE challenges SET expires_at=? WHERE id=?').run(Date.now() - 1, expired.id);
  assert.equal((await verify(call, expired)).status, 409);
  assert.equal((await call('wallets')).body.wallets.length, 1);
});

test('parallel verification consumes one challenge once across the async RPC boundary', async t => {
  let waitForBoth = false; let waiting = [];
  const { call } = await fixture(t, { verifyEOA: async () => {
    if (!waitForBoth) return true;
    return new Promise(resolve => { waiting.push(resolve); if (waiting.length === 2) { for (const release of waiting) release(true); } });
  } });
  const proof = await challenge(call, Wallet.createRandom());
  waitForBoth = true;
  const replies = await Promise.all([verify(call, proof), verify(call, proof)]);
  assert.deepEqual(replies.map(x => x.status).sort(), [200, 409]);
  assert.equal((await call('wallets')).body.wallets.length, 1);
  const events = (await call('audit')).body.events.filter(x => x.kind === 'wallet_ownership_verified');
  assert.equal(events.length, 1);
});

test('contract status is rejected before challenge and rechecked before consumption', async t => {
  let isEOA = false;
  const { call } = await fixture(t, { verifyEOA: async () => isEOA });
  const wallet = Wallet.createRandom();
  assert.equal((await call('wallets/challenge', { method: 'POST', body: { address: wallet.address } })).status, 422);
  isEOA = true;
  const proof = await challenge(call, wallet);
  isEOA = false;
  assert.equal((await verify(call, proof)).status, 422);
  assert.deepEqual((await call('wallets')).body.wallets, []);
});

test('accounts, tasks, ownership proof and consumed challenge survive database reopen', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'cryptobot-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = join(dir, 'state.sqlite');
  const { call, close } = await fixture(t, { filename });
  await call('settings', { method: 'PUT', body: { preset: 1000 } });
  const created = await call('tasks', { method: 'POST', body: task });
  const proof = await challenge(call, Wallet.createRandom());
  assert.equal((await verify(call, proof)).status, 200);
  await close();
  const second = createStore(filename);
  try {
    assert.equal(second.account('101').preset, 1000);
    assert.equal(second.tasks('101')[0].id, created.body.task.id);
    assert.equal(second.wallets('101').length, 1);
    assert.equal(second.getChallenge('101', actors.a.sessionHash, proof.id), undefined);
    assert.deepEqual(second.wallets('202'), []);
  } finally { second.close(); }
});


test('wallet capacity is rechecked atomically when pre-created challenges are consumed', async t => {
  const { store, call } = await fixture(t);
  const proof = await challenge(call, Wallet.createRandom());
  const insert = store.db.prepare('INSERT INTO wallets VALUES(?,?,?,?,?,4663)');
  for (let i = 0; i < 20; i++) insert.run(`fixture-${i}`, actors.a.id, `0x${i.toString(16).padStart(40, '0')}`, 'Fixture', new Date().toISOString());
  const response = await verify(call, proof);
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'wallet_limit');
  assert.equal(store.wallets(actors.a.id).length, 20);
  assert.ok(store.getChallenge(actors.a.id, actors.a.sessionHash, proof.id));
});
