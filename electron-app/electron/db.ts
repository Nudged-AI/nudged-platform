import initSqlJs, { type Database } from 'sql.js';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let _db: Database | null = null;
let _dbPath: string;

export async function getDb(): Promise<Database> {
  if (_db) return _db;

  const SQL = await initSqlJs();
  _dbPath = path.join(app.getPath('userData'), 'returnon.db');

  if (fs.existsSync(_dbPath)) {
    const buf = fs.readFileSync(_dbPath);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  initSchema(_db);
  persistDb();
  return _db;
}

export function persistDb(): void {
  if (!_db || !_dbPath) return;
  const data = _db.export();
  fs.writeFileSync(_dbPath, Buffer.from(data));
}

function initSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      goal TEXT NOT NULL DEFAULT '',
      end_minutes INTEGER NOT NULL DEFAULT 25,
      allowed_apps TEXT NOT NULL DEFAULT '[]',
      tolerance_seconds INTEGER NOT NULL DEFAULT 20,
      status TEXT NOT NULL DEFAULT 'active',
      last_active_app TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      returns_raised INTEGER NOT NULL DEFAULT 0,
      returns_made INTEGER NOT NULL DEFAULT 0,
      goal_achieved INTEGER
    );

    CREATE TABLE IF NOT EXISTS parked_thoughts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_id TEXT,
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      theme TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_thoughts_user ON parked_thoughts(user_id, created_at);
  `);

  // Migrations for existing databases
  for (const col of ['returns_raised INTEGER NOT NULL DEFAULT 0', 'returns_made INTEGER NOT NULL DEFAULT 0', 'goal_achieved INTEGER', 'focused_seconds INTEGER NOT NULL DEFAULT 0']) {
    try { db.run(`ALTER TABLE sessions ADD COLUMN ${col}`); } catch { /* already exists */ }
  }

  persistDb();
}
