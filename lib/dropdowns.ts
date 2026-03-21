import type { PostgrestError } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase, supabaseConfigError } from '@/lib/supabase';

export const DROPDOWN_CATEGORY_DEFINITIONS = [
  { key: 'pain_type', label: 'Pain Type' },
  { key: 'activity_type', label: 'Activity Type' },
  { key: 'weather_condition', label: 'Weather Condition' },
  { key: 'trigger_type', label: 'Trigger Type' },
  { key: 'relief_method', label: 'Relief Method' },
] as const;

export type DropdownCategoryKey = (typeof DROPDOWN_CATEGORY_DEFINITIONS)[number]['key'];
export type DropdownOptionSource = 'default' | 'custom';

export type DropdownOption = {
  id: string;
  categoryKey: string;
  label: string;
  source: DropdownOptionSource;
  lastSelectedAt?: string | null;
  hidden?: boolean;
};

type ResultOk<T> = { data: T; error: null };
type ResultErr = { data: null; error: string };
type ServiceResult<T> = ResultOk<T> | ResultErr;

type UsageRow = {
  option_source: DropdownOptionSource;
  option_id: string;
  last_selected_at: string | null;
};

const categoryIdByKeyCache = new Map<string, string>();
const categoryKeyByIdCache = new Map<string, string>();

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

function cleanLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ');
}

function normalizeLabel(label: string) {
  return cleanLabel(label).toLowerCase();
}

function isDuplicateError(error: PostgrestError | null) {
  if (!error) return false;
  return error.code === '23505' || error.message.toLowerCase().includes('duplicate');
}

function toFriendlyError(error: PostgrestError | null, fallback: string) {
  if (!error) return fallback;
  const message = error.message || fallback;
  const lower = message.toLowerCase();

  if (lower.includes('duplicate') || lower.includes('unique')) {
    return 'That option already exists in this dropdown.';
  }
  if (lower.includes('permission') || lower.includes('policy') || lower.includes('row-level security')) {
    return 'You do not have permission to access this dropdown data.';
  }
  if (lower.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  return message;
}

function toTimestampValue(value: string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return Number.NEGATIVE_INFINITY;
  return parsed;
}

function sortDropdownOptions(left: DropdownOption, right: DropdownOption) {
  const leftTime = toTimestampValue(left.lastSelectedAt);
  const rightTime = toTimestampValue(right.lastSelectedAt);

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return left.label.localeCompare(right.label, undefined, {
    sensitivity: 'base',
  });
}

function validateOptionLabel(label: string): ServiceResult<string> {
  const cleaned = cleanLabel(label);
  if (!cleaned) return failure('Option text cannot be empty.');
  if (cleaned.length > 80) return failure('Option text must be 80 characters or fewer.');
  return success(cleaned);
}

async function getAuthenticatedUserId(): Promise<ServiceResult<string>> {
  const configError = ensureConfigured<string>();
  if (configError) return configError;

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return failure('Unable to verify your session. Please log in again.');
  }
  if (!data.user?.id) {
    return failure('No active user session found. Please log in again.');
  }

  return success(data.user.id);
}

async function resolveCategoryId(categoryKey: string): Promise<ServiceResult<string>> {
  const cached = categoryIdByKeyCache.get(categoryKey);
  if (cached) {
    return success(cached);
  }

  const { data, error } = await supabase
    .from('dropdown_categories')
    .select('id, key')
    .eq('key', categoryKey)
    .maybeSingle();

  if (error) {
    return failure(toFriendlyError(error, 'Unable to load dropdown category.'));
  }
  if (!data?.id) {
    return failure(`Dropdown category "${categoryKey}" does not exist.`);
  }

  categoryIdByKeyCache.set(categoryKey, data.id);
  categoryKeyByIdCache.set(data.id, data.key);
  return success(data.id);
}

async function resolveCategoryKey(categoryId: string): Promise<ServiceResult<string>> {
  const cached = categoryKeyByIdCache.get(categoryId);
  if (cached) {
    return success(cached);
  }

  const { data, error } = await supabase
    .from('dropdown_categories')
    .select('id, key')
    .eq('id', categoryId)
    .maybeSingle();

  if (error) {
    return failure(toFriendlyError(error, 'Unable to resolve dropdown category key.'));
  }
  if (!data?.key) {
    return failure('Dropdown category key could not be resolved.');
  }

  categoryIdByKeyCache.set(data.key, data.id);
  categoryKeyByIdCache.set(data.id, data.key);
  return success(data.key);
}

function optionUsageMap(rows: UsageRow[] | null) {
  const usage = new Map<string, string | null>();

  for (const row of rows ?? []) {
    usage.set(`${row.option_source}:${row.option_id}`, row.last_selected_at);
  }

  return usage;
}

export async function getDropdownOptions(
  categoryKey: string,
  searchText?: string
): Promise<ServiceResult<DropdownOption[]>> {
  const configError = ensureConfigured<DropdownOption[]>();
  if (configError) return configError;

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;
  if (!userId) return failure('No active user session found. Please log in again.');

  const categoryResult = await resolveCategoryId(categoryKey);
  if (categoryResult.error) return failure(categoryResult.error);
  const categoryId = categoryResult.data;
  if (!categoryId) return failure('Dropdown category could not be resolved.');

  const [defaultsResponse, customResponse, usageResponse] = await Promise.all([
    supabase.from('dropdown_default_options').select('id, label').eq('category_id', categoryId),
    supabase
      .from('dropdown_user_custom_options')
      .select('id, label')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .is('deleted_at', null),
    supabase
      .from('dropdown_user_option_usage')
      .select('option_source, option_id, last_selected_at')
      .eq('user_id', userId)
      .eq('category_id', categoryId),
  ]);

  if (defaultsResponse.error) {
    return failure(toFriendlyError(defaultsResponse.error, 'Unable to load default dropdown options.'));
  }
  if (customResponse.error) {
    return failure(toFriendlyError(customResponse.error, 'Unable to load custom dropdown options.'));
  }
  if (usageResponse.error) {
    return failure(toFriendlyError(usageResponse.error, 'Unable to load dropdown usage history.'));
  }

  const defaultIds = (defaultsResponse.data ?? []).map((row) => row.id);

  let hiddenDefaultIds = new Set<string>();
  if (defaultIds.length > 0) {
    const hiddenResponse = await supabase
      .from('dropdown_user_hidden_defaults')
      .select('default_option_id')
      .eq('user_id', userId)
      .in('default_option_id', defaultIds);

    if (hiddenResponse.error) {
      return failure(toFriendlyError(hiddenResponse.error, 'Unable to load hidden dropdown defaults.'));
    }

    hiddenDefaultIds = new Set((hiddenResponse.data ?? []).map((row) => row.default_option_id));
  }

  const usageByOption = optionUsageMap((usageResponse.data ?? []) as UsageRow[]);

  const merged: DropdownOption[] = [
    ...(defaultsResponse.data ?? [])
      .filter((row) => !hiddenDefaultIds.has(row.id))
      .map((row) => ({
        id: row.id,
        categoryKey,
        label: row.label,
        source: 'default' as const,
        lastSelectedAt: usageByOption.get(`default:${row.id}`) ?? null,
      })),
    ...(customResponse.data ?? []).map((row) => ({
      id: row.id,
      categoryKey,
      label: row.label,
      source: 'custom' as const,
      lastSelectedAt: usageByOption.get(`custom:${row.id}`) ?? null,
    })),
  ];

  const normalizedSearch = normalizeLabel(searchText ?? '');
  const filtered = normalizedSearch
    ? merged.filter((option) => normalizeLabel(option.label).includes(normalizedSearch))
    : merged;

  filtered.sort(sortDropdownOptions);
  return success(filtered);
}

export async function createOrGetCustomOption(
  categoryKey: string,
  label: string
): Promise<ServiceResult<DropdownOption>> {
  const configError = ensureConfigured<DropdownOption>();
  if (configError) return configError;

  const labelValidation = validateOptionLabel(label);
  if (labelValidation.error) return failure(labelValidation.error);
  const clean = labelValidation.data;
  if (!clean) return failure('Option text cannot be empty.');
  const normalized = normalizeLabel(clean);

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;
  if (!userId) return failure('No active user session found. Please log in again.');

  const categoryResult = await resolveCategoryId(categoryKey);
  if (categoryResult.error) return failure(categoryResult.error);
  const categoryId = categoryResult.data;
  if (!categoryId) return failure('Dropdown category could not be resolved.');

  const existingResponse = await supabase
    .from('dropdown_user_custom_options')
    .select('id, label')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('normalized_label', normalized)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingResponse.error) {
    return failure(toFriendlyError(existingResponse.error, 'Unable to check existing custom options.'));
  }

  if (existingResponse.data?.id) {
    return success({
      id: existingResponse.data.id,
      categoryKey,
      label: existingResponse.data.label,
      source: 'custom',
      lastSelectedAt: null,
    });
  }

  const insertResponse = await supabase
    .from('dropdown_user_custom_options')
    .insert({
      user_id: userId,
      category_id: categoryId,
      label: clean,
      normalized_label: normalized,
    })
    .select('id, label')
    .single();

  if (insertResponse.error && isDuplicateError(insertResponse.error)) {
    const duplicateResponse = await supabase
      .from('dropdown_user_custom_options')
      .select('id, label')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .eq('normalized_label', normalized)
      .is('deleted_at', null)
      .maybeSingle();

    if (duplicateResponse.error || !duplicateResponse.data?.id) {
      return failure('That option already exists, but could not be loaded. Please refresh and try again.');
    }

    return success({
      id: duplicateResponse.data.id,
      categoryKey,
      label: duplicateResponse.data.label,
      source: 'custom',
      lastSelectedAt: null,
    });
  }

  if (insertResponse.error || !insertResponse.data?.id) {
    return failure(toFriendlyError(insertResponse.error, 'Unable to save custom dropdown option.'));
  }

  return success({
    id: insertResponse.data.id,
    categoryKey,
    label: insertResponse.data.label,
    source: 'custom',
    lastSelectedAt: null,
  });
}

export async function markOptionUsed(
  categoryKey: string,
  source: DropdownOptionSource,
  optionId: string
): Promise<ServiceResult<true>> {
  const configError = ensureConfigured<true>();
  if (configError) return configError;

  if (!optionId) {
    return failure('Option id is required.');
  }

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;
  if (!userId) return failure('No active user session found. Please log in again.');

  const categoryResult = await resolveCategoryId(categoryKey);
  if (categoryResult.error) return failure(categoryResult.error);
  const categoryId = categoryResult.data;
  if (!categoryId) return failure('Dropdown category could not be resolved.');

  const timestamp = new Date().toISOString();
  const { error } = await supabase.from('dropdown_user_option_usage').upsert(
    {
      user_id: userId,
      category_id: categoryId,
      option_source: source,
      option_id: optionId,
      last_selected_at: timestamp,
    },
    {
      onConflict: 'user_id,category_id,option_source,option_id',
    }
  );

  if (error) {
    return failure(toFriendlyError(error, 'Unable to update option usage.'));
  }

  return success(true);
}

export async function hideDefaultOption(defaultOptionId: string): Promise<ServiceResult<true>> {
  const configError = ensureConfigured<true>();
  if (configError) return configError;

  if (!defaultOptionId) {
    return failure('Default option id is required.');
  }

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;
  if (!userId) return failure('No active user session found. Please log in again.');

  const { error } = await supabase.from('dropdown_user_hidden_defaults').upsert(
    {
      user_id: userId,
      default_option_id: defaultOptionId,
    },
    {
      onConflict: 'user_id,default_option_id',
    }
  );

  if (error) {
    return failure(toFriendlyError(error, 'Unable to hide default option.'));
  }

  return success(true);
}

export async function unhideDefaultOption(defaultOptionId: string): Promise<ServiceResult<true>> {
  const configError = ensureConfigured<true>();
  if (configError) return configError;

  if (!defaultOptionId) {
    return failure('Default option id is required.');
  }

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;
  if (!userId) return failure('No active user session found. Please log in again.');

  const { error } = await supabase
    .from('dropdown_user_hidden_defaults')
    .delete()
    .eq('user_id', userId)
    .eq('default_option_id', defaultOptionId);

  if (error) {
    return failure(toFriendlyError(error, 'Unable to unhide default option.'));
  }

  return success(true);
}

export async function getHiddenDefaultOptions(categoryKey: string): Promise<ServiceResult<DropdownOption[]>> {
  const configError = ensureConfigured<DropdownOption[]>();
  if (configError) return configError;

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;
  if (!userId) return failure('No active user session found. Please log in again.');

  const categoryResult = await resolveCategoryId(categoryKey);
  if (categoryResult.error) return failure(categoryResult.error);
  const categoryId = categoryResult.data;
  if (!categoryId) return failure('Dropdown category could not be resolved.');

  const hiddenResponse = await supabase
    .from('dropdown_user_hidden_defaults')
    .select('default_option_id')
    .eq('user_id', userId);

  if (hiddenResponse.error) {
    return failure(toFriendlyError(hiddenResponse.error, 'Unable to load hidden default options.'));
  }

  const hiddenIds = (hiddenResponse.data ?? []).map((row) => row.default_option_id);
  if (hiddenIds.length === 0) {
    return success([]);
  }

  const defaultsResponse = await supabase
    .from('dropdown_default_options')
    .select('id, label')
    .eq('category_id', categoryId)
    .in('id', hiddenIds);

  if (defaultsResponse.error) {
    return failure(toFriendlyError(defaultsResponse.error, 'Unable to load hidden default option details.'));
  }

  return success(
    (defaultsResponse.data ?? []).map((row) => ({
      id: row.id,
      categoryKey,
      label: row.label,
      source: 'default',
      hidden: true,
      lastSelectedAt: null,
    }))
  );
}

export async function renameCustomOption(
  customOptionId: string,
  newLabel: string
): Promise<ServiceResult<DropdownOption>> {
  const configError = ensureConfigured<DropdownOption>();
  if (configError) return configError;

  if (!customOptionId) {
    return failure('Custom option id is required.');
  }

  const labelValidation = validateOptionLabel(newLabel);
  if (labelValidation.error) return failure(labelValidation.error);
  const clean = labelValidation.data;
  if (!clean) return failure('Option text cannot be empty.');
  const normalized = normalizeLabel(clean);

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;
  if (!userId) return failure('No active user session found. Please log in again.');

  const currentRow = await supabase
    .from('dropdown_user_custom_options')
    .select('id, category_id')
    .eq('id', customOptionId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (currentRow.error) {
    return failure(toFriendlyError(currentRow.error, 'Unable to load custom option for rename.'));
  }
  if (!currentRow.data?.id) {
    return failure('Custom option not found.');
  }

  const updateResponse = await supabase
    .from('dropdown_user_custom_options')
    .update({
      label: clean,
      normalized_label: normalized,
    })
    .eq('id', customOptionId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select('id, label, category_id')
    .single();

  if (updateResponse.error) {
    return failure(toFriendlyError(updateResponse.error, 'Unable to rename custom option.'));
  }
  if (!updateResponse.data?.category_id) {
    return failure('Updated option category could not be resolved.');
  }

  const keyResult = await resolveCategoryKey(updateResponse.data.category_id);
  if (keyResult.error) return failure(keyResult.error);
  if (!keyResult.data) return failure('Dropdown category key could not be resolved.');

  return success({
    id: updateResponse.data.id,
    categoryKey: keyResult.data,
    label: updateResponse.data.label,
    source: 'custom',
    lastSelectedAt: null,
  });
}

export async function deleteCustomOption(customOptionId: string): Promise<ServiceResult<true>> {
  const configError = ensureConfigured<true>();
  if (configError) return configError;

  if (!customOptionId) {
    return failure('Custom option id is required.');
  }

  const userResult = await getAuthenticatedUserId();
  if (userResult.error) return failure(userResult.error);
  const userId = userResult.data;
  if (!userId) return failure('No active user session found. Please log in again.');

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('dropdown_user_custom_options')
    .update({
      deleted_at: now,
    })
    .eq('id', customOptionId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return failure(toFriendlyError(error, 'Unable to delete custom option.'));
  }
  if (!data?.id) {
    return failure('Custom option not found.');
  }

  return success(true);
}

export function isSameDropdownOption(left: DropdownOption | null, right: DropdownOption | null) {
  if (!left || !right) return false;
  return left.id === right.id && left.source === right.source && left.categoryKey === right.categoryKey;
}

export function doesSearchExactlyMatchOption(searchText: string, options: DropdownOption[]) {
  const normalizedSearch = normalizeLabel(searchText);
  if (!normalizedSearch) return false;

  return options.some((option) => normalizeLabel(option.label) === normalizedSearch);
}
