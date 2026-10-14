import { boundedJson } from './http-json.js';

const HASH = /^[0-9a-f]{64}$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const failure = (status, code, message) => Object.assign(new Error(message), { status, code });
const invalid = () => { throw new Error('Invalid analysis schema'); };
function shape(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid();
}
function label(value, maximum, nullable = true) {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) invalid();
}
function timestamp(value) {
  if (value !== null && (typeof value !== 'string' || value.length > 32 || !Number.isFinite(Date.parse(value)))) invalid();
}
function score(value) { if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)) invalid(); }
function codes(value) {
  if (!Array.isArray(value) || value.length > 40 || value.some(code => typeof code !== 'string' || !/^[a-zA-Z0-9_.:-]{1,80}$/.test(code) || /0x[0-9a-f]{8}/i.test(code))) invalid();
}

// A strict public contract is deliberately independent of the private ACS codebase.
// Unknown fields fail closed, so a future producer cannot silently expose identities.
export function validateAnalyses(data) {
  shape(data, ['schemaVersion', 'snapshotId', 'source', 'chainId', 'asOf', 'servedAt', 'items', 'coverage', 'executionAuthorized']);
  if (data.schemaVersion !== 'acs.analysis.v1' || !HASH.test(data.snapshotId) || data.chainId !== 4663 || data.executionAuthorized !== false) invalid();
  shape(data.source, ['id', 'revision']);
  if (data.source.id !== 'ai-crypto-statistics' || (data.source.revision !== null && !/^[0-9a-f]{40}$/.test(data.source.revision))) invalid();
  timestamp(data.asOf); timestamp(data.servedAt);
  if (data.servedAt === null) invalid();
  shape(data.coverage, ['published', 'included', 'limit']);
  for (const value of Object.values(data.coverage)) if (!Number.isSafeInteger(value) || value < 0) invalid();
  if (!Array.isArray(data.items) || data.items.length > 250 || data.coverage.limit !== 250 || data.coverage.included !== data.items.length || data.coverage.published < data.items.length) invalid();
  const seen = new Set();
  for (const item of data.items) {
    shape(item, ['tokenId', 'analysisId', 'version', 'chainId', 'address', 'symbol', 'name', 'launchpad', 'stage', 'asOf', 'timestamps', 'market', 'assessment', 'unknowns', 'botScope', 'executionAuthorized']);
    if (item.chainId !== 4663 || !ADDRESS.test(item.address) || item.tokenId !== `eip155:4663/erc20:${item.address}` || !HASH.test(item.analysisId) || !HASH.test(item.version) || seen.has(item.tokenId) || item.executionAuthorized !== false) invalid();
    seen.add(item.tokenId);
    label(item.symbol, 80, false); label(item.name, 160, false); label(item.launchpad, 64); label(item.stage, 64); timestamp(item.asOf);
    if (!['pons_reported', 'unverified_origin'].includes(item.botScope)) invalid();
    if (item.botScope === 'pons_reported' && !['pons', 'pons_v1', 'pons_v2'].includes(item.launchpad)) invalid();
    shape(item.timestamps, ['market', 'score', 'entry']); Object.values(item.timestamps).forEach(timestamp);
    shape(item.market, ['priceUsd', 'marketCapUsd', 'quoteLiquidityUsd']);
    for (const value of Object.values(item.market)) if (value !== null && (typeof value !== 'string' || value.length > 100 || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))) invalid();
    shape(item.assessment, ['score', 'tier', 'entryScore', 'entryVerdict', 'entryVersion', 'decisionVerdict', 'reasonCodes', 'riskCodes']);
    score(item.assessment.score); score(item.assessment.entryScore);
    for (const key of ['tier', 'entryVerdict', 'decisionVerdict']) label(item.assessment[key], 64);
    const version = item.assessment.entryVersion;
    if (typeof version === 'number') { if (!Number.isFinite(version) || version < 0) invalid(); } else label(version, 64);
    codes(item.assessment.reasonCodes); codes(item.assessment.riskCodes); codes(item.unknowns);
    if (!item.unknowns.includes('registry_unverified') || !item.unknowns.includes('sellability_unverified')) invalid();
  }
  return data;
}

export function createAnalysisClient(request = fetch, now = Date.now) {
  const cache = new Map(); const pending = new Map();
  return async (snapshot = null) => {
    if (snapshot !== null && !HASH.test(snapshot)) throw failure(400, 'invalid_snapshot', 'Некорректный идентификатор снимка.');
    const key = snapshot ?? 'latest';
    const cached = cache.get(key);
    if (cached && now() - cached.at < 5000) return structuredClone(cached.value);
    if (pending.has(key)) return structuredClone(await pending.get(key));
    if (pending.size >= 16) throw failure(503, 'analysis_busy', 'Источник анализа занят. Повторите позже.');
    const operation = (async () => {
      const endpoint = new URL('https://aistat.app/crypto/api/analysis/v1');
      endpoint.searchParams.set('chainId', '4663');
      if (snapshot) endpoint.searchParams.set('snapshot', snapshot);
      let response;
      try {
        response = await request(endpoint.href, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8000) });
      } catch { throw failure(503, 'analysis_unavailable', 'Общий анализ временно недоступен.'); }
      if (response.status === 410) throw failure(410, 'snapshot_expired', 'Этот снимок больше не хранится. Можно отдельно загрузить текущий анализ.');
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw failure(503, 'analysis_unavailable', 'Источник общего анализа пока недоступен.');
      let data;
      try {
        data = validateAnalyses(await boundedJson(response, 2097152));
        if (snapshot && data.snapshotId !== snapshot) invalid();
      } catch { throw failure(502, 'analysis_schema_invalid', 'Источник вернул неподтверждённый формат анализа.'); }
      cache.set(key, { at: now(), value: data });
      while (cache.size > 13) cache.delete(cache.keys().next().value);
      return data;
    })();
    pending.set(key, operation);
    try { return structuredClone(await operation); } finally { pending.delete(key); }
  };
}
