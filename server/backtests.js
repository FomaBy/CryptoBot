import { boundedJson } from './http-json.js';

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const HASH = /^[0-9a-f]{64}$/;
export function backtestParams(input, now = Date.now()) {
  if (!input || !['strict', 'scenario'].includes(input.mode) || !['14d', 'available'].includes(input.window) ||
      ![150, 1000, 5000].includes(input.preset) || !Number.isSafeInteger(input.end) || input.end % 60000 !== 0 || input.end > now || input.end < now - 15 * 60000) {
    throw fail(400, 'invalid_backtest', 'Обновите покрытие и выберите период, режим и бюджет.');
  }
  return { mode: input.mode, window: input.window, preset: input.preset, end: input.end };
}

const shape = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new Error('backtest_schema');
};
const stamp = value => { if (value !== null && (typeof value !== 'string' || value.length > 32 || new Date(value).toISOString() !== value)) throw new Error('backtest_timestamp'); };
const codes = value => { if (!Array.isArray(value) || value.length > 80 || value.some(x => typeof x !== 'string' || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(x) || /0x[0-9a-f]{8}/i.test(x))) throw new Error('backtest_codes'); };
const decimal = value => { if (value !== null && (typeof value !== 'string' || value.length > 100 || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))) throw new Error('backtest_decimal'); };
const count = value => { if (!Number.isSafeInteger(value) || value < 0) throw new Error('backtest_count'); };

// The public consumer implements a data contract, never imports the private ACS strategy engine.
export function validateBacktest(data, params) {
  shape(data, ['schemaVersion', 'reportId', 'datasetId', 'source', 'chainId', 'mode', 'window', 'preset', 'period', 'generatedAt', 'status', 'computationStatus', 'coverage', 'assumptions', 'result', 'unknowns', 'executionAuthorized']);
  if (data.schemaVersion !== 'acs.backtest.v1' || !HASH.test(data.reportId) || !HASH.test(data.datasetId) || data.chainId !== 4663 || data.executionAuthorized !== false ||
      data.mode !== params.mode || data.window !== params.window || data.preset !== params.preset || !['coverage_only', 'insufficient_evidence', 'scenario_complete'].includes(data.status)) throw new Error('backtest_contract');
  shape(data.source, ['id', 'revision']);
  if (data.source.id !== 'ai-crypto-statistics' || (data.source.revision !== null && !/^[0-9a-f]{40}$/.test(data.source.revision))) throw new Error('backtest_source');
  shape(data.period, ['requestedFrom', 'from', 'end']); Object.values(data.period).forEach(stamp); stamp(data.generatedAt);
  if (Date.parse(data.period.end) !== params.end || Date.parse(data.period.requestedFrom) !== params.end - 14 * 86400000 ||
      (data.period.from !== null && (Date.parse(data.period.from) < Date.parse(data.period.requestedFrom) || Date.parse(data.period.from) >= params.end))) throw new Error('backtest_period');
  if (!['complete', 'truncated'].includes(data.computationStatus)) throw new Error('backtest_computation');
  codes(data.unknowns);
  // Remaining report sections have a separately maintained allowlist below.
  validateSections(data);
  return data;
}

function validateSections(data) {
  const c = data.coverage;
  shape(c, ['rows', 'selectedRows', 'totalRows', 'tokens', 'totalTokens', 'excludedTokens', 'firstAt', 'lastAt', 'daily', 'rated', 'priced', 'liquid', 'truncated', 'fullWindow', 'maxGapSec', 'missingDays', 'reasons', 'selection', 'metricsBasis', 'maxRows', 'maxTokens']);
  for (const key of ['rows', 'selectedRows', 'totalRows', 'tokens', 'totalTokens', 'excludedTokens', 'rated', 'priced', 'liquid', 'maxRows', 'maxTokens']) count(c[key]);
  stamp(c.firstAt); stamp(c.lastAt); codes(c.reasons);
  if (typeof c.truncated !== 'boolean' || typeof c.fullWindow !== 'boolean' || !Number.isFinite(c.maxGapSec) || c.maxGapSec < 0 || c.rows > c.maxRows || c.maxRows > 250000 || c.maxTokens > 500 ||
      c.selection !== 'historical_entry_candidates_before_outcomes' || c.metricsBasis !== 'selected_pons_observations' || !Array.isArray(c.daily) || c.daily.length > 16 || !Array.isArray(c.missingDays) || c.missingDays.length > 16) throw new Error('backtest_coverage');
  for (const day of c.missingDays) if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('backtest_day');
  for (const day of c.daily) {
    shape(day, ['day', 'rows', 'tokens', 'rated', 'priced', 'liquid']);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.day)) throw new Error('backtest_day');
    count(day.rows); count(day.tokens); for (const key of ['rated', 'priced', 'liquid']) if (day[key] !== null) count(day[key]);
  }
  const a = data.assumptions;
  shape(a, ['strategy', 'profile', 'profileVersion', 'profileApproximation', 'unsupportedGates', 'costVersion', 'priceBasis', 'initialUsd', 'entryUsd', 'feePct', 'taxPct', 'slippagePct', 'gasUsd', 'delaySec', 'exitDelaySec', 'maxGapSec', 'maxHoldSec', 'takeProfitPct', 'stopLossPct', 'impactModel', 'maxOpen', 'maxExposurePct', 'dailyLossUsd', 'entryThreshold', 'canEnterRequired', 'ratingVersions', 'maxMarketCapUsd', 'rejectedUnknownPolicy', 'oneEntryPerToken', 'maxTradesPerDay', 'accountLimitsAreScenarioOverlay', 'scenarioAlgorithm', 'partialFractionBasis', 'gasPerSale', 'runnerClockBasis', 'exitFillBasis', 'sourceProfileHash', 'strategyVersion', 'modelHash', 'monetaryLedger', 'rounding', 'exitGasReserveUsd']);
  for (const key of ['profileVersion', 'sourceProfileHash', 'strategyVersion', 'modelHash']) if (!HASH.test(a[key])) throw new Error('backtest_version');
  if (a.profileVersion !== a.sourceProfileHash || a.strategyVersion !== a.modelHash || a.strategy !== 'ENTRY65_DEX' || a.profileApproximation !== true || a.priceBasis !== 'recorded_observation' || a.impactModel !== 'qliq_proxy' || a.rejectedUnknownPolicy !== 'deny' || a.scenarioAlgorithm !== 'acs-offline-entry65-c-v1' || a.costVersion !== 'acs-scenario-cost-v1' || a.partialFractionBasis !== 'initial_position' || a.runnerClockBasis !== 'observed_first_partial_fill' || a.exitFillBasis !== 'next_observation_after_delay') throw new Error('backtest_model');
  if (a.monetaryLedger !== 'USD_1e8_integer' || a.rounding !== 'cost_up_proceeds_down') throw new Error('backtest_ledger');
  decimal(a.exitGasReserveUsd);
  codes(a.unsupportedGates);
  for (const key of ['initialUsd', 'entryUsd', 'feePct', 'taxPct', 'slippagePct', 'gasUsd', 'takeProfitPct', 'stopLossPct', 'maxExposurePct', 'dailyLossUsd', 'maxMarketCapUsd']) decimal(a[key]);
  if (a.initialUsd !== String(data.preset) || a.entryUsd !== String({150:10,1000:50,5000:250}[data.preset])) throw new Error('backtest_budget');
  for (const key of ['delaySec', 'exitDelaySec', 'maxGapSec', 'maxHoldSec', 'maxOpen', 'entryThreshold', 'maxTradesPerDay']) count(a[key]);
  for (const key of ['canEnterRequired', 'oneEntryPerToken', 'accountLimitsAreScenarioOverlay', 'gasPerSale']) if (a[key] !== true) throw new Error('backtest_policy');
  const versions = value => { if (!Array.isArray(value) || value.length !== 1 || value[0] !== 2) throw new Error('backtest_rating_version'); };
  versions(a.ratingVersions);
  const p = a.profile;
  shape(p, ['id', 'role', 'entry', 'exit', 'hard', 'exitLatencySec', 'maxMcapUsd', 'lateMin', 'onePerToken']);
  if (p.id !== 'ENTRY65_DEX' || p.role !== 'champion' || p.onePerToken !== true) throw new Error('backtest_profile');
  for (const key of ['exitLatencySec', 'maxMcapUsd', 'lateMin']) count(p[key]);
  shape(p.entry, ['kind', 'route', 'launchpad', 'needCanEnter', 'minScore', 'windowSec', 'ratingVersions', 'latencySec']);
  if (p.entry.kind !== 'RATING' || p.entry.route !== 'G' || p.entry.launchpad !== 'pons' || p.entry.needCanEnter !== true) throw new Error('backtest_entry');
  versions(p.entry.ratingVersions); for (const key of ['minScore', 'windowSec', 'latencySec']) count(p.entry[key]);
  shape(p.exit, ['kind', 'stopPct', 'timeMin', 'take1X', 'take1Frac', 'take2X', 'trailPct', 'runnerMaxMin']);
  if (p.exit.kind !== 'C') throw new Error('backtest_exit');
  for (const [key, value] of Object.entries(p.exit)) if (key !== 'kind' && (!Number.isFinite(value) || value < 0 || value > 100000)) throw new Error('backtest_exit');
  shape(p.hard, ['lpPull', 'scam', 'vetoAfter', 'devDump', 'knife', 'ban']);
  if (Object.values(p.hard).some(v => v !== true)) throw new Error('backtest_hard');
  if (data.result === null) { if (data.mode === 'scenario' && !(data.window === '14d' && c.fullWindow === false) && c.rows !== 0) throw new Error('backtest_missing_result'); return; }
  if (data.mode !== 'scenario') throw new Error('backtest_unexpected_result');
  const r = data.result;
  shape(r, ['initialUsd', 'endingCashUsd', 'netPnlUsd', 'realizedPnlUsd', 'unrealizedWriteDownUsd', 'conservativeNetPnlUsd', 'economicNetPnlUsd', 'noTradePnlUsd', 'totalCostsUsd', 'maxDrawdownUsd', 'closedTrades', 'writeDowns', 'rejectedSignals', 'skipped', 'unpricedPositions', 'trades', 'tradeCount', 'tradesTruncated', 'equity']);
  for (const key of ['initialUsd', 'endingCashUsd', 'netPnlUsd', 'realizedPnlUsd', 'unrealizedWriteDownUsd', 'conservativeNetPnlUsd', 'economicNetPnlUsd', 'noTradePnlUsd', 'totalCostsUsd', 'maxDrawdownUsd']) decimal(r[key]);
  for (const key of ['closedTrades', 'writeDowns', 'rejectedSignals', 'unpricedPositions', 'tradeCount']) count(r[key]);
  if (r.initialUsd !== a.initialUsd || r.noTradePnlUsd !== '0' || r.economicNetPnlUsd !== null || typeof r.tradesTruncated !== 'boolean' || !r.skipped || Array.isArray(r.skipped) || Object.keys(r.skipped).length > 30) throw new Error('backtest_result');
  codes(Object.keys(r.skipped)); Object.values(r.skipped).forEach(count);
  if (!Array.isArray(r.trades) || r.trades.length > 200 || !Array.isArray(r.equity) || r.equity.length > 301) throw new Error('backtest_report_limit');
  for (const t of r.trades) {
    shape(t, ['tokenId', 'address', 'signalAt', 'entryAt', 'exitDecisionAt', 'exitAt', 'accountedAt', 'entryPriceUsd', 'exitPriceUsd', 'sizeUsd', 'entryCostUsd', 'proceedsUsd', 'realizedPnlUsd', 'writeDownUsd', 'reason', 'status', 'costsUsd', 'sales']);
    if (!/^0x[0-9a-f]{40}$/.test(t.address) || t.tokenId !== `eip155:4663/erc20:${t.address}` || !['closed', 'write_down'].includes(t.status)) throw new Error('backtest_trade');
    codes([t.reason]); for (const key of ['signalAt', 'entryAt', 'exitDecisionAt', 'exitAt', 'accountedAt']) stamp(t[key]);
    for (const key of ['entryPriceUsd', 'exitPriceUsd', 'sizeUsd', 'entryCostUsd', 'proceedsUsd', 'realizedPnlUsd', 'writeDownUsd', 'costsUsd']) decimal(t[key]);
    if (Date.parse(t.entryAt) < Date.parse(t.signalAt) + a.delaySec * 1000 || (t.status === 'write_down' && (t.exitAt !== null || t.exitPriceUsd !== null))) throw new Error('backtest_causality');
    if (!Array.isArray(t.sales) || t.sales.length > 2) throw new Error('backtest_sales');
    for (const sale of t.sales) { shape(sale, ['at', 'priceUsd', 'fraction', 'proceedsUsd', 'costsUsd']); stamp(sale.at); for (const key of ['priceUsd', 'fraction', 'proceedsUsd', 'costsUsd']) decimal(sale[key]); }
  }
  for (const point of r.equity) { shape(point, ['at', 'equityUsd']); stamp(point.at); decimal(point.equityUsd); }
}

export function createBacktestClient(request = fetch, now = Date.now) {
  const pending = new Map(); const cache = new Map();
  return async params => {
    const key = JSON.stringify(params);
    const saved = cache.get(key);
    if (saved && now() - saved.at < 60000) return structuredClone(saved.data);
    if (pending.has(key)) return structuredClone(await pending.get(key));
    if (pending.size >= 3) throw fail(503, 'backtest_busy', 'Источник истории занят. Повторите позже.');
    const operation = (async () => {
      const endpoint = new URL('https://aistat.app/crypto/api/backtest/v1');
      for (const [key, value] of Object.entries(params)) endpoint.searchParams.set(key, String(value));
      let response;
      const started = Date.now();
      try {
        do {
          response = await request(endpoint.href, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(Math.max(1, 95000 - (Date.now() - started))) });
          if (response.status !== 429 || Date.now() - started >= 35000) break;
          await response.body?.cancel();
          await new Promise(resolve => setTimeout(resolve, 1000));
        } while (Date.now() - started < 35000);
      } catch { throw fail(503, 'backtest_unavailable', 'Не удалось прочитать историю в отведённое время.'); }
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw fail(503, 'backtest_unavailable', 'Источник истории временно недоступен.');
      let data;
      try { data = validateBacktest(await boundedJson(response, 2097152), params); }
      catch { throw fail(502, 'backtest_schema_invalid', 'Источник вернул неподтверждённый формат отчёта.'); }
      cache.set(key, { at: now(), data });
      while (cache.size > 6) cache.delete(cache.keys().next().value);
      return data;
    })();
    pending.set(key, operation);
    try { return structuredClone(await operation); } finally { pending.delete(key); }
  };
}
