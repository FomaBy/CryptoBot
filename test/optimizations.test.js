import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import { STUDY_ID, optimizationParams, validateOptimization, createOptimizationClient } from '../server/optimizations.js';
import { createStore } from '../server/store.js';
import { createBacktestStore } from '../server/backtest-store.js';
import { createApp } from '../server/app.js';

// Schema fixture is entirely synthetic; pinned dataset ID exercises production contract checks,
// it is not evidence of an actual study or real trading returns.
const fixture = () => JSON.parse(readFileSync(new URL('./optimization-report.fixture.json', import.meta.url)));
test('finite study consumer preserves all 48 trials and rejects changed evidence, privacy, costs and accounting', () => {
  const report=fixture(); assert.deepEqual(validateOptimization(report),report);
  const changes=[d=>d.walletNames=[],d=>d.trials.pop(),d=>d.trials[0].privateLabel='fake',d=>d.datasetId='f'.repeat(64),
    d=>d.manifest.grid.ratings=[1,2],d=>d.assumptions.costs.taxPct='0',d=>d.promotionAuthorized=true,d=>d.executionAuthorized=true,
    d=>d.trials[0].metrics.endingCashUsd='99999',d=>d.trials[0].metrics.accountingPriceContributionUsd='99999',
    d=>d.trials[1]=structuredClone(d.trials[0]),d=>d.trials[0].candidateId='f'.repeat(64),d=>d.trials[0].parameterHash='f'.repeat(64),d=>d.trials[0].trialId='f'.repeat(64),d=>d.trials[0].diagnostics.baselineDeltaUsd='1',d=>d.futureOos.status='passed',d=>d.futureOos.eligibleAfter=d.selection.selectedAt];
  for(const mutate of changes){const d=fixture();mutate(d);assert.throws(()=>validateOptimization(d));}
  assert.throws(()=>optimizationParams({studyId:'best-winner'}),{status:400});
});

test('source drift with freshly recomputed content hash still cannot change the reviewed evaluator exits or selection',()=>{
  for(const mutate of [d=>d.evaluatorHash='0'.repeat(64),d=>d.assumptions.exits.C.stopPct=0,d=>d.selection.rankedCandidateIds=[]]){
    const d=fixture();mutate(d);const{reportId,generatedAt,...frozen}=d;d.reportId=createHash('sha256').update(JSON.stringify(frozen)).digest('hex');assert.throws(()=>validateOptimization(d));
  }
});

test('failed trials remain in the fixed grid and cannot become successful candidates',()=>{
  const d=fixture(), t=d.trials[0];t.computationStatus='failed';t.error='evaluation_failed';t.metrics=null;
  t.diagnostics={skipped:{},baselineDeltaUsd:null,accountingBridge:'net_plus_modeled_costs_not_costfree_rerun',behaviorHash:null,entryDelaySec:null,finalExitDelaySec:null,holdingSecs:null};
  d.computationStatus='failed';d.selection.selectedCandidateId=null;d.selection.rankedCandidateIds=d.selection.rankedCandidateIds.filter(id=>id!==t.candidateId);d.selection.selectedCandidateId=d.selection.rankedCandidateIds[0]??null;
  for(const x of d.trials)if(x.preset===t.preset&&x.scenario===t.scenario)x.diagnostics.baselineDeltaUsd=null;
  const{reportId,generatedAt,...frozen}=d;d.reportId=createHash('sha256').update(JSON.stringify(frozen)).digest('hex');
  assert.equal(validateOptimization(d).trials.length,48);
  const broken=structuredClone(d);broken.computationStatus='complete';assert.throws(()=>validateOptimization(broken));
});

test('optimization source is fixed HTTPS, coalesced, bounded and never forwards account credentials', async()=>{
  let calls=0;
  const client=createOptimizationClient(async(url,options)=>{calls++;assert.equal(url,`https://aistat.app/crypto/api/optimization/v1?studyId=${STUDY_ID}`);
    assert.deepEqual(options.headers,{accept:'application/json'});assert.equal(options.redirect,'error');
    return new Response(JSON.stringify(fixture()),{headers:{'content-type':'application/json'}});});
  const [a,b]=await Promise.all([client({studyId:STUDY_ID}),client({studyId:STUDY_ID})]);assert.deepEqual(a,b);assert.equal(calls,1);
  a.trials.pop();assert.equal((await client({studyId:STUDY_ID})).trials.length,48);
  const invalid=createOptimizationClient(async()=>new Response(JSON.stringify({...fixture(),seed:'not-real'}),{headers:{'content-type':'application/json'}}));
  await assert.rejects(invalid({studyId:STUDY_ID}),{code:'optimization_schema_invalid'});
});

test('optimization storage remains separate, account bound, bounded and rejects arbitrary SQL table names',()=>{
  const store=createStore(':memory:');try{
    store.account('a');store.account('b');const runs=createBacktestStore(store.db,'optimization');const bt=createBacktestStore(store.db);
    assert.throws(()=>createBacktestStore(store.db,'accounts;DELETE'));const key=randomUUID();const p={studyId:STUDY_ID};
    const first=runs.reserve('a',key,p);assert.equal(runs.reserve('a',key,p).created,false);
    assert.equal(runs.get('b',first.run.id),null);assert.deepEqual(bt.list('a'),[]);
    runs.finish('a',first.run.id,fixture());assert.equal(runs.get('a',first.run.id).report.trials.length,48);
    for(let i=1;i<20;i++){const r=runs.reserve('a',randomUUID(),p);runs.finish('a',r.run.id,null,'source_unavailable');}
    assert.throws(()=>runs.reserve('a',randomUUID(),p),{code:'backtest_limit'});
  }finally{store.close();}
});

test('optimization API requires session and CSRF, freezes study, deduplicates jobs and hides other accounts',async t=>{
  const store=createStore(':memory:');let calls=0,release;
  const app=createApp({store,identity:async req=>req.headers['x-fixture']?{id:req.headers['x-fixture'],name:'Fixture',csrf:'fixture-token'}:null,
    optimizations:async()=>{calls++;await new Promise(r=>release=r);return fixture();}});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  t.after(async()=>{release?.();await app.backtestsIdle();app.closeAllConnections();await new Promise(r=>app.close(r));store.close();});
  const url=`http://127.0.0.1:${app.address().port}/bot/api/optimizations`;
  const call=async(suffix='',method='GET',body,actor='a',csrf='fixture-token')=>{const r=await fetch(url+suffix,{method,headers:{...(actor?{'x-fixture':actor}:{}),origin:'https://aistat.app','x-csrf-token':csrf,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return{status:r.status,body:await r.json()};};
  const body={studyId:STUDY_ID,idempotencyKey:randomUUID()};
  assert.equal((await call('','GET',undefined,'')).status,401);assert.equal((await call('','POST',body,'a','wrong')).status,403);
  assert.equal((await call('','POST',{...body,account_id:'b'})).status,400);assert.equal((await call('','POST',{...body,studyId:'invented'})).status,400);
  const first=await call('','POST',body);assert.equal(first.status,202);const id=first.body.run.id;
  assert.equal((await call('','POST',body)).body.run.id,id);assert.equal(calls,1);
  assert.equal((await call('/'+id,'GET',undefined,'b')).status,404);assert.equal((await call('/'+id,'DELETE',undefined,'b')).status,404);
  release();await app.backtestsIdle();assert.equal((await call('/'+id)).body.run.report.trials.length,48);
  assert.equal((await call('/'+id,'DELETE')).status,200);
});
