import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function createStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  if (filename !== ':memory:') chmodSync(filename, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, preset INTEGER NOT NULL DEFAULT 150, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wallets (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), address TEXT NOT NULL,
      provider TEXT NOT NULL, verified_at TEXT NOT NULL, chain_id INTEGER NOT NULL, UNIQUE(account_id,address,chain_id));
    CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, session_hash TEXT NOT NULL,
      address TEXT NOT NULL, provider TEXT NOT NULL, message TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), title TEXT NOT NULL,
      description TEXT NOT NULL, acceptance TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, account_id TEXT NOT NULL, kind TEXT NOT NULL, resource_id TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
  `);
  const audit = (account, kind, resource) => db.prepare('INSERT INTO audit(account_id,kind,resource_id,created_at) VALUES(?,?,?,?)')
    .run(account, kind, resource, new Date().toISOString());
  return {
    db,
    account(id) {
      db.prepare('INSERT OR IGNORE INTO accounts(id,created_at) VALUES(?,?)').run(id, new Date().toISOString());
      return db.prepare('SELECT id,preset FROM accounts WHERE id=?').get(id);
    },
    setPreset(account, preset) {
      db.prepare('UPDATE accounts SET preset=? WHERE id=?').run(preset, account);
      audit(account, 'preset_updated', String(preset));
    },
    wallets(account) {
      return db.prepare('SELECT id,address,provider,verified_at AS verifiedAt,chain_id AS chainId FROM wallets WHERE account_id=? ORDER BY verified_at DESC').all(account);
    },
    deleteWallet(account, id) {
      const result = db.prepare('DELETE FROM wallets WHERE id=? AND account_id=?').run(id, account);
      if (result.changes) audit(account, 'wallet_unlinked_no_spend_permission', id);
      return result.changes > 0;
    },
    challenge(row) {
      db.prepare('DELETE FROM challenges WHERE expires_at < ?').run(Date.now() - 86400000);
      db.prepare('INSERT INTO challenges(id,account_id,session_hash,address,provider,message,expires_at) VALUES(?,?,?,?,?,?,?)')
        .run(row.id, row.account, row.sessionHash, row.address, row.provider, row.message, row.expiresAt);
    },
    getChallenge(account, sessionHash, id) {
      return db.prepare('SELECT * FROM challenges WHERE id=? AND account_id=? AND session_hash=? AND consumed=0 AND expires_at>?')
        .get(id, account, sessionHash, Date.now());
    },
    consumeChallenge(row) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = db.prepare('SELECT id FROM wallets WHERE account_id=? AND address=? AND chain_id=4663').get(row.account_id, row.address);
        const count = db.prepare('SELECT count(*) AS n FROM wallets WHERE account_id=?').get(row.account_id).n;
        if (!existing && count >= 20) {
          throw Object.assign(new Error('Достигнут лимит подключённых кошельков.'), { status: 409, code: 'wallet_limit' });
        }
        const result = db.prepare('UPDATE challenges SET consumed=1 WHERE id=? AND account_id=? AND session_hash=? AND consumed=0 AND expires_at>?')
          .run(row.id, row.account_id, row.session_hash, Date.now());
        if (!result.changes) { db.exec('ROLLBACK'); return false; }
        const now = new Date().toISOString();
        db.prepare(`INSERT INTO wallets(id,account_id,address,provider,verified_at,chain_id) VALUES(?,?,?,?,?,4663)
          ON CONFLICT(account_id,address,chain_id) DO UPDATE SET provider=excluded.provider,verified_at=excluded.verified_at`)
          .run(randomUUID(), row.account_id, row.address, row.provider, now);
        audit(row.account_id, 'wallet_ownership_verified', row.id);
        db.exec('COMMIT');
        return true;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    tasks(account) {
      return db.prepare('SELECT id,title,description,acceptance,priority,status,created_at AS createdAt,updated_at AS updatedAt FROM tasks WHERE account_id=? ORDER BY created_at DESC LIMIT 250').all(account);
    },
    createTask(account, fields) {
      const id = randomUUID(); const now = new Date().toISOString();
      db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?)').run(id, account, fields.title, fields.description, fields.acceptance, fields.priority, 'planned', now, now);
      audit(account, 'task_created', id);
      return this.tasks(account).find(task => task.id === id);
    },
    updateTask(account, id, status) {
      const result = db.prepare("UPDATE tasks SET status=?,updated_at=? WHERE id=? AND account_id=? AND status IN ('planned','cancelled')")
        .run(status, new Date().toISOString(), id, account);
      if (result.changes) audit(account, 'task_' + status, id);
      return result.changes > 0;
    },
    allowRate(key, maximum) {
      const window = Math.floor(Date.now() / 60000);
      db.prepare(`INSERT INTO rate_limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET
        count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window`).run(key, window);
      db.prepare('DELETE FROM rate_limits WHERE window<?').run(window - 2);
      return db.prepare('SELECT count FROM rate_limits WHERE key=?').get(key).count <= maximum;
    },
    audit(account) { return db.prepare('SELECT kind,resource_id AS resourceId,created_at AS createdAt FROM audit WHERE account_id=? ORDER BY id DESC LIMIT 50').all(account); },
    close() { db.close(); }
  };
}
