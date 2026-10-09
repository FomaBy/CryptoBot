import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createStore } from '../server/store.js';
import { createBacktestStore } from '../server/backtest-store.js';
import { createApp } from '../server/app.js';
import { backtestParams } from '../server/backtests.js';

const params = () => ({ mode: 'scenario', window: 'available', preset: 150, end: Math.floor(Date.now() / 60000) * 60000 });
test('backtest parameters reject future/stale windows and unsupported authority', () => {
  const now = Date.now();
  for (const change of [{ mode: 'live' }, { window: 'all' }, { preset: 999 }, { end: now + 1 }, { end: now - 16 * 60000 }]) assert.throws(() => backtestParams({ ...params(), ...change }, now));
  assert.equal(backtestParams(params(), now).window, 'available');
});

test('research runs are account bound, idempotent, capacity limited and survive another store opening', () => {
  const store = createStore(':memory:');
  try {
    store.account('a'); store.account('b');
    const runs = createBacktestStore(store.db); const key = randomUUID(); const frozen = params();
    const first = runs.reserve('a', key, frozen);
    assert.equal(runs.reserve('a', key, frozen).run.id, first.run.id);
    assert.throws(() => runs.reserve('a', key, { ...frozen, preset: 1000 }), { code: 'idempotency_conflict' });
    assert.equal(runs.get('b', first.run.id), null); assert.deepEqual(runs.list('b'), []); assert.equal(runs.remove('b', first.run.id), false);
    assert.equal(createBacktestStore(store.db).get('a', first.run.id).status, 'running');
    assert.throws(() => runs.reserve('a', randomUUID(), frozen), { code: 'backtest_busy' });
    runs.finish('a', first.run.id, { result: 'fixture' });
    assert.equal(runs.get('a', first.run.id).status, 'complete');
    for (let i = 1; i < 20; i++) { const r = runs.reserve('a', randomUUID(), frozen); runs.finish('a', r.run.id, null, 'fixture_failure'); }
    assert.throws(() => runs.reserve('a', randomUUID(), frozen), { code: 'backtest_limit' });
    assert.equal(runs.remove('a', first.run.id), true);
    const last = runs.reserve('a', randomUUID(), frozen);
    store.db.prepare('UPDATE backtest_runs SET expires_at=0 WHERE id=?').run(last.run.id);
    assert.equal(runs.get('a', last.run.id).status, 'interrupted');
    runs.finish('a', last.run.id, { late: true });
    assert.equal(runs.get('a', last.run.id).report, null);
  } finally { store.close(); }
});

test('backtest API enforces login/CSRF, persistent account scope, one request execution and failure state', async t => {
  const store = createStore(':memory:'); let calls = 0; let release;
  const server = createApp({ store, identity: async req => req.headers['x-fixture'] ? { id: req.headers['x-fixture'], name: 'Fixture', csrf: 'fixture-csrf-token' } : null,
    backtests: async () => { calls++; await new Promise(resolve => { release = resolve; }); return { scenario: true }; } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { release?.(); await server.backtestsIdle(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const url = `http://127.0.0.1:${server.address().port}/bot/api/backtests`;
  const call = async (suffix = '', method = 'GET', body, actor = 'a', csrf = true) => {
    const r = await fetch(url + suffix, { method, headers: { ...(actor ? { 'x-fixture': actor } : {}), origin: 'https://aistat.app', 'x-csrf-token': csrf ? 'fixture-csrf-token' : 'bad', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() };
  };
  const body = { ...params(), idempotencyKey: randomUUID() };
  assert.equal((await call('', 'POST', body, '')).status, 401);
  assert.equal((await call('', 'POST', body, 'a', false)).status, 403);
  assert.equal((await call('', 'POST', { ...body, account_id: 'b' })).status, 400);
  const first = await call('', 'POST', body); assert.equal(first.status, 202);
  const duplicate = await call('', 'POST', body); assert.equal(duplicate.body.run.id, first.body.run.id); assert.equal(calls, 1);
  const id = first.body.run.id;
  assert.equal((await call('/' + id, 'GET', undefined, 'b')).status, 404);
  assert.equal((await call('/' + id, 'DELETE', undefined, 'b')).status, 404);
  assert.deepEqual((await call('', 'GET', undefined, 'b')).body.runs, []);
  release(); await server.backtestsIdle();
  assert.equal((await call('/' + id)).body.run.status, 'complete');
  assert.equal((await call('/' + id, 'DELETE')).status, 200);
  assert.equal((await call('/' + id)).status, 404);
});

test('public backtest consumer preserves the synthetic versioned report and rejects private/schema/causal drift', async () => {
  const { readFileSync } = await import('node:fs');
  const { validateBacktest, createBacktestClient } = await import('../server/backtests.js');
  // Public response fixture generated solely from synthetic 0x111… observations; no private rows or engine code.
  const report = JSON.parse(readFileSync(new URL('./backtest-report.fixture.json', import.meta.url)));
  const request = { mode: report.mode, window: report.window, preset: report.preset, end: Date.parse(report.period.end) };
  assert.deepEqual(validateBacktest(structuredClone(report), request), report);
  for (const mutate of [x => { x.wallets = []; }, x => { x.assumptions.apiKey = 'fake'; }, x => { x.executionAuthorized = true; },
    x => { x.chainId = 1; }, x => { x.period.end = new Date(request.end + 60000).toISOString(); },
    x => { x.result.trades[0].entryAt = x.result.trades[0].signalAt; }, x => { x.result.trades[0].privateLabel = 'fake'; }]) {
    const changed = structuredClone(report); mutate(changed); assert.throws(() => validateBacktest(changed, request));
  }
  let calls = 0;
  const client = createBacktestClient(async (url, options) => {
    calls++; const endpoint = new URL(url); assert.equal(endpoint.origin, 'https://aistat.app'); assert.equal(endpoint.pathname, '/crypto/api/backtest/v1');
    assert.deepEqual(options.headers, { accept: 'application/json' }); assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify(report), { headers: { 'content-type': 'application/json' } });
  });
  const values = await Promise.all([client(request), client(request)]); assert.deepEqual(values[0], report); assert.equal(calls, 1);
  const bad = createBacktestClient(async () => new Response(JSON.stringify({ ...report, account: 'private' }), { headers: { 'content-type': 'application/json' } }));
  await assert.rejects(bad(request), { code: 'backtest_schema_invalid' });
});

test('honest insufficient scenario reports are retained with null results, never transformed into profit or schema failures', async () => {
  const { readFileSync } = await import('node:fs');
  const { validateBacktest } = await import('../server/backtests.js');
  const base = JSON.parse(readFileSync(new URL('./backtest-report.fixture.json', import.meta.url)));
  const short = structuredClone(base); short.window = '14d'; short.result = null; short.coverage.fullWindow = false;
  assert.equal(validateBacktest(short, { mode: 'scenario', window: '14d', preset: short.preset, end: Date.parse(short.period.end) }).result, null);
  const empty = structuredClone(base); empty.result = null;
  for (const key of ['rows', 'selectedRows', 'tokens', 'rated', 'priced', 'liquid']) empty.coverage[key] = 0;
  assert.equal(validateBacktest(empty, { mode: 'scenario', window: 'available', preset: empty.preset, end: Date.parse(empty.period.end) }).result, null);
  const unexplained = structuredClone(base); unexplained.result = null;
  assert.throws(() => validateBacktest(unexplained, { mode: 'scenario', window: 'available', preset: unexplained.preset, end: Date.parse(unexplained.period.end) }));
});
