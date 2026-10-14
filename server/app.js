import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { constantEqual, resolveIdentity } from './auth.js';
import { addressOf, makeChallenge, signatureMatches, isExternallyOwned } from './wallets.js';
import { networkStatus } from './network.js';
import { createAnalysisClient } from './analyses.js';
import { createBacktestClient, backtestParams } from './backtests.js';
import { createBacktestStore } from './backtest-store.js';
import { createOptimizationClient, optimizationParams } from './optimizations.js';

const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const error = (status, code, message) => Object.assign(new Error(message), { status, code });
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) || (required && !value.trim())) {
    throw error(400, 'invalid_input', 'Проверьте заполнение полей.');
  }
  return value.trim();
}
function fields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw error(400, 'invalid_input', 'Неизвестные поля запроса.');
}
async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw error(415, 'json_required', 'Ожидается JSON.');
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw error(413, 'body_too_large', 'Слишком большой запрос.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw error(400, 'invalid_json', 'Некорректный JSON.'); }
}

export function createApp({ store, origin = 'https://aistat.app', identity = resolveIdentity, verifyEOA = isExternallyOwned, network = networkStatus(), analyses = createAnalysisClient(), backtests = createBacktestClient(), optimizations = createOptimizationClient(), release = 'development' }) {
  const runs = createBacktestStore(store.db);
  const studies = createBacktestStore(store.db, 'optimization');
  const pendingRuns = new Set();
  const url = new URL(origin);
  if (url.origin !== origin || (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Invalid public origin');
  const server = createServer(async (req, res) => {
    res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'same-origin');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('cache-control', 'no-store');
    const json = (status, payload) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); };
    try {
      const requestUrl = new URL(req.url, origin);
      const path = requestUrl.pathname;
      if (req.method === 'GET' && path === '/bot') { res.writeHead(308, { location: '/bot/' }); res.end(); return; }
      if (req.method === 'GET' && path === '/bot/api/health') {
        json(200, { status: 'ok', release, liveEnabled: false, paperEnabled: false }); return;
      }
      const assets = { '/bot/': ['index.html', 'text/html'], '/bot/app.js': ['app.js', 'application/javascript'], '/bot/styles.css': ['styles.css', 'text/css'] };
      if (req.method === 'GET' && assets[path]) {
        const [file, type] = assets[path];
        res.writeHead(200, { 'content-type': type + '; charset=utf-8' }); res.end(await readFile(WEB + file)); return;
      }
      if (!path.startsWith('/bot/api/')) throw error(404, 'not_found', 'Не найдено.');
      // Every request revalidates the root session, including revoked sessions.
      const actor = await identity(req);
      if (!actor) {
        if (path === '/bot/api/session' && req.method === 'GET') { json(200, { authenticated: false, loginUrl: '/login?next=%2Fbot%2F' }); return; }
        throw error(401, 'authentication_required', 'Войдите в аккаунт.');
      }
      const account = store.account(actor.id);
      if (req.method === 'GET' && path === '/bot/api/analyses') {
        if ([...requestUrl.searchParams.keys()].some(key => key !== 'snapshot') || requestUrl.searchParams.getAll('snapshot').length > 1) throw error(400, 'invalid_query', 'Неизвестные параметры анализа.');
        if (!store.allowRate(`analyses:${actor.id}`, 30)) throw error(429, 'rate_limit', 'Слишком много запросов анализа. Повторите через минуту.');
        json(200, await analyses(requestUrl.searchParams.get('snapshot'))); return;
      }
      if (req.method === 'GET' && path === '/bot/api/session') {
        json(200, { authenticated: true, user: { id: actor.id, name: actor.name }, csrfToken: actor.csrf,
          capabilities: { historicalBacktest: true, boundedOptimization: true, walletLinking: true, taskCreation: true, settings: true, liveTrading: false, paperTrading: false, aiWorker: false } }); return;
      }
      let body;
      if (!['GET', 'HEAD'].includes(req.method)) {
        if (req.headers.origin !== origin || !constantEqual(req.headers['x-csrf-token'], actor.csrf)) throw error(403, 'csrf_rejected', 'Обновите страницу и повторите действие.');
        if (!store.allowRate(`mutate:${actor.id}`, 60)) throw error(429, 'rate_limit', 'Слишком много запросов. Повторите через минуту.');
        if (req.method !== 'DELETE') body = await readBody(req);
      }
      if (req.method === 'GET' && path === '/bot/api/optimizations') { json(200, { runs: studies.list(actor.id) }); return; }
      if (req.method === 'POST' && path === '/bot/api/optimizations') {
        fields(body, ['studyId', 'idempotencyKey']);
        const params = optimizationParams(body);
        if (typeof body.idempotencyKey !== 'string' || !uuid.test(body.idempotencyKey)) throw error(400, 'invalid_input', 'Нужен уникальный ключ запроса.');
        if (!store.allowRate(`optimization-run:${actor.id}`, 4)) throw error(429, 'rate_limit', 'Повторите запуск через минуту.');
        const reservation = studies.reserve(actor.id, body.idempotencyKey, params);
        if (reservation.created) {
          const operation = Promise.resolve().then(() => optimizations(params)).then(
            report => studies.finish(actor.id, reservation.run.id, report),
            () => studies.finish(actor.id, reservation.run.id, null, 'source_unavailable')
          ).catch(() => {});
          pendingRuns.add(operation); operation.finally(() => pendingRuns.delete(operation));
        }
        json(reservation.created ? 202 : 200, { run: reservation.run }); return;
      }
      const studyMatch = path.match(/^\/bot\/api\/optimizations\/([0-9a-f-]+)$/);
      if (studyMatch && ['GET', 'DELETE'].includes(req.method)) {
        if (!uuid.test(studyMatch[1])) throw error(404, 'not_found', 'Исследование не найдено.');
        if (req.method === 'DELETE') {
          if (!studies.remove(actor.id, studyMatch[1])) throw error(404, 'not_found', 'Исследование не найдено или ещё выполняется.');
          json(200, { deleted: true }); return;
        }
        const run = studies.get(actor.id, studyMatch[1]);
        if (!run) throw error(404, 'not_found', 'Исследование не найдено.');
        json(200, { run }); return;
      }
      if (req.method === 'GET' && path === '/bot/api/backtests/coverage') {
        if ([...requestUrl.searchParams.keys()].some(key => key !== 'preset') || requestUrl.searchParams.getAll('preset').length > 1) throw error(400, 'invalid_query', 'Неизвестные параметры покрытия.');
        const preset = requestUrl.searchParams.has('preset') ? Number(requestUrl.searchParams.get('preset')) : account.preset;
        if (![150, 1000, 5000].includes(preset)) throw error(400, 'invalid_preset', 'Выберите допустимый бюджет.');
        if (!store.allowRate(`backtest-coverage:${actor.id}`, 6)) throw error(429, 'rate_limit', 'Повторите проверку через минуту.');
        json(200, await backtests({ mode: 'coverage', window: '14d', preset, end: Math.floor(Date.now() / 60000) * 60000 })); return;
      }
      if (req.method === 'GET' && path === '/bot/api/backtests') { json(200, { runs: runs.list(actor.id) }); return; }
      if (req.method === 'POST' && path === '/bot/api/backtests') {
        fields(body, ['mode', 'window', 'preset', 'end', 'idempotencyKey']);
        const params = backtestParams(body);
        if (typeof body.idempotencyKey !== 'string' || !uuid.test(body.idempotencyKey)) throw error(400, 'invalid_input', 'Нужен уникальный ключ запроса.');
        if (!store.allowRate(`backtest-run:${actor.id}`, 4)) throw error(429, 'rate_limit', 'Повторите запуск через минуту.');
        const reservation = runs.reserve(actor.id, body.idempotencyKey, params);
        if (reservation.created) {
          const operation = Promise.resolve().then(() => backtests(params)).then(
            report => runs.finish(actor.id, reservation.run.id, report),
            () => runs.finish(actor.id, reservation.run.id, null, 'source_unavailable')
          ).catch(() => { /* Shutdown or bounded storage failure: restart marks unfinished records interrupted. */ });
          pendingRuns.add(operation); operation.finally(() => pendingRuns.delete(operation));
        }
        json(reservation.created ? 202 : 200, { run: reservation.run }); return;
      }
      const runMatch = path.match(/^\/bot\/api\/backtests\/([0-9a-f-]+)$/);
      if (runMatch && ['GET', 'DELETE'].includes(req.method)) {
        if (!uuid.test(runMatch[1])) throw error(404, 'not_found', 'Прогон не найден.');
        if (req.method === 'DELETE') {
          if (!runs.remove(actor.id, runMatch[1])) throw error(404, 'not_found', 'Прогон не найден или ещё выполняется.');
          json(200, { deleted: true }); return;
        }
        const run = runs.get(actor.id, runMatch[1]);
        if (!run) throw error(404, 'not_found', 'Прогон не найден.');
        json(200, { run }); return;
      }
      if (req.method === 'GET' && path === '/bot/api/overview') {
        json(200, { mode: 'RESEARCH', chainId: 4663, protocols: ['Pons V1', 'Pons V2'], preset: account.preset,
          entry: { 150: 10, 1000: 50, 5000: 250 }[account.preset], currency: 'USD', liveEnabled: false, paperEnabled: false,
          researchStatus: 'not_started', walletAnalysisStatus: 'not_started', aiWorkerStatus: 'not_connected',
          validatedWallets: 0, positions: [], trades: [], pnl: null, walletCount: store.wallets(actor.id).length,
          tasksCount: store.tasks(actor.id).length, network: await network(), release }); return;
      }
      if (req.method === 'PUT' && path === '/bot/api/settings') {
        fields(body, ['preset']);
        if (![150, 1000, 5000].includes(body.preset)) throw error(400, 'invalid_preset', 'Выберите допустимый бюджет.');
        store.setPreset(actor.id, body.preset); json(200, { preset: body.preset }); return;
      }
      if (req.method === 'GET' && path === '/bot/api/wallets') { json(200, { wallets: store.wallets(actor.id) }); return; }
      if (req.method === 'POST' && path === '/bot/api/wallets/challenge') {
        fields(body, ['address', 'provider']);
        const address = addressOf(body.address); const provider = text(body.provider ?? 'Wallet', 80, true);
        if (!store.allowRate(`proof:${actor.id}`, 10)) throw error(429, 'rate_limit', 'Подождите минуту перед новой проверкой.');
        if (store.wallets(actor.id).length >= 20) throw error(409, 'wallet_limit', 'Достигнут лимит подключённых кошельков.');
        if (!(await verifyEOA(address))) throw error(422, 'contract_wallet_unsupported', 'Контрактные кошельки пока не поддерживаются. Средства не затронуты.');
        const challenge = makeChallenge(actor, address, provider, origin);
        store.challenge(challenge); json(201, { id: challenge.id, message: challenge.message, expiresAt: new Date(challenge.expiresAt).toISOString() }); return;
      }
      if (req.method === 'POST' && path === '/bot/api/wallets/verify') {
        fields(body, ['challengeId', 'signature']);
        if (typeof body.challengeId !== 'string' || !uuid.test(body.challengeId)) throw error(400, 'invalid_challenge', 'Неверный запрос подписи.');
        const challenge = store.getChallenge(actor.id, actor.sessionHash, body.challengeId);
        if (!challenge) throw error(409, 'challenge_unavailable', 'Запрос истёк или уже использован. Создайте новый.');
        if (!signatureMatches(challenge, body.signature)) throw error(400, 'signature_invalid', 'Подпись не соответствует кошельку и запросу.');
        if (!(await verifyEOA(challenge.address))) throw error(422, 'contract_wallet_unsupported', 'Контрактные кошельки пока не поддерживаются.');
        if (!store.consumeChallenge(challenge)) throw error(409, 'challenge_unavailable', 'Запрос уже использован или истёк.');
        json(200, { wallet: store.wallets(actor.id).find(wallet => wallet.address === challenge.address), spendingPermission: false }); return;
      }
      const walletMatch = path.match(/^\/bot\/api\/wallets\/([0-9a-f-]+)$/);
      if (req.method === 'DELETE' && walletMatch) {
        if (!uuid.test(walletMatch[1]) || !store.deleteWallet(actor.id, walletMatch[1])) throw error(404, 'not_found', 'Кошелёк не найден.');
        json(200, { unlinked: true, onChainRevocation: false, spendingPermission: false }); return;
      }
      if (req.method === 'GET' && path === '/bot/api/tasks') { json(200, { tasks: store.tasks(actor.id), workerConnected: false }); return; }
      if (req.method === 'POST' && path === '/bot/api/tasks') {
        fields(body, ['title', 'description', 'acceptance', 'priority']);
        const values = { title: text(body.title, 120, true), description: text(body.description ?? '', 4000), acceptance: text(body.acceptance ?? '', 2000, true), priority: body.priority };
        if (!['p0', 'p1', 'p2'].includes(values.priority)) throw error(400, 'invalid_priority', 'Выберите приоритет.');
        if (store.tasks(actor.id).length >= 250) throw error(409, 'task_limit', 'Достигнут лимит задач аккаунта.');
        json(201, { task: store.createTask(actor.id, values) }); return;
      }
      const taskMatch = path.match(/^\/bot\/api\/tasks\/([0-9a-f-]+)$/);
      if (req.method === 'PATCH' && taskMatch) {
        fields(body, ['status']);
        if (!['planned', 'cancelled'].includes(body.status)) throw error(400, 'invalid_status', 'Доступны только планирование и отмена задачи.');
        if (!uuid.test(taskMatch[1]) || !store.updateTask(actor.id, taskMatch[1], body.status)) throw error(404, 'not_found', 'Задача не найдена.');
        json(200, { task: store.tasks(actor.id).find(task => task.id === taskMatch[1]) }); return;
      }
      if (req.method === 'GET' && path === '/bot/api/audit') { json(200, { events: store.audit(actor.id) }); return; }
      throw error(404, 'not_found', 'Не найдено.');
    } catch (err) {
      const known = Number.isInteger(err.status) && err.status >= 400 && err.status < 600;
      if (!known) console.error('cryptobot_request_failed');
      if (!res.headersSent) json(known ? err.status : 500, { error: known ? err.code : 'internal_error', message: known ? err.message : 'Не удалось выполнить запрос.' });
      else res.end();
    }
  });
  server.backtestsIdle = () => Promise.all([...pendingRuns]);
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  return server;
}
