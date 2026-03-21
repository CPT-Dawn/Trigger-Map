import type { PostgrestError } from '@supabase/supabase-js';

import {
  LOG_CATEGORY_ORDER,
  getFirstFilledCategory,
  markOptionUsed,
  type DropdownCategoryKey,
  type DropdownOption,
  type DropdownOptionSource,
} from '@/lib/dropdowns';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '@/lib/supabase';

export type LogView = 'combined' | DropdownCategoryKey;

type LogCategoryView = Exclude<LogView, 'combined'>;

type LogEntryOptionInput = Pick<DropdownOption, 'id' | 'source' | 'label'> | null | undefined;

export type LogEntryInput = {
  loggedAt: string;
  note?: string;
  foodOption?: LogEntryOptionInput;
  painOption?: LogEntryOptionInput;
  stressOption?: LogEntryOptionInput;
  medicineOption?: LogEntryOptionInput;
};

export type LogEntryView = {
  id: string;
  loggedAt: string;
  note: string | null;
  itemsByCategory: Partial<Record<DropdownCategoryKey, DropdownOption>>;
  primaryCategory?: DropdownCategoryKey;
  createdAt: string;
  updatedAt: string;
};

type ResultOk<T> = { data: T; error: null };
type ResultErr = { data: null; error: string };
type ServiceResult<T> = ResultOk<T> | ResultErr;

type LogEntryItemPayload = {
  categoryKey: DropdownCategoryKey;
  optionSource: DropdownOptionSource;
  optionId: string;
  labelSnapshot: string;
};

type LogEntryItemRow = {
  category_key: DropdownCategoryKey;
  option_source: DropdownOptionSource;
  option_id: string;
  label_snapshot: string;
};

type LogEntryRow = {
  id: string;
  logged_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  log_entry_items: LogEntryItemRow[] | null;
};

const FIXED_CATEGORIES = new Set<DropdownCategoryKey>(['pain', 'stress']);

function success<T>(data: T): ResultOk<T> {
  return { data, error: null };
}

function failure<T>(error: string): ServiceResult<T> {
  return { data: null, error };
}

function ensureConfigured<T>(): ServiceResult<T> | null {
  if (!isSupabaseConfigured) {
    return failure<T>(supabaseConfigError);
  }
  return null;
}

function isCategoryView(view: LogView): view is LogCategoryView {
  return view !== 'combined';
}

function toFriendlyError(error: PostgrestError | null, fallback: string) {
  if (!error) return fallback;

  const message = error.message || fallback;
  const lower = message.toLowerCase();

  if (lower.includes('row-level security') || lower.includes('permission') || lower.includes('policy')) {
    return 'You do not have permission to access this log entry.';
  }
  if (lower.includes('duplicate') || lower.includes('unique')) {
    return 'This category is already logged for this entry.';
  }
  if (lower.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  return message;
}

function normalizeNote(note: string | undefined) {
  const trimmed = (note ?? '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 1000);
}

function toTimestampValue(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function normalizeLoggedAt(loggedAt: string): ServiceResult<string> {
  const parsed = toTimestampValue(loggedAt);
  if (parsed === null) {
    return failure('Please choose a valid date and time.');
  }

  return success(new Date(parsed).toISOString());
}

function validateOptionInput(
  categoryKey: DropdownCategoryKey,
  option: LogEntryOptionInput
): ServiceResult<LogEntryItemPayload | null> {
  if (!option) return success(null);

  const optionId = option.id?.trim();
  const label = option.label?.trim();
  if (!optionId) {
    return failure(`Invalid ${categoryKey} option id.`);
  }
  if (!label) {
    return failure(`Invalid ${categoryKey} option label.`);
  }
  if (label.length > 120) {
    return failure(`${categoryKey} option label is too long.`);
  }
  if (FIXED_CATEGORIES.has(categoryKey) && option.source !== 'default') {
    return failure(`${categoryKey} uses fixed options only.`);
  }

  return success({
    categoryKey,
    optionSource: option.source,
    optionId,
    labelSnapshot: label,
  });
}

function normalizeLogInput(input: LogEntryInput): ServiceResult<{
  loggedAt: string;
  note: string | null;
  items: LogEntryItemPayload[];
}> {
  const timestampResult = normalizeLoggedAt(input.loggedAt);
  if (timestampResult.error) return failure(timestampResult.error);
  if (!timestampResult.data) return failure('Please choose a valid date and time.');

  const food = validateOptionInput('food', input.foodOption);
  if (food.error) return failure(food.error);

  const pain = validateOptionInput('pain', input.painOption);
  if (pain.error) return failure(pain.error);

  const stress = validateOptionInput('stress', input.stressOption);
  if (stress.error) return failure(stress.error);

  const medicine = validateOptionInput('medicine', input.medicineOption);
  if (medicine.error) return failure(medicine.error);

  const items = [food.data, pain.data, stress.data, medicine.data].filter(Boolean) as LogEntryItemPayload[];

  if (items.length === 0) {
    return failure('Choose at least one category to save this log.');
  }

  return success({
    loggedAt: timestampResult.data,
    note: normalizeNote(input.note),
    items,
  });
}

function toDropdownOption(item: LogEntryItemRow): DropdownOption {
  return {
    id: item.option_id,
    categoryKey: item.category_key,
    label: item.label_snapshot,
    source: item.option_source,
    lastSelectedAt: null,
  };
}

function mapEntryRow(row: LogEntryRow): LogEntryView {
  const itemsByCategory: Partial<Record<DropdownCategoryKey, DropdownOption>> = {};

  for (const item of row.log_entry_items ?? []) {
    itemsByCategory[item.category_key] = toDropdownOption(item);
  }

  const primaryCategory = getFirstFilledCategory(itemsByCategory);

  return {
    id: row.id,
    loggedAt: row.logged_at,
    note: row.note,
    itemsByCategory,
    primaryCategory,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sortLogEntries(left: LogEntryView, right: LogEntryView) {
  const leftLoggedAt = toTimestampValue(left.loggedAt) ?? Number.NEGATIVE_INFINITY;
  const rightLoggedAt = toTimestampValue(right.loggedAt) ?? Number.NEGATIVE_INFINITY;

  if (leftLoggedAt !== rightLoggedAt) {
    return rightLoggedAt - leftLoggedAt;
  }

  const leftCreatedAt = toTimestampValue(left.createdAt) ?? Number.NEGATIVE_INFINITY;
  const rightCreatedAt = toTimestampValue(right.createdAt) ?? Number.NEGATIVE_INFINITY;

  return rightCreatedAt - leftCreatedAt;
}

async function getAuthenticatedUserId(): Promise<ServiceResult<string>> {
  const configError = ensureConfigured<string>();
  if (configError) return configError;

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return failure('Unable to verify your session. Please sign in again.');
  }

  if (!data.user?.id) {
    return failure('No active user session found. Please sign in again.');
  }

  return success(data.user.id);
}

async function markUsageForItems(items: LogEntryItemPayload[]) {
  await Promise.allSettled(
    items.map((item) => markOptionUsed(item.categoryKey, item.optionSource, item.optionId))
  );
}

function entryHasCategory(entry: LogEntryView, category: LogCategoryView) {
  return Boolean(entry.itemsByCategory[category]);
}

export async function createLogEntry(input: LogEntryInput): Promise<ServiceResult<LogEntryView>> {
  const configError = ensureConfigured<LogEntryView>();
  if (configError) return configError;

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;

  const normalized = normalizeLogInput(input);
  if (normalized.error) return failure(normalized.error);
  if (!normalized.data) return failure('Unable to prepare log payload.');
  const normalizedData = normalized.data;

  const entryInsert = await supabase
    .from('log_entries')
    .insert({
      user_id: userId,
      logged_at: normalizedData.loggedAt,
      note: normalizedData.note,
    })
    .select('id')
    .single();

  if (entryInsert.error || !entryInsert.data?.id) {
    return failure(toFriendlyError(entryInsert.error, 'Unable to create the log entry.'));
  }

  const entryId = entryInsert.data.id;

  const itemRows = normalizedData.items.map((item) => ({
    entry_id: entryId,
    user_id: userId,
    category_key: item.categoryKey,
    option_source: item.optionSource,
    option_id: item.optionId,
    label_snapshot: item.labelSnapshot,
  }));

  const itemInsert = await supabase.from('log_entry_items').insert(itemRows);
  if (itemInsert.error) {
    await supabase.from('log_entries').delete().eq('id', entryId).eq('user_id', userId);
    return failure(toFriendlyError(itemInsert.error, 'Unable to save log categories.'));
  }

  await markUsageForItems(normalizedData.items);

  const created = await getLogEntryById(entryId);
  if (created.error) return failure(created.error);
  if (!created.data) return failure('Created log entry could not be loaded.');
  return success(created.data);
}

export async function updateLogEntry(entryId: string, input: LogEntryInput): Promise<ServiceResult<LogEntryView>> {
  const configError = ensureConfigured<LogEntryView>();
  if (configError) return configError;

  const cleanEntryId = entryId.trim();
  if (!cleanEntryId) {
    return failure('Log entry id is required.');
  }

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;

  const normalized = normalizeLogInput(input);
  if (normalized.error) return failure(normalized.error);
  if (!normalized.data) return failure('Unable to prepare log payload.');
  const normalizedData = normalized.data;

  const updateResponse = await supabase
    .from('log_entries')
    .update({
      logged_at: normalizedData.loggedAt,
      note: normalizedData.note,
    })
    .eq('id', cleanEntryId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (updateResponse.error) {
    return failure(toFriendlyError(updateResponse.error, 'Unable to update the log entry.'));
  }
  if (!updateResponse.data?.id) {
    return failure('Log entry not found.');
  }

  const existingItems = await supabase
    .from('log_entry_items')
    .select('category_key')
    .eq('entry_id', cleanEntryId)
    .eq('user_id', userId);

  if (existingItems.error) {
    return failure(toFriendlyError(existingItems.error, 'Unable to load existing log categories.'));
  }

  const upsertRows = normalizedData.items.map((item) => ({
    entry_id: cleanEntryId,
    user_id: userId,
    category_key: item.categoryKey,
    option_source: item.optionSource,
    option_id: item.optionId,
    label_snapshot: item.labelSnapshot,
  }));

  const upsertResponse = await supabase.from('log_entry_items').upsert(upsertRows, {
    onConflict: 'entry_id,category_key',
  });

  if (upsertResponse.error) {
    return failure(toFriendlyError(upsertResponse.error, 'Unable to update log categories.'));
  }

  const selectedCategorySet = new Set(normalizedData.items.map((item) => item.categoryKey));
  const removedCategories = (existingItems.data ?? [])
    .map((item) => item.category_key)
    .filter((category): category is DropdownCategoryKey =>
      category === 'food' || category === 'pain' || category === 'stress' || category === 'medicine'
    )
    .filter((category) => !selectedCategorySet.has(category));

  if (removedCategories.length > 0) {
    const deleteRemoved = await supabase
      .from('log_entry_items')
      .delete()
      .eq('entry_id', cleanEntryId)
      .eq('user_id', userId)
      .in('category_key', removedCategories);

    if (deleteRemoved.error) {
      return failure(toFriendlyError(deleteRemoved.error, 'Unable to remove unselected categories.'));
    }
  }

  await markUsageForItems(normalizedData.items);

  const updated = await getLogEntryById(cleanEntryId);
  if (updated.error) return failure(updated.error);
  if (!updated.data) return failure('Updated log entry could not be loaded.');
  return success(updated.data);
}

export async function getLogEntries(view: LogView, limit = 50, cursor?: string): Promise<ServiceResult<LogEntryView[]>> {
  const configError = ensureConfigured<LogEntryView[]>();
  if (configError) return configError;

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;

  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const parsedCursor = Number.parseInt(cursor ?? '0', 10);
  const offset = Number.isNaN(parsedCursor) || parsedCursor < 0 ? 0 : parsedCursor;
  const queryLimit = view === 'combined' ? safeLimit : Math.max(safeLimit * 4, 40);

  const response = await supabase
    .from('log_entries')
    .select(
      'id, logged_at, note, created_at, updated_at, log_entry_items(category_key, option_source, option_id, label_snapshot)'
    )
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + queryLimit - 1);

  if (response.error) {
    return failure(toFriendlyError(response.error, 'Unable to load logs.'));
  }

  const entries = ((response.data ?? []) as LogEntryRow[]).map(mapEntryRow);
  const filtered = isCategoryView(view) ? entries.filter((entry) => entryHasCategory(entry, view)) : entries;

  filtered.sort(sortLogEntries);
  return success(filtered.slice(0, safeLimit));
}

export async function getLogEntryById(entryId: string): Promise<ServiceResult<LogEntryView>> {
  const configError = ensureConfigured<LogEntryView>();
  if (configError) return configError;

  const cleanEntryId = entryId.trim();
  if (!cleanEntryId) {
    return failure('Log entry id is required.');
  }

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;

  const response = await supabase
    .from('log_entries')
    .select(
      'id, logged_at, note, created_at, updated_at, log_entry_items(category_key, option_source, option_id, label_snapshot)'
    )
    .eq('id', cleanEntryId)
    .eq('user_id', userId)
    .maybeSingle();

  if (response.error) {
    return failure(toFriendlyError(response.error, 'Unable to load this log entry.'));
  }
  if (!response.data) {
    return failure('Log entry not found.');
  }

  const entry = mapEntryRow(response.data as LogEntryRow);

  const hasAnyItem = LOG_CATEGORY_ORDER.some((category) => Boolean(entry.itemsByCategory[category]));
  if (!hasAnyItem) {
    return failure('This log entry has no categories and cannot be edited.');
  }

  return success(entry);
}

export async function deleteLogEntry(entryId: string): Promise<ServiceResult<true>> {
  const configError = ensureConfigured<true>();
  if (configError) return configError;

  const cleanEntryId = entryId.trim();
  if (!cleanEntryId) {
    return failure('Log entry id is required.');
  }

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;

  const response = await supabase
    .from('log_entries')
    .delete()
    .eq('id', cleanEntryId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (response.error) {
    return failure(toFriendlyError(response.error, 'Unable to delete this log entry.'));
  }
  if (!response.data?.id) {
    return failure('Log entry not found.');
  }

  return success(true);
}
