import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("triggermap.db");

type SyncQueueOperation = "INSERT" | "UPDATE" | "DELETE";

type LogTableName = "pain_logs" | "stress_logs" | "medicine_logs" | "food_logs";

interface SyncQueueRow {
  id: string;
  table_name: string;
  operation: SyncQueueOperation;
  payload: string;
  user_id: string | null;
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

type UserItemTableName = "user_medicines" | "user_foods";

type LocalDisplayNameChangeListener = (change: {
  userId: string;
  displayName: string | null;
}) => void;

const localDisplayNameChangeListeners =
  new Set<LocalDisplayNameChangeListener>();

interface UserItemBackfillRow {
  id: string;
  name: string | null;
  quantity: number | null;
  unit: string | null;
  display_name: string | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_USER_ITEM_NAME = "Saved item";
const DEFAULT_USER_ITEM_QUANTITY = 1;
const DEFAULT_USER_ITEM_UNIT = "unit";

function isLogTableName(tableName: string): tableName is LogTableName {
  return (
    tableName === "pain_logs" ||
    tableName === "stress_logs" ||
    tableName === "medicine_logs" ||
    tableName === "food_logs"
  );
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function createUuidFromBytes(bytes: Uint8Array) {
  // RFC4122 variant + v4 format bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createUuid() {
  const cryptoObject = (
    globalThis as {
      crypto?: {
        randomUUID?: () => string;
        getRandomValues?: (buffer: Uint8Array) => Uint8Array;
      };
    }
  ).crypto;

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
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }

  return null;
}

function getWritePayload(payload: unknown) {
  const payloadRecord = getPayloadRecord(payload);

  if (!payloadRecord) {
    return payload;
  }

  if (payloadRecord.data !== undefined) {
    return payloadRecord.data;
  }

  if (payloadRecord.row !== undefined) {
    return payloadRecord.row;
  }

  return payloadRecord;
}

function getPayloadId(payloadRecord: Record<string, unknown>) {
  const directId = payloadRecord.id;

  if (typeof directId === "string" && directId.length > 0) {
    return directId;
  }

  const rowRecord = getPayloadRecord(payloadRecord.row);
  const dataRecord = getPayloadRecord(payloadRecord.data);
  const nestedId = rowRecord?.id ?? dataRecord?.id;

  return typeof nestedId === "string" && nestedId.length > 0 ? nestedId : null;
}

function getPayloadUserId(payload: unknown) {
  const payloadRecord = getPayloadRecord(payload);

  if (!payloadRecord) {
    return null;
  }

  const directUserId = payloadRecord.user_id;

  if (typeof directUserId === "string" && directUserId.length > 0) {
    return directUserId;
  }

  const rowRecord = getPayloadRecord(payloadRecord.row);

  if (
    rowRecord &&
    typeof rowRecord.user_id === "string" &&
    rowRecord.user_id.length > 0
  ) {
    return rowRecord.user_id;
  }

  const dataRecord = getPayloadRecord(payloadRecord.data);

  if (
    dataRecord &&
    typeof dataRecord.user_id === "string" &&
    dataRecord.user_id.length > 0
  ) {
    return dataRecord.user_id;
  }

  return null;
}

function assignPayloadId(
  payloadRecord: Record<string, unknown>,
  nextId: string,
) {
  if (typeof payloadRecord.id === "string") {
    payloadRecord.id = nextId;
  }

  const rowRecord = getPayloadRecord(payloadRecord.row);

  if (rowRecord && typeof rowRecord.id === "string") {
    rowRecord.id = nextId;
  }

  const dataRecord = getPayloadRecord(payloadRecord.data);

  if (dataRecord && typeof dataRecord.id === "string") {
    dataRecord.id = nextId;
  }
}

function replaceInvalidLogIds() {
  const tables: LogTableName[] = [
    "pain_logs",
    "stress_logs",
    "medicine_logs",
    "food_logs",
  ];
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
      db.runSync(`UPDATE ${tableName} SET id = ? WHERE id = ?;`, [
        nextId,
        row.id,
      ]);
      idMapByTable[tableName].set(row.id, nextId);
    }
  }

  return idMapByTable;
}

function repairSyncQueuePayloadIds(
  idMapByTable: Record<LogTableName, Map<string, string>>,
) {
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
      db.runSync("DELETE FROM sync_queue WHERE id = ?;", [queueRow.id]);
      continue;
    }

    const payloadRecord = getPayloadRecord(parsedPayload);

    if (!payloadRecord) {
      db.runSync("DELETE FROM sync_queue WHERE id = ?;", [queueRow.id]);
      continue;
    }

    const payloadId = getPayloadId(payloadRecord);

    if (!payloadId) {
      continue;
    }

    const mappedId = idMapByTable[queueRow.table_name].get(payloadId);

    if (mappedId) {
      assignPayloadId(payloadRecord, mappedId);
      db.runSync("UPDATE sync_queue SET payload = ? WHERE id = ?;", [
        JSON.stringify(payloadRecord),
        queueRow.id,
      ]);
      continue;
    }

    if (isValidUuid(payloadId)) {
      continue;
    }

    if (queueRow.operation === "INSERT") {
      const nextId = createUuid();
      db.runSync(`UPDATE ${queueRow.table_name} SET id = ? WHERE id = ?;`, [
        nextId,
        payloadId,
      ]);
      assignPayloadId(payloadRecord, nextId);
      db.runSync("UPDATE sync_queue SET payload = ? WHERE id = ?;", [
        JSON.stringify(payloadRecord),
        queueRow.id,
      ]);
      continue;
    }

    // Invalid UUIDs in UPDATE/DELETE payloads cannot map to Supabase rows; drop these stale queue rows.
    db.runSync("DELETE FROM sync_queue WHERE id = ?;", [queueRow.id]);
  }
}

function runLocalIdRepairMigration() {
  const idMapByTable = replaceInvalidLogIds();
  repairSyncQueuePayloadIds(idMapByTable);
}

function hasColumn(tableName: string, columnName: string) {
  const columns = db.getAllSync<TableColumnInfoRow>(
    `PRAGMA table_info(${tableName});`,
  );

  return columns.some((column) => column.name === columnName);
}

function ensureColumn(
  tableName: string,
  columnName: string,
  definition: string,
) {
  if (hasColumn(tableName, columnName)) {
    return;
  }

  db.execSync(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`,
  );
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

function sanitizeBodyPartNameForStorage(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeBodyPartNameForStorage(value: string | null | undefined) {
  return sanitizeBodyPartNameForStorage(value).toLowerCase();
}

function backfillUserBodyPartsFromPainLogs() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS user_body_parts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_user_body_parts_user_updated ON user_body_parts(user_id, updated_at DESC);
  `);

  const existingRows = db.getAllSync<{ user_id: string; name: string | null }>(
    `
      SELECT user_id, name
      FROM user_body_parts
      WHERE name IS NOT NULL AND TRIM(name) <> '';
    `,
  );

  const existingKeys = new Set<string>();

  for (const existingRow of existingRows) {
    const normalizedName = normalizeBodyPartNameForStorage(existingRow.name);

    if (!normalizedName) {
      continue;
    }

    existingKeys.add(`${existingRow.user_id}:${normalizedName}`);
  }

  const painRows = db.getAllSync<{
    user_id: string;
    body_part: string | null;
    logged_at: string | null;
  }>(
    `
      SELECT user_id, body_part, logged_at
      FROM pain_logs
      WHERE body_part IS NOT NULL AND TRIM(body_part) <> ''
      ORDER BY logged_at DESC;
    `,
  );

  for (const painRow of painRows) {
    const sanitizedName = sanitizeBodyPartNameForStorage(painRow.body_part);
    const normalizedName = normalizeBodyPartNameForStorage(sanitizedName);

    if (!sanitizedName || !normalizedName) {
      continue;
    }

    const dedupeKey = `${painRow.user_id}:${normalizedName}`;

    if (existingKeys.has(dedupeKey)) {
      continue;
    }

    const timestamp = painRow.logged_at ?? new Date().toISOString();

    db.runSync(
      `
        INSERT INTO user_body_parts (id, user_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?);
      `,
      [createUuid(), painRow.user_id, sanitizedName, timestamp, timestamp],
    );

    existingKeys.add(dedupeKey);
  }
}

function normalizeStressLevelWithoutNone(
  value: unknown,
): "low" | "moderate" | "high" | null {
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();

    if (lowered === "low" || lowered === "moderate" || lowered === "high") {
      return lowered;
    }

    if (lowered === "mid") {
      return "moderate";
    }

    if (lowered === "none") {
      return "low";
    }

    return "low";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 3) return "low";
    if (value <= 6) return "moderate";

    return "high";
  }

  return null;
}

function normalizeUserItemName(
  value: unknown,
  fallbackName = DEFAULT_USER_ITEM_NAME,
) {
  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (trimmedValue.length > 0) {
      return trimmedValue;
    }
  }

  const trimmedFallbackName = fallbackName.trim();

  return trimmedFallbackName.length > 0
    ? trimmedFallbackName
    : DEFAULT_USER_ITEM_NAME;
}

function normalizeUserItemQuantity(
  value: unknown,
  fallbackQuantity = DEFAULT_USER_ITEM_QUANTITY,
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value.trim());

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return fallbackQuantity;
}

function normalizeUserItemUnit(
  value: unknown,
  fallbackUnit = DEFAULT_USER_ITEM_UNIT,
) {
  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (trimmedValue.length > 0) {
      return trimmedValue;
    }
  }

  const trimmedFallbackUnit = fallbackUnit.trim();

  return trimmedFallbackUnit.length > 0
    ? trimmedFallbackUnit
    : DEFAULT_USER_ITEM_UNIT;
}

function parseUserItemDisplayName(displayName: string | null | undefined) {
  const trimmedDisplayName = displayName?.trim() ?? "";

  if (trimmedDisplayName.length === 0) {
    return {
      inferredName: null,
      inferredQuantity: null,
      inferredUnit: null,
    };
  }

  const [nameSegment, trailingSegmentRaw] = trimmedDisplayName.split("•");
  const inferredName = nameSegment?.trim() || null;
  const trailingSegment = trailingSegmentRaw?.trim() || null;

  if (!trailingSegment) {
    return {
      inferredName,
      inferredQuantity: null,
      inferredUnit: null,
    };
  }

  const quantityAndUnitMatch = trailingSegment.match(
    /^(-?\d+(?:\.\d+)?)\s*(.*)$/,
  );

  if (!quantityAndUnitMatch) {
    return {
      inferredName,
      inferredQuantity: null,
      inferredUnit: trailingSegment,
    };
  }

  const parsedQuantity = Number(quantityAndUnitMatch[1]);
  const inferredUnit = quantityAndUnitMatch[2]?.trim() || null;

  return {
    inferredName,
    inferredQuantity: Number.isFinite(parsedQuantity) ? parsedQuantity : null,
    inferredUnit,
  };
}

function backfillMasterItemRequiredFieldsForTable(
  tableName: UserItemTableName,
) {
  const rows = db.getAllSync<UserItemBackfillRow>(
    `
      SELECT id, name, quantity, unit, display_name
      FROM ${tableName}
      WHERE
        name IS NULL OR TRIM(name) = '' OR
        quantity IS NULL OR
        unit IS NULL OR TRIM(unit) = '';
    `,
  );

  for (const row of rows) {
    const parsedDisplayName = parseUserItemDisplayName(row.display_name);
    const nextName = normalizeUserItemName(
      row.name,
      parsedDisplayName.inferredName ?? DEFAULT_USER_ITEM_NAME,
    );
    const nextQuantity = normalizeUserItemQuantity(
      row.quantity,
      parsedDisplayName.inferredQuantity ?? DEFAULT_USER_ITEM_QUANTITY,
    );
    const nextUnit = normalizeUserItemUnit(
      row.unit,
      parsedDisplayName.inferredUnit ?? DEFAULT_USER_ITEM_UNIT,
    );

    if (
      row.name === nextName &&
      row.quantity === nextQuantity &&
      row.unit === nextUnit
    ) {
      continue;
    }

    db.runSync(
      `
        UPDATE ${tableName}
        SET name = ?, quantity = ?, unit = ?
        WHERE id = ?;
      `,
      [nextName, nextQuantity, nextUnit, row.id],
    );
  }
}

function backfillMasterItemRequiredFields() {
  backfillMasterItemRequiredFieldsForTable("user_medicines");
  backfillMasterItemRequiredFieldsForTable("user_foods");
}

function migrateUserItemQueuePayloadRequiredFields() {
  const queueRows = db.getAllSync<QueueRowForMigration>(
    `
      SELECT id, table_name, operation, payload
      FROM sync_queue
      WHERE table_name IN ('user_medicines', 'user_foods') AND operation IN ('INSERT', 'UPDATE');
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

    const writePayload = getPayloadRecord(getWritePayload(payloadRecord));

    if (!writePayload) {
      continue;
    }

    const parsedDisplayName = parseUserItemDisplayName(
      (typeof payloadRecord.display_name === "string"
        ? payloadRecord.display_name
        : null) ??
        (typeof writePayload.display_name === "string"
          ? writePayload.display_name
          : null),
    );
    const hasNameKey = Object.prototype.hasOwnProperty.call(
      writePayload,
      "name",
    );
    const hasQuantityKey = Object.prototype.hasOwnProperty.call(
      writePayload,
      "quantity",
    );
    const hasUnitKey = Object.prototype.hasOwnProperty.call(
      writePayload,
      "unit",
    );

    if (
      queueRow.operation !== "INSERT" &&
      !hasNameKey &&
      !hasQuantityKey &&
      !hasUnitKey
    ) {
      continue;
    }

    let didChange = false;

    if (queueRow.operation === "INSERT" || hasNameKey) {
      const normalizedName = normalizeUserItemName(
        writePayload.name,
        parsedDisplayName.inferredName ?? DEFAULT_USER_ITEM_NAME,
      );

      if (writePayload.name !== normalizedName) {
        writePayload.name = normalizedName;
        didChange = true;
      }
    }

    if (queueRow.operation === "INSERT" || hasQuantityKey) {
      const normalizedQuantity = normalizeUserItemQuantity(
        writePayload.quantity,
        parsedDisplayName.inferredQuantity ?? DEFAULT_USER_ITEM_QUANTITY,
      );

      if (writePayload.quantity !== normalizedQuantity) {
        writePayload.quantity = normalizedQuantity;
        didChange = true;
      }
    }

    if (queueRow.operation === "INSERT" || hasUnitKey) {
      const normalizedUnit = normalizeUserItemUnit(
        writePayload.unit,
        parsedDisplayName.inferredUnit ?? DEFAULT_USER_ITEM_UNIT,
      );

      if (writePayload.unit !== normalizedUnit) {
        writePayload.unit = normalizedUnit;
        didChange = true;
      }
    }

    if (!didChange) {
      continue;
    }

    db.runSync("UPDATE sync_queue SET payload = ? WHERE id = ?;", [
      JSON.stringify(parsedPayload),
      queueRow.id,
    ]);
  }
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
    db.runSync("UPDATE sync_queue SET payload = ? WHERE id = ?;", [
      JSON.stringify(parsedPayload),
      queueRow.id,
    ]);
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

function backfillSyncQueueUserIds() {
  const queueRows = db.getAllSync<{ id: string; payload: string }>(
    `
      SELECT id, payload
      FROM sync_queue
      WHERE user_id IS NULL;
    `,
  );

  for (const queueRow of queueRows) {
    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(queueRow.payload);
    } catch {
      continue;
    }

    const payloadUserId = getPayloadUserId(parsedPayload);

    if (!payloadUserId) {
      continue;
    }

    db.runSync("UPDATE sync_queue SET user_id = ? WHERE id = ?;", [
      payloadUserId,
      queueRow.id,
    ]);
  }
}

function applySchemaMigrations() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS user_body_parts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  ensureColumn("medicine_logs", "item_display_name", "TEXT");
  ensureColumn("medicine_logs", "item_name", "TEXT");
  ensureColumn("medicine_logs", "item_quantity", "REAL");
  ensureColumn("medicine_logs", "item_unit", "TEXT");
  ensureColumn("food_logs", "item_display_name", "TEXT");
  ensureColumn("food_logs", "item_name", "TEXT");
  ensureColumn("food_logs", "item_quantity", "REAL");
  ensureColumn("food_logs", "item_unit", "TEXT");
  ensureColumn("sync_queue", "user_id", "TEXT");

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_user_id ON sync_queue(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_medicines_user_id ON user_medicines(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_foods_user_id ON user_foods(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_body_parts_user_updated ON user_body_parts(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pain_logs_user_logged_at ON pain_logs(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_stress_logs_user_logged_at ON stress_logs(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_medicine_logs_user_logged_at ON medicine_logs(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged_at ON food_logs(user_id, logged_at);
  `);

  backfillSyncQueueUserIds();
  migrateStressLevelsWithoutNone();
  backfillMasterItemRequiredFields();
  migrateUserItemQueuePayloadRequiredFields();
  backfillLogItemDisplayNames();
  backfillUserBodyPartsFromPainLogs();
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

    CREATE TABLE IF NOT EXISTS user_body_parts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS daily_environmental_context (
      id TEXT PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,
      avg_temperature REAL,
      max_humidity REAL,
      barometric_pressure REAL,
      weather_condition TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
      payload TEXT NOT NULL,
      user_id TEXT,
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
  options?: {
    userId?: string | null;
  },
) {
  const id = createQueueId();
  const payloadUserId = getPayloadUserId(payload);
  const queueUserId = options?.userId ?? payloadUserId ?? null;

  db.runSync(
    `
      INSERT INTO sync_queue (id, table_name, operation, payload, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `,
    [
      id,
      tableName,
      operation,
      JSON.stringify(payload),
      queueUserId,
      new Date().toISOString(),
    ],
  );

  return id;
}

export function getSyncQueue(userId?: string | null) {
  if (userId) {
    return db.getAllSync<SyncQueueRow>(
      `
        SELECT id, table_name, operation, payload, user_id, created_at
        FROM sync_queue
        WHERE user_id = ?
        ORDER BY created_at ASC;
      `,
      [userId],
    );
  }

  return db.getAllSync<SyncQueueRow>(
    `
      SELECT id, table_name, operation, payload, user_id, created_at
      FROM sync_queue
      ORDER BY created_at ASC;
    `,
  );
}

export function removeFromSyncQueue(id: string) {
  db.runSync("DELETE FROM sync_queue WHERE id = ?;", [id]);
}

export function getPendingSyncCount(userId?: string | null) {
  const row = userId
    ? db.getFirstSync<{ count: number }>(
        "SELECT COUNT(1) AS count FROM sync_queue WHERE user_id = ?;",
        [userId],
      )
    : db.getFirstSync<{ count: number }>(
        "SELECT COUNT(1) AS count FROM sync_queue;",
        [],
      );

  return Number(row?.count ?? 0);
}

export function getPendingSyncCountForTable(
  tableName: string,
  userId?: string | null,
) {
  const row = userId
    ? db.getFirstSync<{ count: number }>(
        "SELECT COUNT(1) AS count FROM sync_queue WHERE table_name = ? AND user_id = ?;",
        [tableName, userId],
      )
    : db.getFirstSync<{ count: number }>(
        "SELECT COUNT(1) AS count FROM sync_queue WHERE table_name = ?;",
        [tableName],
      );

  return Number(row?.count ?? 0);
}

export function setSyncMeta(key: string, value: string | null) {
  if (value === null) {
    db.runSync("DELETE FROM sync_meta WHERE key = ?;", [key]);
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
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = ?;",
    [key],
  );

  return row?.value ?? null;
}

export function getLocalDisplayName(userId: string) {
  const row = db.getFirstSync<{ display_name: string | null }>(
    "SELECT display_name FROM user_settings WHERE user_id = ?;",
    [userId],
  );

  return row?.display_name ?? null;
}

export function subscribeLocalDisplayNameChanges(
  listener: LocalDisplayNameChangeListener,
) {
  localDisplayNameChangeListeners.add(listener);

  return () => {
    localDisplayNameChangeListeners.delete(listener);
  };
}

export function notifyLocalDisplayNameChanged(
  userId: string,
  displayName: string | null,
) {
  for (const listener of localDisplayNameChangeListeners) {
    try {
      listener({ userId, displayName });
    } catch {
      // Keep local DB writes authoritative even if a listener fails.
    }
  }
}

export function upsertLocalDisplayName(
  userId: string,
  displayName: string | null,
) {
  db.runSync(
    `
      INSERT OR REPLACE INTO user_settings (user_id, display_name, updated_at)
      VALUES (?, ?, ?);
    `,
    [userId, displayName, new Date().toISOString()],
  );
}
