import { randomUUID, randomBytes } from 'node:crypto';
import { getAddress, verifyMessage } from 'ethers';
import { boundedJson } from './http-json.js';

export const CHAIN_ID = 4663;
export function addressOf(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw Object.assign(new Error('Неверный адрес кошелька.'), { status: 400, code: 'invalid_address' });
  try { return getAddress(value); } catch { throw Object.assign(new Error('Неверная контрольная сумма адреса.'), { status: 400, code: 'invalid_address' }); }
}
export async function isExternallyOwned(address, request = fetch) {
  let response;
  try {
    response = await request('https://rpc.mainnet.chain.robinhood.com', {
      method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(7000),
      body: JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }, { jsonrpc: '2.0', id: 2, method: 'eth_getCode', params: [address, 'latest'] }])
    });
    if (!response.ok) throw new Error();
    const data = await boundedJson(response);
    if (!Array.isArray(data) || data.find(x => x.id === 1)?.result !== '0x1237') throw new Error();
    const code = data.find(x => x.id === 2)?.result;
    if (typeof code !== 'string' || !/^0x[0-9a-fA-F]*$/.test(code)) throw new Error();
    return code === '0x' || code === '0x0';
  } catch { throw Object.assign(new Error('RPC сети недоступен. Повторите проверку позже.'), { status: 503, code: 'chain_unavailable' }); }
}
export function makeChallenge(identity, address, provider, origin) {
  const issuedAt = new Date(); const expiresAt = issuedAt.getTime() + 5 * 60000;
  const id = randomUUID();
  const message = `${new URL(origin).host} wants you to sign in with your Ethereum account:\n${address}\n\nLink this wallet to your CryptoBot account. No transaction or permission to spend funds.\n\nURI: ${origin}/bot/\nVersion: 1\nChain ID: 4663\nNonce: ${randomBytes(16).toString('hex')}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${new Date(expiresAt).toISOString()}\nRequest ID: ${id}`;
  return { id, account: identity.id, sessionHash: identity.sessionHash, address, provider, message, expiresAt };
}
export function signatureMatches(row, signature) {
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) return false;
  try { return verifyMessage(row.message, signature).toLowerCase() === row.address.toLowerCase(); } catch { return false; }
}
