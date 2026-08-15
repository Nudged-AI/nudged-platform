import { v4 as uuidv4 } from 'uuid';
import { getDb, persistDb } from './db';
import type { Database } from 'sql.js';

export interface SessionRow {
  id: string;
  user_id: string;
  goal: string;
  end_minutes: number;
  allowed_apps: string; // JSON string
  tolerance_seconds: number;
  status: string;
  last_active_app: string;
  started_at: string;
  ended_at?: string | null;
  returns_raised: number;
  returns_made: number;
  goal_achieved: number | null; // 1=yes, 0=no, null=unanswered
  focused_seconds: number;
}

export interface ThoughtRow {
  id: string;
  user_id: string;
  session_id: string | null;
  content: string;
  status: string;
  theme: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// Helper: run a SELECT and return rows as objects
function queryAll<T>(db: Database, sql: string, params: (string | number | null)[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

function queryOne<T>(db: Database, sql: string, params: (string | number | null)[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows[0] ?? null;
}

// Sessions

export async function insertSession(data: Omit<SessionRow, 'id'>): Promise<SessionRow> {
  const db = await getDb();
  const id = uuidv4();
  db.run(
    `INSERT INTO sessions (id, user_id, goal, end_minutes, allowed_apps, tolerance_seconds, status, last_active_app, started_at, ended_at, returns_raised, returns_made, goal_achieved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL)`,
    [id, data.user_id, data.goal, data.end_minutes, data.allowed_apps, data.tolerance_seconds, data.status, data.last_active_app, data.started_at, data.ended_at ?? null]
  );
  persistDb();
  return { id, ...data };
}

export async function updateSession(id: string, updates: Partial<Pick<SessionRow, 'status' | 'ended_at' | 'last_active_app' | 'allowed_apps' | 'returns_raised' | 'returns_made' | 'goal_achieved' | 'end_minutes' | 'focused_seconds'>>): Promise<void> {
  const db = await getDb();
  const entries = Object.entries(updates);
  if (entries.length === 0) return;
  const fields = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = [...entries.map(([, v]) => v ?? null), id];
  db.run(`UPDATE sessions SET ${fields} WHERE id = ?`, values as (string | number | null)[]);
  persistDb();
}

export async function getActiveSession(userId: string): Promise<SessionRow | null> {
  const db = await getDb();
  return queryOne<SessionRow>(db, `SELECT * FROM sessions WHERE user_id = ? AND status = 'active' LIMIT 1`, [userId]);
}

export async function getSessionById(id: string): Promise<SessionRow | null> {
  const db = await getDb();
  return queryOne<SessionRow>(db, `SELECT * FROM sessions WHERE id = ?`, [id]);
}

export async function listSessions(userId: string, limit = 50): Promise<SessionRow[]> {
  const db = await getDb();
  return queryAll<SessionRow>(db, `SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?`, [userId, limit]);
}

// Parked Thoughts

export async function insertThought(data: Omit<ThoughtRow, 'id'>): Promise<ThoughtRow> {
  const db = await getDb();
  const id = uuidv4();
  db.run(
    `INSERT INTO parked_thoughts (id, user_id, session_id, content, status, theme, created_at, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.user_id, data.session_id, data.content, data.status, data.theme, data.created_at, data.reviewed_at]
  );
  persistDb();
  return { id, ...data };
}

export async function updateThought(id: string, updates: Partial<Pick<ThoughtRow, 'status' | 'theme' | 'reviewed_at'>>): Promise<void> {
  const db = await getDb();
  const entries = Object.entries(updates);
  if (entries.length === 0) return;
  const fields = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = [...entries.map(([, v]) => v ?? null), id];
  db.run(`UPDATE parked_thoughts SET ${fields} WHERE id = ?`, values as (string | number | null)[]);
  persistDb();
}

export async function deleteThought(id: string): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM parked_thoughts WHERE id = ?`, [id]);
  persistDb();
}

export async function bulkUpdateThoughtTheme(ids: string[], theme: string): Promise<void> {
  const db = await getDb();
  for (const id of ids) {
    db.run(`UPDATE parked_thoughts SET theme = ? WHERE id = ?`, [theme, id]);
  }
  persistDb();
}

export async function listThoughts(userId: string): Promise<ThoughtRow[]> {
  const db = await getDb();
  return queryAll<ThoughtRow>(db, `SELECT * FROM parked_thoughts WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
}

export async function countPendingThoughts(userId: string): Promise<number> {
  const db = await getDb();
  const row = queryOne<{ cnt: number }>(db, `SELECT COUNT(*) as cnt FROM parked_thoughts WHERE user_id = ? AND status = 'pending'`, [userId]);
  return row?.cnt ?? 0;
}

// Settings

export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  const db = await getDb();
  const row = queryOne<{ value: string }>(db, `SELECT value FROM app_settings WHERE key = ?`, [key]);
  return row?.value ?? defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  db.run(`INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, value]);
  persistDb();
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = queryAll<{ key: string; value: string }>(db, `SELECT key, value FROM app_settings`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
