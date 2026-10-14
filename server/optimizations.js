import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { boundedJson } from './http-json.js';

export const STUDY_ID = 'acs-entry65-exploratory-20261009-v1';
const ENVELOPE = JSON.parse(readFileSync(new URL('../docs/research/optimization-envelope-v1.json', import.meta.url), 'utf8'));
const COMMIT = '0217aa53190b21fc5ef5ed97a2a9c42be9e9183e';
const MANIFEST = 'e1a9c4b0ef051e676188fc646ff4e9fb9ae63b8242391352aa0a2c5b81e4d1bd';
const DATASET = 'abee8f6b9c4d6e27732d59cb17a2c44b8a9f3d51f6a915104bbda44005906d15';
const error = (code, message, status = 503) => Object.assign(new Error(message), { code, status });
export function optimizationParams(input) {
  if (input?.studyId !== STUDY_ID) throw error('invalid_study', 'Выберите зарегистрированное исследование.', 400);
  return { studyId: STUDY_ID };
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const check = (yes) => { if (!yes) throw new Error('optimization_contract'); };
const shape = (v, keys) => check(v && !Array.isArray(v) && typeof v === 'object' && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)));
const hash = v => check(typeof v === 'string' && /^[0-9a-f]{64}$/.test(v));
const stamp = v => check(typeof v === 'string' && v.length <= 32 && new Date(v).toISOString() === v);
const count = v => check(Number.isSafeInteger(v) && v >= 0);
const decimal = v => check(typeof v === 'string' && /^-?(0|[1-9]\d*)(\.\d{1,8})?$/.test(v) && v.length < 40);
const units = v => { decimal(v); const [a,b=''] = v.replace('-', '').split('.'); return (v.startsWith('-') ? -1n : 1n) * (BigInt(a)*100000000n + BigInt(b.padEnd(8,'0'))); };
const codes = v => check(Array.isArray(v) && v.length <= 80 && v.every(x => typeof x === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(x) && !/0x[0-9a-f]{8}/i.test(x)));
const stats = v => { if (v === null) return; shape(v,['min','median','max']); check(Object.values(v).every(x => Number.isFinite(x) && x >= 0) && v.min <= v.median && v.median <= v.max); };

// Only the aggregate, versioned public report crosses the private ACS boundary.
export function validateOptimization(d, params = { studyId: STUDY_ID }) {
  optimizationParams(params);
  check(JSON.stringify(d.manifest) === JSON.stringify(ENVELOPE));
  shape(d, ['schemaVersion','source','chainId','preregistration','period','datasetId','evaluatorHash','sourceProfileHashes','computationStatus','evidenceStatus','coverage','grid','trials','selection','futureOos','unknowns','executionAuthorized','promotionAuthorized','reportId','generatedAt','assumptions','manifest']);
  check(d.schemaVersion === 'acs.optimization.v1' && d.chainId === 4663 && d.executionAuthorized === false && d.promotionAuthorized === false && d.evidenceStatus === 'insufficient_evidence');
  for (const k of ['reportId','datasetId','evaluatorHash']) hash(d[k]);
  check(d.datasetId === DATASET && d.evaluatorHash === '74994218cc539d214afc7316a70a93156f84c26d4b608a3f942de3cc895fc738'); stamp(d.generatedAt);
  shape(d.source,['id','revision']); check(d.source.id === 'ai-crypto-statistics' && (d.source.revision === null || /^[0-9a-f]{40}$/.test(d.source.revision)));
  shape(d.preregistration,['studyId','commit','manifestHash','registeredAt']);
  check(d.preregistration.studyId === STUDY_ID && d.preregistration.commit === COMMIT && d.preregistration.manifestHash === MANIFEST && d.preregistration.registeredAt === '2026-10-09T17:55:00.000Z');
  shape(d.period,['requestedFrom','from','end']);
  check(d.period.requestedFrom === '2026-09-25T17:21:00.000Z' && d.period.end === '2026-10-09T17:21:00.000Z');
  if (d.period.from !== null) { stamp(d.period.from); check(d.period.from >= d.period.requestedFrom && d.period.from < d.period.end); }
  shape(d.sourceProfileHashes,['C','FIXED']); Object.values(d.sourceProfileHashes).forEach(hash);
  check(['complete','truncated','failed'].includes(d.computationStatus)); codes(d.unknowns);
  shape(d.grid,['ratings','exits','entryDelaysSec','presets','scenarios','candidateCount','trialCount']);
  for (const [key,expected] of Object.entries({ratings:[65,75],exits:['C','FIXED'],entryDelaysSec:[5,15],presets:[150,1000,5000],scenarios:['base','stress']})) check(JSON.stringify(d.grid[key]) === JSON.stringify(expected));
  check(d.grid.candidateCount === 8 && d.grid.trialCount === 48 && Array.isArray(d.trials) && d.trials.length === 48);
  validateCoverage(d.coverage); validateAssumptions(d.assumptions);
  const combinations = new Set(), ids = new Set(), candidates = new Set();
  for (const t of d.trials) {
    shape(t,['trialId','candidateId','parameterHash','preset','scenario','parameters','sourceProfileHash','modelHash','computationStatus','evidenceStatus','error','metrics','diagnostics']);
    for (const k of ['trialId','candidateId','parameterHash','sourceProfileHash','modelHash']) hash(t[k]);
    shape(t.parameters,['rating','exit','entryDelaySec']);
    check([65,75].includes(t.parameters.rating) && ['C','FIXED'].includes(t.parameters.exit) && [5,15].includes(t.parameters.entryDelaySec) && [150,1000,5000].includes(t.preset) && ['base','stress'].includes(t.scenario));
    check(t.candidateId===digest(t.parameters) && t.parameterHash===digest({...t.parameters,scenario:t.scenario}) && t.trialId===digest({candidateId:t.candidateId,preset:t.preset,scenario:t.scenario}));
    const key = `${t.parameters.rating}/${t.parameters.exit}/${t.parameters.entryDelaySec}/${t.preset}/${t.scenario}`;
    check(!combinations.has(key) && !ids.has(t.trialId)); combinations.add(key); ids.add(t.trialId); candidates.add(t.candidateId);
    check(t.sourceProfileHash === d.sourceProfileHashes[t.parameters.exit] && ['complete','truncated','failed'].includes(t.computationStatus) && t.evidenceStatus === 'insufficient_evidence');
    check(t.error === null || t.error === 'evaluation_failed');
    if (t.metrics === null) check(t.computationStatus === 'failed');
    else {
      const m=t.metrics;
      shape(m,['initialUsd','endingCashUsd','totalCostsUsd','conservativeNetPnlUsd','realizedPnlUsd','unrealizedWriteDownUsd','maxDrawdownUsd','noTradePnlUsd','economicNetPnlUsd','closedTrades','writeDowns','tradeCount','rejectedSignals','unpricedPositions','accountingPriceContributionUsd']);
      for (const k of ['initialUsd','endingCashUsd','totalCostsUsd','conservativeNetPnlUsd','realizedPnlUsd','unrealizedWriteDownUsd','maxDrawdownUsd','noTradePnlUsd','accountingPriceContributionUsd']) decimal(m[k]);
      for (const k of ['closedTrades','writeDowns','tradeCount','rejectedSignals','unpricedPositions']) count(m[k]);
      check(m.initialUsd === String(t.preset) && m.noTradePnlUsd === '0' && m.economicNetPnlUsd === null);
      check(units(m.endingCashUsd)-units(m.initialUsd) === units(m.conservativeNetPnlUsd) && units(m.realizedPnlUsd)+units(m.unrealizedWriteDownUsd) === units(m.conservativeNetPnlUsd));
      check(units(m.conservativeNetPnlUsd)+units(m.totalCostsUsd) === units(m.accountingPriceContributionUsd));
      check(units(m.endingCashUsd)>=0n && units(m.totalCostsUsd)>=0n && units(m.maxDrawdownUsd)>=0n && units(m.unrealizedWriteDownUsd)<=0n);
    }
    const x=t.diagnostics; shape(x,['skipped','baselineDeltaUsd','accountingBridge','behaviorHash','entryDelaySec','finalExitDelaySec','holdingSecs']);
    check(x.skipped && typeof x.skipped==='object' && !Array.isArray(x.skipped)); codes(Object.keys(x.skipped)); Object.values(x.skipped).forEach(count);
    check(x.accountingBridge === 'net_plus_modeled_costs_not_costfree_rerun');
    if (x.baselineDeltaUsd !== null) decimal(x.baselineDeltaUsd);
    if (x.behaviorHash !== null) hash(x.behaviorHash);
    ['entryDelaySec','finalExitDelaySec','holdingSecs'].forEach(k=>stats(x[k]));
  }
  check(candidates.size===8);
  for(const id of candidates)check(d.trials.filter(t=>t.candidateId===id).length===6);
  for(const t of d.trials){
    check((t.computationStatus==='failed')===(t.error==='evaluation_failed') && (t.metrics===null)===(t.computationStatus==='failed'));
    const champion=d.trials.find(x=>x.preset===t.preset&&x.scenario===t.scenario&&x.parameters.rating===65&&x.parameters.exit==='C'&&x.parameters.entryDelaySec===5);
    if(t.metrics&&champion.metrics)check(t.diagnostics.baselineDeltaUsd!==null&&units(t.diagnostics.baselineDeltaUsd)===units(t.metrics.conservativeNetPnlUsd)-units(champion.metrics.conservativeNetPnlUsd));
    else check(t.diagnostics.baselineDeltaUsd===null);
  }
  const expectedStatus=d.trials.some(t=>t.computationStatus==='failed')?'failed':d.trials.some(t=>t.computationStatus==='truncated')?'truncated':'complete';
  check(d.computationStatus===expectedStatus);
  const {reportId,generatedAt,...frozen}=d;check(reportId===digest(frozen));
  const s=d.selection; shape(s,['procedure','rankedCandidateIds','selectedCandidateId','selectedAt','recommendation','reasonCodes']);
  check(s.procedure==='exploratory_min_preset_scenario_return_then_drawdown_v1' && s.recommendation==='no_promotion'); stamp(s.selectedAt); codes(s.reasonCodes);
  check(Array.isArray(s.rankedCandidateIds) && s.rankedCandidateIds.length<=8 && new Set(s.rankedCandidateIds).size===s.rankedCandidateIds.length && s.rankedCandidateIds.every(x=>candidates.has(x)));
  check(s.selectedCandidateId===null || candidates.has(s.selectedCandidateId));
  // Independently verify the preregistered aggregate ranking using exact rational USD values.
  const compare=(a,b)=>{const delta=a.n*b.d-b.n*a.d;return delta<0n?-1:delta>0n?1:0;};
  const ranked=[...candidates].map(id=>{
    const group=d.trials.filter(t=>t.candidateId===id);
    if(group.some(t=>t.computationStatus!=='complete'||!t.metrics||t.metrics.closedTrades<1))return null;
    const ratios=key=>group.map(t=>({n:units(t.metrics[key]),d:BigInt(t.preset)}));
    return{id,worst:ratios('conservativeNetPnlUsd').sort(compare)[0],dd:ratios('maxDrawdownUsd').sort(compare).at(-1),unpriced:group.some(t=>t.metrics.unpricedPositions>0)};
  }).filter(Boolean).sort((a,b)=>compare(b.worst,a.worst)||compare(a.dd,b.dd)||a.id.localeCompare(b.id));
  check(JSON.stringify(s.rankedCandidateIds)===JSON.stringify(ranked.map(x=>x.id)));
  const best=ranked[0];check(s.selectedCandidateId===(best&&best.worst.n>0n&&!best.unpriced?best.id:null));
  if (s.selectedCandidateId) check(d.trials.filter(t=>t.candidateId===s.selectedCandidateId).every(t=>t.computationStatus==='complete' && t.metrics?.closedTrades>0 && units(t.metrics.conservativeNetPnlUsd)>0n && t.metrics.unpricedPositions===0));
  const f=d.futureOos; shape(f,['status','eligibleAfter','embargoSec','alreadyViewedDataExcluded']); stamp(f.eligibleAfter);
  check(f.status==='not_started' && f.embargoSec===4500 && f.alreadyViewedDataExcluded===true && Date.parse(f.eligibleAfter)===Date.parse(s.selectedAt)+4500000);
  return d;
}

function validateCoverage(c) {
  shape(c,['rows','selectedRows','totalRows','tokens','totalTokens','excludedTokens','firstAt','lastAt','daily','rated','priced','liquid','truncated','fullWindow','maxGapSec','missingDays','reasons','selection','metricsBasis','maxRows','maxTokens']);
  ['rows','selectedRows','totalRows','tokens','totalTokens','excludedTokens','rated','priced','liquid','maxRows','maxTokens'].forEach(k=>count(c[k]));
  check(c.maxRows<=250000 && c.rows<=c.maxRows && c.maxTokens<=500 && typeof c.truncated==='boolean' && typeof c.fullWindow==='boolean' && Number.isFinite(c.maxGapSec) && c.maxGapSec>=0);
  check(c.selection==='historical_entry_candidates_before_outcomes' && c.metricsBasis==='selected_pons_observations');
  if(c.firstAt!==null)stamp(c.firstAt);if(c.lastAt!==null)stamp(c.lastAt);codes(c.reasons);
  check(Array.isArray(c.daily)&&c.daily.length<=16 && Array.isArray(c.missingDays)&&c.missingDays.length<=16);
  c.missingDays.forEach(x=>check(/^\d{4}-\d{2}-\d{2}$/.test(x)));
  for(const d of c.daily){shape(d,['day','rows','tokens','rated','priced','liquid']);check(/^\d{4}-\d{2}-\d{2}$/.test(d.day));['rows','tokens'].forEach(k=>count(d[k]));['rated','priced','liquid'].forEach(k=>{if(d[k]!==null)count(d[k]);});}
}

function validateAssumptions(a) {
  shape(a,['costs','risk','stress','exits','unsupportedGates','guards']);
  shape(a.costs,['feePct','taxPct','slippagePct','gasUsd','impactModel','actualHistoricalFeesVerified']);
  check(a.costs.feePct==='1'&&a.costs.taxPct==='10'&&a.costs.slippagePct==='1'&&a.costs.gasUsd==='0.03'&&a.costs.impactModel==='qliq_proxy'&&a.costs.actualHistoricalFeesVerified===false);
  shape(a.risk,['maxOpen','maxExposurePct','dailyLossPct','maxTradesPerDay','exitGasReserveUsd','oneEntryPerToken']);
  check(a.risk.maxOpen===3&&a.risk.maxExposurePct==='20'&&a.risk.dailyLossPct==='20'&&a.risk.maxTradesPerDay===100&&a.risk.exitGasReserveUsd==='0.06'&&a.risk.oneEntryPerToken===true);
  shape(a.stress,['liquidityMultiplier','slippageMultiplier','additionalEntryDelaySec','additionalExitDelaySec']);
  check(a.stress.liquidityMultiplier===0.5&&a.stress.slippageMultiplier===2&&a.stress.additionalEntryDelaySec===10&&a.stress.additionalExitDelaySec===10);
  shape(a.exits,['C','FIXED']);
  shape(a.exits.C,['kind','stopPct','timeMin','take1X','take1Frac','take2X','trailPct','runnerMaxMin']);
  shape(a.exits.FIXED,['kind','stopPct','timeMin','tpX']);
  for(const [key,value] of Object.entries({kind:'C',stopPct:40,timeMin:30,take1X:1.5,take1Frac:0.75,take2X:2,trailPct:20,runnerMaxMin:15}))check(a.exits.C[key]===value);
  for(const [key,value] of Object.entries({kind:'FIXED',stopPct:40,timeMin:60,tpX:2}))check(a.exits.FIXED[key]===value);
  for(const x of Object.values(a.exits))for(const [k,v] of Object.entries(x))if(k!=='kind')check(Number.isFinite(v)&&v>=0&&v<=100000);
  codes(a.unsupportedGates);
  const g=a.guards;shape(g,['ratingVersions','canEnterRequired','stage','maxMarketCapUsd','rejectUnknown','maxGapSec','exitDelaySec','entrySizesUsd']);
  check(JSON.stringify(g.ratingVersions)==='[2]'&&g.canEnterRequired===true&&g.stage==='graduated'&&g.maxMarketCapUsd==='100000'&&g.rejectUnknown==='deny'&&g.maxGapSec===600&&g.exitDelaySec===5);
  shape(g.entrySizesUsd,['150','1000','5000']);check(g.entrySizesUsd['150']==='10'&&g.entrySizesUsd['1000']==='50'&&g.entrySizesUsd['5000']==='250');
}

export function createOptimizationClient(request=fetch) {
  let pending=null, cached=null;
  return async params=>{
    optimizationParams(params);
    if(cached)return structuredClone(cached);
    if(pending)return structuredClone(await pending);
    pending=(async()=>{
      let response;
      try{ response=await request(`https://aistat.app/crypto/api/optimization/v1?studyId=${STUDY_ID}`,{headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(95000)}); }
      catch{throw error('optimization_unavailable','Исследование пока недоступно. Повторите позже.');}
      if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw error('optimization_unavailable','Источник занят или исследование недоступно. Повторите позже.');
      try{return validateOptimization(await boundedJson(response,2097152),params);}
      catch{throw error('optimization_schema_invalid','Источник вернул несовместимый отчёт; результат не принят.');}
    })();
    try{cached=await pending;return structuredClone(cached);}finally{pending=null;}
  };
}
