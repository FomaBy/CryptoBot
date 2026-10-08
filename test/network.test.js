import test from 'node:test';
import assert from 'node:assert/strict';
import { networkStatus } from '../server/network.js';
import { boundedJson } from '../server/http-json.js';

test('RPC health preserves block evidence, distinguishes unverified registry and coalesces concurrent reads', async () => {
  let requests = 0;
  const status = networkStatus(async (url, options) => {
    requests++;
    assert.equal(url, 'https://rpc.mainnet.chain.robinhood.com');
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify([{ id: 1, result: '0x1237' }, { id: 2, result: { number: '0x123', hash: '0x' + '1'.repeat(64) } }]));
  });
  const [a, b] = await Promise.all([status(), status()]);
  assert.deepEqual(a, b);
  assert.equal(a.blockNumber, '291');
  assert.equal(a.registryVerified, false);
  assert.equal(a.finality, 'latest_unconfirmed');
  await status();
  assert.equal(requests, 1);
});

test('wrong chain and malformed RPC fail closed without simulated observations', async () => {
  for (const data of [null, [], [{ id: 1, result: '0x1' }]]) {
    const status = networkStatus(async () => new Response(JSON.stringify(data)));
    const result = await status();
    assert.equal(result.status, 'unavailable');
    assert.equal(result.blockNumber, undefined);
  }
});

test('bounded response reader cancels the stream before exceeding its memory cap', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(20)); }, cancel() { cancelled = true; } });
  await assert.rejects(boundedJson(new Response(stream), 10), /too large/);
  assert.equal(cancelled, true);
});
