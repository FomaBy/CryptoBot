import { boundedJson } from './http-json.js';

export function networkStatus(request = fetch) {
  let cached; let pending;
  return async () => {
    if (cached && Date.now() - cached.at < 60000) return cached.value;
    if (pending) return pending;
    pending = (async () => {
      let value;
      try {
        const response = await request('https://rpc.mainnet.chain.robinhood.com', {
          method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(5000),
          body: JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] },
            { jsonrpc: '2.0', id: 2, method: 'eth_getBlockByNumber', params: ['latest', false] }])
        });
        if (!response.ok) throw new Error();
        const data = await boundedJson(response, 1048576);
        const block = Array.isArray(data) && data.find(x => x?.id === 2)?.result;
        if (!block || data.find(x => x?.id === 1)?.result !== '0x1237' || !/^0x[0-9a-f]+$/i.test(block.number) || !/^0x[0-9a-f]{64}$/i.test(block.hash)) throw new Error();
        value = { status: 'connected', chainId: 4663, blockNumber: BigInt(block.number).toString(), blockHash: block.hash,
          observedAt: new Date().toISOString(), finality: 'latest_unconfirmed', registryVerified: false };
      } catch { value = { status: 'unavailable', chainId: 4663, observedAt: new Date().toISOString(), registryVerified: false }; }
      cached = { at: Date.now(), value }; return value;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}
