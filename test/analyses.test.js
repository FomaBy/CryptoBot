import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalysisClient, validateAnalyses } from '../server/analyses.js';

// Synthetic public-contract fixture; no ACS private implementation or live dataset.
export function analysisFixture() {
  const address = '0x' + '1'.repeat(40); const time = '2026-10-08T10:00:00.000Z';
  return { schemaVersion: 'acs.analysis.v1', snapshotId: 'a'.repeat(64), source: { id: 'ai-crypto-statistics', revision: null }, chainId: 4663,
    asOf: time, servedAt: time, executionAuthorized: false, coverage: { published: 1, included: 1, limit: 250 }, items: [{
      tokenId: `eip155:4663/erc20:${address}`, analysisId: 'b'.repeat(64), version: 'b'.repeat(64), chainId: 4663, address,
      symbol: 'TEST', name: 'Synthetic token', launchpad: 'pons_v2', stage: 'curve', asOf: time,
      timestamps: { market: null, score: null, entry: time }, market: { priceUsd: '0.00001', marketCapUsd: null, quoteLiquidityUsd: null },
      assessment: { score: 50, tier: 'HIDDEN', entryScore: null, entryVerdict: null, entryVersion: null, decisionVerdict: 'skip', reasonCodes: [], riskCodes: ['INSIDERS'] },
      unknowns: ['registry_unverified', 'sellability_unverified', 'source_times_partial'], botScope: 'pons_reported', executionAuthorized: false
    }] };
}
const response = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

test('shared analysis preserves source IDs and values, coalesces requests, and sends no user cookies', async () => {
  let calls = 0; let clock = 0; const fixture = analysisFixture();
  const client = createAnalysisClient(async (url, options) => {
    calls++;
    assert.equal(url, 'https://aistat.app/crypto/api/analysis/v1?chainId=4663');
    assert.deepEqual(options.headers, { accept: 'application/json' });
    assert.equal(options.redirect, 'error');
    return response(fixture);
  }, () => clock);
  const [a, b] = await Promise.all([client(), client()]);
  assert.deepEqual(a, fixture); assert.deepEqual(b, fixture); assert.equal(calls, 1);
  a.items[0].assessment.score = 100;
  assert.equal((await client()).items[0].assessment.score, 50);
  clock = 5001; await client(); assert.equal(calls, 2);
});

test('unexpected private fields, wrong chain, spoofed Pons scope and execution flags fail closed', () => {
  const mutate = [
    x => { x.walletFeed = []; }, x => { x.items[0].wallets = []; },
    x => { x.items[0].assessment.walletName = 'private'; }, x => { x.chainId = 1; },
    x => { x.items[0].launchpad = 'bankr'; }, x => { x.executionAuthorized = true; },
    x => { x.items[0].executionAuthorized = true; }, x => { x.items[0].unknowns = []; },
    x => { x.items[0].market.priceUsd = 0.00001; }, x => { x.items.push(x.items[0]); x.coverage.included = 2; x.coverage.published = 2; },
    x => { x.items[0].assessment.riskCodes = ['0x' + 'f'.repeat(40)]; }
  ];
  for (const change of mutate) { const data = analysisFixture(); change(data); assert.throws(() => validateAnalyses(data)); }
});

test('exact snapshot is never replaced by latest; expiry and malformed sources remain explicit', async () => {
  const id = 'c'.repeat(64); let calls = 0;
  const expired = createAnalysisClient(async url => { calls++; assert.ok(url.endsWith('&snapshot=' + id)); return new Response('', { status: 410 }); });
  await assert.rejects(expired(id), { status: 410, code: 'snapshot_expired' });
  assert.equal(calls, 1);
  await assert.rejects(expired('https://evil.example'), { status: 400 });
  const mismatch = createAnalysisClient(async () => response(analysisFixture()));
  await assert.rejects(mismatch(id), { status: 502 });
  const unavailable = createAnalysisClient(async () => new Response('unavailable', { status: 404 }));
  await assert.rejects(unavailable(), { status: 503 });
});
