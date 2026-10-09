import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { isExternallyOwned, addressOf } from '../server/wallets.js';

test('EOA check validates chain and rejects contract code without making real RPC calls', async () => {
  const address = Wallet.createRandom().address;
  const request = (chain, code) => async (url, options) => {
    assert.equal(url, 'https://rpc.mainnet.chain.robinhood.com');
    assert.equal(options.redirect, 'error');
    const payload = JSON.parse(options.body);
    assert.deepEqual(payload.map(x => x.method), ['eth_chainId', 'eth_getCode']);
    assert.deepEqual(payload[1].params, [address, 'latest']);
    return new Response(JSON.stringify([{ id: 2, result: code }, { id: 1, result: chain }]));
  };
  assert.equal(await isExternallyOwned(address, request('0x1237', '0x')), true);
  assert.equal(await isExternallyOwned(address, request('0x1237', '0x6000')), false);
  await assert.rejects(isExternallyOwned(address, request('0x1', '0x')), { code: 'chain_unavailable', status: 503 });
  await assert.rejects(isExternallyOwned(address, request('0x1237', null)), { code: 'chain_unavailable', status: 503 });
  await assert.rejects(isExternallyOwned(address, async () => { throw new Error('offline'); }), { code: 'chain_unavailable', status: 503 });
  assert.equal(addressOf(address.toLowerCase()), address);
  assert.throws(() => addressOf('not-an-address'), { code: 'invalid_address' });
});
