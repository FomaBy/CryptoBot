import { randomUUID } from 'node:crypto';

// Additive schema: old web releases can run without touching these research records.
export function createBacktestStore(db, kind = 'backtest') {
  if (!['backtest', 'optimization'].includes(kind)) throw new Error('invalid_research_kind');
  const table = kind + '_runs';
  const sql = value => value.replaceAll('backtest_runs', table).replaceAll('backtest_account_created', kind + '_account_created');
  db.exec(sql(`CREATE TABLE IF NOT EXISTS backtest_runs (
    id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),request_key TEXT NOT NULL,
    params TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,expires_at INTEGER NOT NULL,finished_at TEXT,report TEXT,error TEXT,
    UNIQUE(account_id,request_key));
    CREATE INDEX IF NOT EXISTS backtest_account_created ON backtest_runs(account_id,created_at);`));
  function view(row, detail = true) {
    if (!row) return null;
    return { id: row.id, params: JSON.parse(row.params), status: row.status, createdAt: row.created_at,
      finishedAt: row.finished_at, error: row.error, ...(detail ? { report: row.report ? JSON.parse(row.report) : null } : {}) };
  }
  const expire = () => db.prepare(sql("UPDATE backtest_runs SET status='interrupted',error='run_deadline_exceeded' WHERE status='running' AND expires_at<?")).run(Date.now());
  const audit = (account, kind, id) => db.prepare(sql('INSERT INTO audit(account_id,kind,resource_id,created_at) VALUES(?,?,?,?)')).run(account, kind, id, new Date().toISOString());
  return {
    list(account) { expire(); return db.prepare(sql('SELECT id,params,status,created_at,finished_at,error FROM backtest_runs WHERE account_id=? ORDER BY created_at DESC LIMIT 20')).all(account).map(row => view(row, false)); },
    get(account, id) { expire(); return view(db.prepare(sql('SELECT * FROM backtest_runs WHERE account_id=? AND id=?')).get(account, id)); },
    reserve(account, key, params) {
      db.exec('BEGIN IMMEDIATE');
      try {
      expire();
      const previous = db.prepare(sql('SELECT * FROM backtest_runs WHERE account_id=? AND request_key=?')).get(account, key);
      const encoded = JSON.stringify(params);
      if (previous) {
        if (previous.params !== encoded) throw Object.assign(new Error('Ключ запроса уже использован с другими параметрами.'), { status: 409, code: 'idempotency_conflict' });
        db.exec('COMMIT');
        return { run: view(previous), created: false };
      }
      const counts = db.prepare(sql("SELECT count(*) AS total,sum(account_id=?) AS own,sum(status='running') AS active,sum(status='running' AND account_id=?) AS ownActive FROM backtest_runs")).get(account, account);
      if (counts.total >= 500 || counts.own >= 20) throw Object.assign(new Error('Лимит сохранённых прогонов достигнут. Удалите ненужный отчёт.'), { status: 409, code: 'backtest_limit' });
      if (counts.active >= 2 || counts.ownActive >= 1) throw Object.assign(new Error('Прогон уже выполняется. Дождитесь результата.'), { status: 409, code: 'backtest_busy' });
      const id = randomUUID();
      db.prepare(sql('INSERT INTO backtest_runs(id,account_id,request_key,params,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?)'))
        .run(id, account, key, encoded, 'running', new Date().toISOString(), Date.now() + 120000);
      audit(account, kind + '_requested', id);
      const run = this.get(account, id);
      db.exec('COMMIT');
      return { run, created: true };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    finish(account, id, report, error = null) {
      const payload = report === null ? null : JSON.stringify(report);
      if (payload && Buffer.byteLength(payload) > 2097152) throw new Error('backtest_report_limit');
      const result = db.prepare(sql("UPDATE backtest_runs SET status=?,finished_at=?,report=?,error=? WHERE account_id=? AND id=? AND status='running' AND expires_at>=?"))
        .run(error ? 'failed' : 'complete', new Date().toISOString(), payload, error, account, id, Date.now());
      if (result.changes) audit(account, error ? kind + '_failed' : kind + '_completed', id);
    },
    remove(account, id) {
      const result = db.prepare(sql("DELETE FROM backtest_runs WHERE account_id=? AND id=? AND status<>'running'")).run(account, id);
      if (result.changes) audit(account, kind + '_deleted', id);
      return result.changes > 0;
    }
  };
}
