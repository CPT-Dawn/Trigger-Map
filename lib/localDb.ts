import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('triggermap.db');

export type SyncQueueOperation = 'INSERT' | 'UPDATE' | 'DELETE';

type LogTableName = 'pain_logs' | 'stress_logs' | 'medicine_logs' | 'food_logs';

interface SyncQueueRow {
  id: string;
  table_name: string;
  operation: SyncQueueOperation;
  payload: string;
  created_at: string;
}

interface QueueRowForMigration {
  id: string;
  table_name: string;
  operation: SyncQueueOperation;
  payload: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isLogTableName(tableName: string): tableName is LogTableName {
  return (
    tableName === 'pain_logs' ||
    tableName === 'stress_logs' ||
    tableName === 'medicine_logs' ||
    tableName === 'food_logs'
  );
}

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function createUuidFromBytes(bytes: Uint8Array) {
  // RFC4122 variant + v4 format bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createUuid() {
  const cryptoObject = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (buffer: Uint8Array) => Uint8Array } }).crypto;

  if (cryptoObject?.randomUUID) {
    return cryptoObject.randomUUID();
  }

  if (cryptoObject?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObject.getRandomValues(bytes);
    return createUuidFromBytes(bytes);
  }

  const bytes = new Uint8Array(16);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return createUuidFromBytes(bytes);
}

function createQueueId() {
  return createUuid();
}

function getPayloadRecord(payload: unknown) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }

  return null;
}

function getPayloadId(payloadRecord: Record<string, unknown>) {
  const directId = payloadRecord.id;

  if (typeof directId === 'string' && directId.length > 0) {
    return directId;
  }

  const rowRecord = getPayloadRecord(payloadRecord.row);
  const dataRecord = getPayloadRecord(payloadRecord.data);
  const nestedId = rowRecord?.id ?? dataRecord?.id;

  return typeof nestedId === 'string' && nestedId.length > 0 ? nestedId : null;
}

function assignPayloadId(payloadRecord: Record<string, unknown>, nextId: string) {
  if (typeof payloadRecord.id === 'string') {
    payloadRecord.id = nextId;
  }

  const rowRecord = getPayloadRecord(payloadRecord.row);

  if (rowRecord && typeof rowRecord.id === 'string') {
    rowRecord.id = nextId;
  }

  const dataRecord = getPayloadRecord(payloadRecord.data);

  if (dataRecord && typeof dataRecord.id === 'string') {
    dataRecord.id = nextId;
  }
}

function replaceInvalidLogIds() {
  const tables: LogTableName[] = ['pain_logs', 'stress_logs', 'medicine_logs', 'food_logs'];
  const idMapByTable: Record<LogTableName, Map<string, string>> = {
    pain_logs: new Map(),
    stress_logs: new Map(),
    medicine_logs: new Map(),
    food_logs: new Map(),
  };

  for (const tableName of tables) {
    const rows = db.getAllSync<{ id: string }>(`SELECT id FROM ${tableName};`);

    for (const row of rows) {
      if (isValidUuid(row.id)) {
        continue;
      }

      const nextId = createUuid();
      db.runSync(`UPDATE ${tableName} SET id = ? WHERE id = ?;`, [nextId, row.id]);
      idMapByTable[tableName].set(row.id, nextId);
    }
  }

  return idMapByTable;
}

function repairSyncQueuePayloadIds(idMapByTable: Record<LogTableName, Map<string, string>>) {
  const queueRows = db.getAllSync<QueueRowForMigration>(
    `
      SELECT id, table_name, operation, payload
      FROM sync_queue
      ORDER BY created_at ASC;
    `,
  );

  for (const queueRow of queueRows) {
    if (!isLogTableName(queueRow.table_name)) {
      continue;
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(queueRow.payload);
    } catch {
      db.runSync('DELETE FROM sync_queue WHERE id = ?;', [queueRow.id]);
      continue;
    }

    const payloadRecord = getPayloadRecord(parsedPayload);

    if (!payloadRecord) {
      db.runSync('DELETE FROM sync_queue WHERE id = ?;', [queueRow.id]);
      continue;
    }

    const payloadId = getPayloadId(payloadRecord);

    if (!payloadId) {
      continue;
    }

    const mappedId = idMapByTable[queueRow.table_name].get(payloadId);

    if (mappedId) {
      assignPayloadId(payloadRecord, mappedId);
      db.runSync('UPDATE sync_queue SET payload = ? WHERE id = ?;', [JSON.stringify(payloadRecord), queueRow.id]);
      continue;
    }

    if (isValidUuid(payloadId)) {
      continue;
    }

    if (queueRow.operation === 'INSERT') {
      const nextId = createUuid();
      db.runSync(`UPDATE ${queueRow.table_name} SET id = ? WHERE id = ?;`, [nextId, payloadId]);
      assignPayloadId(payloadRecord, nextId);
      db.runSync('UPDATE sync_queue SET payload = ? WHERE id = ?;', [JSON.stringify(payloadRecord), queueRow.id]);
      continue;
    }

    // Invalid UUIDs in UPDATE/DELETE payloads cannot map to Supabase rows; drop these stale queue rows.
    db.runSync('DELETE FROM sync_queue WHERE id = ?;', [queueRow.id]);
  }
}

function runLocalIdRepairMigration() {
  const idMapByTable = replaceInvalidLogIds();
  repairSyncQueuePayloadIds(idMapByTable);
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

  runLocalIdRepairMigration();
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
