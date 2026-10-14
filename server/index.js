import { createStore } from './store.js';
import { createApp } from './app.js';
import { readFileSync } from 'node:fs';

// Files created by SQLite, including WAL/SHM, stay private on the shared host.
process.umask(0o077);
const store = createStore(process.env.CRYPTOBOT_DB || './data/app.sqlite');
let release = 'development';
try { release = readFileSync(new URL('../RELEASE', import.meta.url), 'utf8').trim().slice(0, 64); } catch {}
const app = createApp({ store, origin: process.env.CRYPTOBOT_ORIGIN || 'https://aistat.app', release });
app.listen(Number(process.env.PORT || 3100), process.env.HOST || '127.0.0.1', () => console.log('CryptoBot web ready; live trading disabled'));
for (const event of ['SIGTERM', 'SIGINT']) process.on(event, () => app.close(() => { store.close(); process.exit(0); }));
