import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import {
  db,
  getPendingSyncCount,
  getPendingSyncCountForTable,
  getSyncMeta,
  getSyncQueue,
  removeFromSyncQueue,
  setSyncMeta,
  upsertLocalDisplayName,
} from './localDb';
import { supabase } from './supabase';

type QueueOperation = 'INSERT' | 'UPDATE' | 'DELETE';
type LogTableName = 'pain_logs' | 'stress_logs' | 'medicine_logs' | 'food_logs';

interface QueueRow {
  id: string;
  table_name: string;
  operation: QueueOperation;
  payload: string;
  created_at: string;
}

interface UserItemRow {
  id: string;
  user_id: string;
  name: string | null;
  quantity: number | null;
  unit: string | null;
  display_name: string | null;
}

interface PainLogRow {
  id: string;
  user_id: string;
  logged_at: string;
  log_date: string;
  body_part: string | null;
  pain_level: number | null;
  swelling: boolean | null;
}

interface StressLogRow {
  id: string;
  user_id: string;
  logged_at: string;
  log_date: string;
  level: string | number | null;
}

interface MedicineLogRow {
  id: string;
  user_id: string;
  medicine_id: string;
  logged_at: string;
  log_date: string;
}

interface FoodLogRow {
  id: string;
  user_id: string;
  food_id: string;
  logged_at: string;
  log_date: string;
}

export const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

export interface SyncStatusSnapshot {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

let syncInFlight: Promise<void> | null = null;
let syncStatus: SyncStatusSnapshot = {
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
};

const syncStatusListeners = new Set<(status: SyncStatusSnapshot) => void>();

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown sync error';
  }
}

function notifySyncStatusListeners() {
  const snapshot = { ...syncStatus };

  for (const listener of syncStatusListeners) {
    listener(snapshot);
  }
}

function updateSyncStatus(partial: Partial<SyncStatusSnapshot>) {
  syncStatus = {
    ...syncStatus,
    ...partial,
  };

  notifySyncStatusListeners();
}

function recordSyncError(error: unknown) {
  const errorMessage = getErrorMessage(error);

  try {
    setSyncMeta('last_sync_error', errorMessage);
  } catch {
    // Keep in-memory status even if persistent metadata write fails.
  }

  updateSyncStatus({
    lastError: errorMessage,
  });
}

export function getSyncStatusSnapshot() {
  return { ...syncStatus };
}

export function subscribeSyncStatus(listener: (status: SyncStatusSnapshot) => void) {
  syncStatusListeners.add(listener);
  listener({ ...syncStatus });

  return () => {
    syncStatusListeners.delete(listener);
  };
}

export function refreshSyncStatusSnapshot() {
  try {
    updateSyncStatus({
      pendingCount: getPendingSyncCount(),
      lastSyncAt: getSyncMeta('last_sync_at'),
      lastError: getSyncMeta('last_sync_error'),
    });
  } catch {
    // If local DB isn't initialized yet, keep existing in-memory status.
  }

  return getSyncStatusSnapshot();
}

function isOnline(state: NetInfoState) {
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

function parseQueuePayload(rawPayload: string): unknown {
  try {
    return JSON.parse(rawPayload);
  } catch {
    return null;
  }
}

function getPayloadRecord(payload: unknown) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }

  return null;
}

function getPayloadRowId(payload: unknown) {
  const payloadRecord = getPayloadRecord(payload);

  if (!payloadRecord) {
    return null;
  }

  const directId = payloadRecord.id;

  if (typeof directId === 'string' && directId.length > 0) {
    return directId;
  }

  const rowRecord = getPayloadRecord(payloadRecord.row);
  const dataRecord = getPayloadRecord(payloadRecord.data);

  const nestedId = rowRecord?.id ?? dataRecord?.id;

  return typeof nestedId === 'string' && nestedId.length > 0 ? nestedId : null;
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

function normalizeStressLevel(level: StressLogRow['level']) {
  if (typeof level === 'string') {
    const lowered = level.trim().toLowerCase();

    if (lowered === 'low' || lowered === 'moderate' || lowered === 'high') {
      return lowered;
    }

    if (lowered === 'none') {
      return 'low';
    }

    if (lowered === 'mid') {
      return 'moderate';
    }

    return 'low';
  }

  if (typeof level === 'number' && Number.isFinite(level)) {
    if (level <= 0) return 'low';
    if (level <= 3) return 'low';
    if (level <= 6) return 'moderate';

    return 'high';
  }

  return 'low';
}

function normalizeStressWritePayload(payload: unknown) {
  const payloadRecord = getPayloadRecord(payload);

  if (!payloadRecord) {
    return payload;
  }

  payloadRecord.level = normalizeStressLevel(payloadRecord.level as StressLogRow['level']);

  return payloadRecord;
}

function resolveRemoteDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  const metadata = user.user_metadata ?? {};
  const displayName = typeof metadata.display_name === 'string' ? metadata.display_name.trim() : '';

  if (displayName.length > 0) {
    return displayName;
  }

  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';

  if (fullName.length > 0) {
    return fullName;
  }

  const emailPrefix = user.email?.split('@')[0]?.trim() ?? '';

  return emailPrefix.length > 0 ? emailPrefix : null;
}

async function runQueueOperation(row: QueueRow) {
  const payload = parseQueuePayload(row.payload);

  if (payload === null) {
    throw new Error(`Invalid queue payload for ${row.id}.`);
  }

  if (row.table_name === 'auth_profile') {
    const payloadRecord = getPayloadRecord(getWritePayload(payload));
    const displayName = typeof payloadRecord?.display_name === 'string' ? payloadRecord.display_name.trim() : '';

    if (displayName.length === 0) {
      throw new Error(`Missing display_name for auth_profile update in ${row.id}.`);
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: displayName,
      },
    });

    if (error) {
      throw error;
    }

    return;
  }

  const writePayload = getWritePayload(payload);
  const normalizedWritePayload =
    row.table_name === 'stress_logs' ? normalizeStressWritePayload(writePayload) : writePayload;

  if (row.operation === 'INSERT') {
    const { error } = await supabase.from(row.table_name).insert(normalizedWritePayload as never);

    if (error) {
      throw error;
    }

    return;
  }

  if (row.operation === 'UPDATE') {
    const rowId = getPayloadRowId(payload);

    if (!rowId) {
      throw new Error(`Missing row id for UPDATE in ${row.id}.`);
    }

    const { error } = await supabase
      .from(row.table_name)
      .update(normalizedWritePayload as never)
      .eq('id', rowId);

    if (error) {
      throw error;
    }

    return;
  }

  const rowId = getPayloadRowId(payload);

  if (!rowId) {
    throw new Error(`Missing row id for DELETE in ${row.id}.`);
  }

  const { error } = await supabase.from(row.table_name).delete().eq('id', rowId);

  if (error) {
    throw error;
  }
}

export async function pushLocalChanges() {
  let hadError = false;

  try {
    const networkState = await NetInfo.fetch();

    if (!isOnline(networkState)) {
      return false;
    }

    const queue = getSyncQueue() as QueueRow[];

    for (const row of queue) {
      try {
        const latestState = await NetInfo.fetch();

        if (!isOnline(latestState)) {
          break;
        }

        await runQueueOperation(row);
        removeFromSyncQueue(row.id);
        updateSyncStatus({ pendingCount: Math.max(0, syncStatus.pendingCount - 1) });
      } catch (error: any) {
        if (error?.code === '22P02') {
          // Malformed UUID payloads can never sync to Supabase UUID columns.
          removeFromSyncQueue(row.id);
          console.warn('[sync] Dropped malformed queue row with invalid UUID payload', { rowId: row.id });
          updateSyncStatus({ pendingCount: Math.max(0, syncStatus.pendingCount - 1) });
          continue;
        }

        console.warn('[sync] Failed to push queue row', { rowId: row.id, error });
        recordSyncError(error);
        hadError = true;
      }
    }

    refreshSyncStatusSnapshot();
  } catch (error) {
    console.warn('[sync] Failed while pushing local changes', error);
    recordSyncError(error);
    hadError = true;
  }

  return !hadError;
}

function upsertUserMedicines(rows: UserItemRow[]) {
  for (const row of rows) {
    db.runSync(
      `
        INSERT OR REPLACE INTO user_medicines
        (id, user_id, name, quantity, unit, display_name)
        VALUES (?, ?, ?, ?, ?, ?);
      `,
      [row.id, row.user_id, row.name, row.quantity, row.unit, row.display_name],
    );
  }
}

function upsertUserFoods(rows: UserItemRow[]) {
  for (const row of rows) {
    db.runSync(
      `
        INSERT OR REPLACE INTO user_foods
        (id, user_id, name, quantity, unit, display_name)
        VALUES (?, ?, ?, ?, ?, ?);
      `,
      [row.id, row.user_id, row.name, row.quantity, row.unit, row.display_name],
    );
  }
}

function upsertPainLogs(rows: PainLogRow[]) {
  for (const row of rows) {
    db.runSync(
      `
        INSERT OR REPLACE INTO pain_logs
        (id, user_id, logged_at, log_date, body_part, pain_level, swelling)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `,
      [
        row.id,
        row.user_id,
        row.logged_at,
        row.log_date,
        row.body_part,
        row.pain_level,
        row.swelling === null ? null : row.swelling ? 1 : 0,
      ],
    );
  }
}

function upsertStressLogs(rows: StressLogRow[]) {
  for (const row of rows) {
    db.runSync(
      `
        INSERT OR REPLACE INTO stress_logs
        (id, user_id, logged_at, log_date, level)
        VALUES (?, ?, ?, ?, ?);
      `,
      [row.id, row.user_id, row.logged_at, row.log_date, normalizeStressLevel(row.level)],
    );
  }
}

function upsertMedicineLogs(rows: MedicineLogRow[]) {
  for (const row of rows) {
    db.runSync(
      `
        INSERT INTO medicine_logs
        (id, user_id, medicine_id, logged_at, log_date)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          medicine_id = excluded.medicine_id,
          item_display_name = CASE
            WHEN medicine_logs.medicine_id = excluded.medicine_id THEN medicine_logs.item_display_name
            ELSE NULL
          END,
          item_name = CASE
            WHEN medicine_logs.medicine_id = excluded.medicine_id THEN medicine_logs.item_name
            ELSE NULL
          END,
          item_quantity = CASE
            WHEN medicine_logs.medicine_id = excluded.medicine_id THEN medicine_logs.item_quantity
            ELSE NULL
          END,
          item_unit = CASE
            WHEN medicine_logs.medicine_id = excluded.medicine_id THEN medicine_logs.item_unit
            ELSE NULL
          END,
          logged_at = excluded.logged_at,
          log_date = excluded.log_date;
      `,
      [row.id, row.user_id, row.medicine_id, row.logged_at, row.log_date],
    );
  }
}

function upsertFoodLogs(rows: FoodLogRow[]) {
  for (const row of rows) {
    db.runSync(
      `
        INSERT INTO food_logs
        (id, user_id, food_id, logged_at, log_date)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          food_id = excluded.food_id,
          item_display_name = CASE
            WHEN food_logs.food_id = excluded.food_id THEN food_logs.item_display_name
            ELSE NULL
          END,
          item_name = CASE
            WHEN food_logs.food_id = excluded.food_id THEN food_logs.item_name
            ELSE NULL
          END,
          item_quantity = CASE
            WHEN food_logs.food_id = excluded.food_id THEN food_logs.item_quantity
            ELSE NULL
          END,
          item_unit = CASE
            WHEN food_logs.food_id = excluded.food_id THEN food_logs.item_unit
            ELSE NULL
          END,
          logged_at = excluded.logged_at,
          log_date = excluded.log_date;
      `,
      [row.id, row.user_id, row.food_id, row.logged_at, row.log_date],
    );
  }
}

function backfillRecentLogSnapshots(userId: string) {
  db.runSync(
    `
      UPDATE medicine_logs
      SET item_display_name = (
        SELECT CASE
          WHEN um.display_name IS NOT NULL AND TRIM(um.display_name) <> '' THEN um.display_name
          WHEN um.name IS NOT NULL AND TRIM(um.name) <> '' THEN um.name
          ELSE NULL
        END
        FROM user_medicines AS um
        WHERE um.id = medicine_logs.medicine_id AND um.user_id = medicine_logs.user_id
      ),
      item_name = (
        SELECT um.name
        FROM user_medicines AS um
        WHERE um.id = medicine_logs.medicine_id AND um.user_id = medicine_logs.user_id
      ),
      item_quantity = (
        SELECT um.quantity
        FROM user_medicines AS um
        WHERE um.id = medicine_logs.medicine_id AND um.user_id = medicine_logs.user_id
      ),
      item_unit = (
        SELECT um.unit
        FROM user_medicines AS um
        WHERE um.id = medicine_logs.medicine_id AND um.user_id = medicine_logs.user_id
      )
      WHERE user_id = ? AND (
        item_display_name IS NULL OR TRIM(item_display_name) = '' OR
        item_name IS NULL OR TRIM(item_name) = '' OR
        item_quantity IS NULL OR
        item_unit IS NULL OR TRIM(item_unit) = ''
      );
    `,
    [userId],
  );

  db.runSync(
    `
      UPDATE food_logs
      SET item_display_name = (
        SELECT CASE
          WHEN uf.display_name IS NOT NULL AND TRIM(uf.display_name) <> '' THEN uf.display_name
          WHEN uf.name IS NOT NULL AND TRIM(uf.name) <> '' THEN uf.name
          ELSE NULL
        END
        FROM user_foods AS uf
        WHERE uf.id = food_logs.food_id AND uf.user_id = food_logs.user_id
      ),
      item_name = (
        SELECT uf.name
        FROM user_foods AS uf
        WHERE uf.id = food_logs.food_id AND uf.user_id = food_logs.user_id
      ),
      item_quantity = (
        SELECT uf.quantity
        FROM user_foods AS uf
        WHERE uf.id = food_logs.food_id AND uf.user_id = food_logs.user_id
      ),
      item_unit = (
        SELECT uf.unit
        FROM user_foods AS uf
        WHERE uf.id = food_logs.food_id AND uf.user_id = food_logs.user_id
      )
      WHERE user_id = ? AND (
        item_display_name IS NULL OR TRIM(item_display_name) = '' OR
        item_name IS NULL OR TRIM(item_name) = '' OR
        item_quantity IS NULL OR
        item_unit IS NULL OR TRIM(item_unit) = ''
      );
    `,
    [userId],
  );
}

async function fetchRecentLogsFromSupabase(userId: string) {
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [painResult, stressResult, medicineResult, foodResult] = await Promise.all([
    supabase
      .from('pain_logs')
      .select('id, user_id, logged_at, log_date, body_part, pain_level, swelling')
      .eq('user_id', userId)
      .gte('logged_at', sevenDaysAgoIso),
    supabase
      .from('stress_logs')
      .select('id, user_id, logged_at, log_date, level')
      .eq('user_id', userId)
      .gte('logged_at', sevenDaysAgoIso),
    supabase
      .from('medicine_logs')
      .select('id, user_id, medicine_id, logged_at, log_date')
      .eq('user_id', userId)
      .gte('logged_at', sevenDaysAgoIso),
    supabase
      .from('food_logs')
      .select('id, user_id, food_id, logged_at, log_date')
      .eq('user_id', userId)
      .gte('logged_at', sevenDaysAgoIso),
  ]);

  const firstError = painResult.error || stressResult.error || medicineResult.error || foodResult.error;

  if (firstError) {
    throw firstError;
  }

  return {
    painLogs: (painResult.data ?? []) as PainLogRow[],
    stressLogs: (stressResult.data ?? []) as StressLogRow[],
    medicineLogs: (medicineResult.data ?? []) as MedicineLogRow[],
    foodLogs: (foodResult.data ?? []) as FoodLogRow[],
  };
}

export async function pullRemoteChanges() {
  try {
    const networkState = await NetInfo.fetch();

    if (!isOnline(networkState)) {
      return false;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return false;
    }

    if (getPendingSyncCountForTable('auth_profile') === 0) {
      upsertLocalDisplayName(user.id, resolveRemoteDisplayName(user));
    }

    const [medicinesResult, foodsResult, recentLogs] = await Promise.all([
      supabase
        .from('user_medicines')
        .select('id, user_id, name, quantity, unit, display_name')
        .eq('user_id', user.id),
      supabase
        .from('user_foods')
        .select('id, user_id, name, quantity, unit, display_name')
        .eq('user_id', user.id),
      fetchRecentLogsFromSupabase(user.id),
    ]);

    if (medicinesResult.error) {
      throw medicinesResult.error;
    }

    if (foodsResult.error) {
      throw foodsResult.error;
    }

    db.execSync('BEGIN TRANSACTION;');

    try {
      upsertUserMedicines((medicinesResult.data ?? []) as UserItemRow[]);
      upsertUserFoods((foodsResult.data ?? []) as UserItemRow[]);
      upsertPainLogs(recentLogs.painLogs);
      upsertStressLogs(recentLogs.stressLogs);
      upsertMedicineLogs(recentLogs.medicineLogs);
      upsertFoodLogs(recentLogs.foodLogs);
      backfillRecentLogSnapshots(user.id);
      db.execSync('COMMIT;');
    } catch (error) {
      db.execSync('ROLLBACK;');
      throw error;
    }

    return true;
  } catch (error) {
    console.warn('[sync] Failed while pulling remote changes', error);
    recordSyncError(error);
    return false;
  }
}

export async function runSync() {
  refreshSyncStatusSnapshot();

  if (syncInFlight) {
    return syncInFlight;
  }

  updateSyncStatus({ isSyncing: true });

  syncInFlight = (async () => {
    try {
      const pushSucceeded = await pushLocalChanges();
      const pullSucceeded = await pullRemoteChanges();

      if (pushSucceeded && pullSucceeded) {
        const syncedAt = new Date().toISOString();

        try {
          setSyncMeta('last_sync_at', syncedAt);
          setSyncMeta('last_sync_error', null);
        } catch {
          // Keep in-memory status if metadata persistence fails.
        }

        updateSyncStatus({
          lastSyncAt: syncedAt,
          lastError: null,
        });
      }
    } finally {
      syncInFlight = null;
      refreshSyncStatusSnapshot();
      updateSyncStatus({ isSyncing: false });
    }
  })();

  return syncInFlight;
}

if (!TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      const state = await NetInfo.fetch();

      if (!isOnline(state)) {
        return BackgroundTask.BackgroundTaskResult.Success;
      }

      await runSync();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.warn('[sync] Background sync failed', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundSync() {
  try {
    const status = await BackgroundTask.getStatusAsync();

    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);

    if (isRegistered) {
      return;
    }

    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15,
    });
  } catch (error) {
    console.warn('[sync] Failed to register background sync', error);
  }
}

export function setupNetworkListener() {
  let previousOnlineState: boolean | null = null;

  return NetInfo.addEventListener((state) => {
    const currentlyOnline = isOnline(state);

    if (previousOnlineState === false && currentlyOnline) {
      void runSync();
    }

    previousOnlineState = currentlyOnline;
  });
}
