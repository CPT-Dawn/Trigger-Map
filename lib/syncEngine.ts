import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { db, getSyncQueue, removeFromSyncQueue } from './localDb';
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

let syncInFlight: Promise<void> | null = null;

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

    if (lowered === 'none' || lowered === 'low' || lowered === 'moderate' || lowered === 'high') {
      return lowered;
    }

    if (lowered === 'mid') {
      return 'moderate';
    }

    return 'none';
  }

  if (typeof level === 'number' && Number.isFinite(level)) {
    if (level <= 0) return 'none';
    if (level <= 3) return 'low';
    if (level <= 6) return 'moderate';

    return 'high';
  }

  return null;
}

async function runQueueOperation(row: QueueRow) {
  const payload = parseQueuePayload(row.payload);

  if (payload === null) {
    throw new Error(`Invalid queue payload for ${row.id}.`);
  }

  if (row.operation === 'INSERT') {
    const { error } = await supabase.from(row.table_name).insert(getWritePayload(payload) as never);

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
      .update(getWritePayload(payload) as never)
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
  try {
    const networkState = await NetInfo.fetch();

    if (!isOnline(networkState)) {
      return;
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
      } catch (error: any) {
        if (error?.code === '22P02') {
          // Malformed UUID payloads can never sync to Supabase UUID columns.
          removeFromSyncQueue(row.id);
          console.warn('[sync] Dropped malformed queue row with invalid UUID payload', { rowId: row.id });
          continue;
        }

        console.warn('[sync] Failed to push queue row', { rowId: row.id, error });
      }
    }
  } catch (error) {
    console.warn('[sync] Failed while pushing local changes', error);
  }
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
        INSERT OR REPLACE INTO medicine_logs
        (id, user_id, medicine_id, logged_at, log_date)
        VALUES (?, ?, ?, ?, ?);
      `,
      [row.id, row.user_id, row.medicine_id, row.logged_at, row.log_date],
    );
  }
}

function upsertFoodLogs(rows: FoodLogRow[]) {
  for (const row of rows) {
    db.runSync(
      `
        INSERT OR REPLACE INTO food_logs
        (id, user_id, food_id, logged_at, log_date)
        VALUES (?, ?, ?, ?, ?);
      `,
      [row.id, row.user_id, row.food_id, row.logged_at, row.log_date],
    );
  }
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
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return;
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
      db.execSync('COMMIT;');
    } catch (error) {
      db.execSync('ROLLBACK;');
      throw error;
    }
  } catch (error) {
    console.warn('[sync] Failed while pulling remote changes', error);
  }
}

export async function runSync() {
  if (syncInFlight) {
    return syncInFlight;
  }

  syncInFlight = (async () => {
    try {
      await pushLocalChanges();
      await pullRemoteChanges();
    } finally {
      syncInFlight = null;
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
