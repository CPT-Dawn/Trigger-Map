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

interface TableColumnInfoRow {
  name: string;
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

function hasColumn(tableName: string, columnName: string) {
  const columns = db.getAllSync<TableColumnInfoRow>(`PRAGMA table_info(${tableName});`);

  return columns.some((column) => column.name === columnName);
}

function ensureColumn(tableName: string, columnName: string, definition: string) {
  if (hasColumn(tableName, columnName)) {
    return;
  }

  db.execSync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
}

function backfillLogItemDisplayNames() {
  db.execSync(`
    UPDATE medicine_logs
    SET
      item_name = CASE
        WHEN item_name IS NOT NULL AND TRIM(item_name) <> '' THEN item_name
        ELSE (
          SELECT um.name
          FROM user_medicines AS um
          WHERE um.id = medicine_logs.medicine_id AND um.user_id = medicine_logs.user_id
        )
      END,
      item_quantity = COALESCE(
        item_quantity,
        (
          SELECT um.quantity
          FROM user_medicines AS um
          WHERE um.id = medicine_logs.medicine_id AND um.user_id = medicine_logs.user_id
        )
      ),
      item_unit = CASE
        WHEN item_unit IS NOT NULL AND TRIM(item_unit) <> '' THEN item_unit
        ELSE (
          SELECT um.unit
          FROM user_medicines AS um
          WHERE um.id = medicine_logs.medicine_id AND um.user_id = medicine_logs.user_id
        )
      END,
      item_display_name = CASE
        WHEN item_display_name IS NOT NULL AND TRIM(item_display_name) <> '' THEN item_display_name
        ELSE (
          SELECT CASE
            WHEN um.display_name IS NOT NULL AND TRIM(um.display_name) <> '' THEN um.display_name
            WHEN um.name IS NOT NULL AND TRIM(um.name) <> '' THEN um.name
            ELSE NULL
          END
          FROM user_medicines AS um
          WHERE um.id = medicine_logs.medicine_id AND um.user_id = medicine_logs.user_id
        )
      END
    WHERE
      item_name IS NULL OR TRIM(item_name) = '' OR
      item_quantity IS NULL OR
      item_unit IS NULL OR TRIM(item_unit) = '' OR
      item_display_name IS NULL OR TRIM(item_display_name) = '';

    UPDATE food_logs
    SET
      item_name = CASE
        WHEN item_name IS NOT NULL AND TRIM(item_name) <> '' THEN item_name
        ELSE (
          SELECT uf.name
          FROM user_foods AS uf
          WHERE uf.id = food_logs.food_id AND uf.user_id = food_logs.user_id
        )
      END,
      item_quantity = COALESCE(
        item_quantity,
        (
          SELECT uf.quantity
          FROM user_foods AS uf
          WHERE uf.id = food_logs.food_id AND uf.user_id = food_logs.user_id
        )
      ),
      item_unit = CASE
        WHEN item_unit IS NOT NULL AND TRIM(item_unit) <> '' THEN item_unit
        ELSE (
          SELECT uf.unit
          FROM user_foods AS uf
          WHERE uf.id = food_logs.food_id AND uf.user_id = food_logs.user_id
        )
      END,
      item_display_name = CASE
        WHEN item_display_name IS NOT NULL AND TRIM(item_display_name) <> '' THEN item_display_name
        ELSE (
          SELECT CASE
            WHEN uf.display_name IS NOT NULL AND TRIM(uf.display_name) <> '' THEN uf.display_name
            WHEN uf.name IS NOT NULL AND TRIM(uf.name) <> '' THEN uf.name
            ELSE NULL
          END
          FROM user_foods AS uf
          WHERE uf.id = food_logs.food_id AND uf.user_id = food_logs.user_id
        )
      END
    WHERE
      item_name IS NULL OR TRIM(item_name) = '' OR
      item_quantity IS NULL OR
      item_unit IS NULL OR TRIM(item_unit) = '' OR
      item_display_name IS NULL OR TRIM(item_display_name) = '';
  `);
}

function normalizeStressLevelWithoutNone(value: unknown): 'low' | 'moderate' | 'high' | null {
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();

    if (lowered === 'low' || lowered === 'moderate' || lowered === 'high') {
      return lowered;
    }

    if (lowered === 'mid') {
      return 'moderate';
    }

    if (lowered === 'none') {
      return 'low';
    }

    return 'low';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 3) return 'low';
    if (value <= 6) return 'moderate';

    return 'high';
  }

  return null;
}

function migrateStressQueuePayloadLevels() {
  const queueRows = db.getAllSync<QueueRowForMigration>(
    `
      SELECT id, table_name, operation, payload
      FROM sync_queue
      WHERE table_name = 'stress_logs' AND operation IN ('INSERT', 'UPDATE');
    `,
  );

  for (const queueRow of queueRows) {
    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(queueRow.payload);
    } catch {
      continue;
    }

    const payloadRecord = getPayloadRecord(parsedPayload);

    if (!payloadRecord) {
      continue;
    }

    const writePayload =
      getPayloadRecord(payloadRecord.data) ??
      getPayloadRecord(payloadRecord.row) ??
      payloadRecord;

    const normalizedLevel = normalizeStressLevelWithoutNone(writePayload.level);

    if (!normalizedLevel || writePayload.level === normalizedLevel) {
      continue;
    }

    writePayload.level = normalizedLevel;
    db.runSync('UPDATE sync_queue SET payload = ? WHERE id = ?;', [JSON.stringify(parsedPayload), queueRow.id]);
  }
}

function migrateStressLevelsWithoutNone() {
  db.runSync(`
    UPDATE stress_logs
    SET level = CASE
      WHEN level IS NULL THEN NULL
      WHEN LOWER(TRIM(level)) = 'none' THEN 'low'
      WHEN LOWER(TRIM(level)) = 'mid' THEN 'moderate'
      WHEN LOWER(TRIM(level)) IN ('low', 'moderate', 'high') THEN LOWER(TRIM(level))
      ELSE 'low'
    END
    WHERE level IS NOT NULL;
  `);

  migrateStressQueuePayloadLevels();
}

function applySchemaMigrations() {
  ensureColumn('medicine_logs', 'item_display_name', 'TEXT');
  ensureColumn('medicine_logs', 'item_name', 'TEXT');
  ensureColumn('medicine_logs', 'item_quantity', 'REAL');
  ensureColumn('medicine_logs', 'item_unit', 'TEXT');
  ensureColumn('food_logs', 'item_display_name', 'TEXT');
  ensureColumn('food_logs', 'item_name', 'TEXT');
  ensureColumn('food_logs', 'item_quantity', 'REAL');
  ensureColumn('food_logs', 'item_unit', 'TEXT');

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at);
    CREATE INDEX IF NOT EXISTS idx_user_medicines_user_id ON user_medicines(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_foods_user_id ON user_foods(user_id);
    CREATE INDEX IF NOT EXISTS idx_pain_logs_user_logged_at ON pain_logs(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_stress_logs_user_logged_at ON stress_logs(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_medicine_logs_user_logged_at ON medicine_logs(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged_at ON food_logs(user_id, logged_at);
  `);

  migrateStressLevelsWithoutNone();
  backfillLogItemDisplayNames();
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
      level TEXT CHECK (level IN ('low', 'moderate', 'high') OR level IS NULL)
    );

    CREATE TABLE IF NOT EXISTS medicine_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      item_display_name TEXT,
      item_name TEXT,
      item_quantity REAL,
      item_unit TEXT,
      logged_at TEXT NOT NULL,
      log_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS food_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      item_display_name TEXT,
      item_name TEXT,
      item_quantity REAL,
      item_unit TEXT,
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

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      updated_at TEXT NOT NULL
    );

  `);

  applySchemaMigrations();

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

export function getPendingSyncCount() {
  const row = db.getFirstSync<{ count: number }>('SELECT COUNT(1) AS count FROM sync_queue;', []);

  return Number(row?.count ?? 0);
}

export function getPendingSyncCountForTable(tableName: string) {
  const row = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(1) AS count FROM sync_queue WHERE table_name = ?;',
    [tableName],
  );

  return Number(row?.count ?? 0);
}

export function setSyncMeta(key: string, value: string | null) {
  if (value === null) {
    db.runSync('DELETE FROM sync_meta WHERE key = ?;', [key]);
    return;
  }

  db.runSync(
    `
      INSERT OR REPLACE INTO sync_meta (key, value)
      VALUES (?, ?);
    `,
    [key, value],
  );
}

export function getSyncMeta(key: string) {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?;', [key]);

  return row?.value ?? null;
}

export function getLocalDisplayName(userId: string) {
  const row = db.getFirstSync<{ display_name: string | null }>(
    'SELECT display_name FROM user_settings WHERE user_id = ?;',
    [userId],
  );

  return row?.display_name ?? null;
}

export function upsertLocalDisplayName(userId: string, displayName: string | null) {
  db.runSync(
    `
      INSERT OR REPLACE INTO user_settings (user_id, display_name, updated_at)
      VALUES (?, ?, ?);
    `,
    [userId, displayName, new Date().toISOString()],
  );
}
