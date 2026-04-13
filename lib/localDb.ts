import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('triggermap.db');

export type SyncQueueOperation = 'INSERT' | 'UPDATE' | 'DELETE';

interface SyncQueueRow {
  id: string;
  table_name: string;
  operation: SyncQueueOperation;
  payload: string;
  created_at: string;
}

function createQueueId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function initLocalDB() {
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS user_medicines (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      quantity REAL,
      unit TEXT,
      display_name TEXT
    );

    CREATE TABLE IF NOT EXISTS user_foods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      quantity REAL,
      unit TEXT,
      display_name TEXT
    );

    CREATE TABLE IF NOT EXISTS pain_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      log_date TEXT NOT NULL,
      body_part TEXT,
      pain_level INTEGER,
      swelling INTEGER CHECK (swelling IN (0, 1) OR swelling IS NULL),
      CHECK (pain_level BETWEEN 1 AND 5 OR pain_level IS NULL)
    );

    CREATE TABLE IF NOT EXISTS stress_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      log_date TEXT NOT NULL,
      level TEXT CHECK (level IN ('none', 'low', 'moderate', 'high') OR level IS NULL)
    );

    CREATE TABLE IF NOT EXISTS medicine_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      log_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS food_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      log_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at);
  `);
}

export function addToSyncQueue(
  tableName: string,
  operation: SyncQueueOperation,
  payload: unknown,
) {
  const id = createQueueId();

  db.runSync(
    `
      INSERT INTO sync_queue (id, table_name, operation, payload, created_at)
      VALUES (?, ?, ?, ?, ?);
    `,
    [id, tableName, operation, JSON.stringify(payload), new Date().toISOString()],
  );

  return id;
}

export function getSyncQueue() {
  return db.getAllSync<SyncQueueRow>(
    `
      SELECT id, table_name, operation, payload, created_at
      FROM sync_queue
      ORDER BY created_at ASC;
    `,
  );
}

export function removeFromSyncQueue(id: string) {
  db.runSync('DELETE FROM sync_queue WHERE id = ?;', [id]);
}
