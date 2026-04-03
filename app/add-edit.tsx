import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SmartDropdown } from '@/components/dropdowns/smart-dropdown';
import { TopGlassBar, useTopGlassBarOffset } from '@/components/navigation/top-glass-bar';
import { Colors } from '@/constants/theme';
import {
  DROPDOWN_CATEGORY_CONFIGS,
  getFirstFilledCategory,
  type DropdownCategoryKey,
  type DropdownOption,
} from '@/lib/dropdowns';
import { createLogEntry, getLogEntryById, updateLogEntry } from '@/lib/logs';
import { useAppTheme } from '@/lib/theme';

type SelectionState = Record<DropdownCategoryKey, DropdownOption | null>;

function createInitialSelectionState(): SelectionState {
  return {
    food: null,
    pain: null,
    stress: null,
    medicine: null,
  };
}

function isCategoryKey(value: string | undefined): value is DropdownCategoryKey {
  return value === 'food' || value === 'pain' || value === 'stress' || value === 'medicine';
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toLocalDateTimeInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function parseLocalDateTimeInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace('T', ' ');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hours = Number(hourText);
  const minutes = Number(minuteText);

  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(localDate.getTime())) return null;

  const isExactMatch =
    localDate.getFullYear() === year &&
    localDate.getMonth() + 1 === month &&
    localDate.getDate() === day &&
    localDate.getHours() === hours &&
    localDate.getMinutes() === minutes;

  if (!isExactMatch) return null;
  return localDate.toISOString();
}

function toSingleParam(value: string | string[] | undefined) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export default function AddEditScreen() {
  const topOffset = useTopGlassBarOffset(true);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ entryId?: string | string[]; focusCategory?: string | string[] }>();
  const isMountedRef = useRef(true);

  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  const entryIdParam = toSingleParam(params.entryId)?.trim();
  const focusCategoryParamRaw = toSingleParam(params.focusCategory)?.trim();
  const focusCategoryParam = isCategoryKey(focusCategoryParamRaw) ? focusCategoryParamRaw : undefined;

  const isEditMode = Boolean(entryIdParam);

  const [activeCategory, setActiveCategory] = useState<DropdownCategoryKey>('food');
  const [loggedAtInput, setLoggedAtInput] = useState(() => toLocalDateTimeInput(new Date().toISOString()));
  const [note, setNote] = useState('');
  const [selections, setSelections] = useState<SelectionState>(createInitialSelectionState);
  const [isEntryLoading, setIsEntryLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!entryIdParam) {
      setSelections(createInitialSelectionState());
      setNote('');
      setLoggedAtInput(toLocalDateTimeInput(new Date().toISOString()));
      setActiveCategory(focusCategoryParam ?? 'food');
      setScreenError(null);
      setIsEntryLoading(false);
      return;
    }

    setIsEntryLoading(true);
    setScreenError(null);

    void (async () => {
      const result = await getLogEntryById(entryIdParam);
      if (!isMountedRef.current) return;

      if (result.error || !result.data) {
        setIsEntryLoading(false);
        setScreenError(result.error ?? 'Unable to load this log entry.');
        return;
      }

      const nextSelections = createInitialSelectionState();
      for (const category of Object.keys(nextSelections) as DropdownCategoryKey[]) {
        nextSelections[category] = result.data.itemsByCategory[category] ?? null;
      }

      setSelections(nextSelections);
      setNote(result.data.note ?? '');
      setLoggedAtInput(toLocalDateTimeInput(result.data.loggedAt));

      const focusCategory =
        focusCategoryParam ?? getFirstFilledCategory(result.data.itemsByCategory as Partial<Record<DropdownCategoryKey, DropdownOption>>);
      setActiveCategory(focusCategory);
      setIsEntryLoading(false);
    })();
  }, [entryIdParam, focusCategoryParam]);

  const selectedCount = useMemo(
    () => Object.values(selections).filter((selection) => selection !== null).length,
    [selections]
  );

  const categoryConfig = DROPDOWN_CATEGORY_CONFIGS.find((config) => config.key === activeCategory) ??
    DROPDOWN_CATEGORY_CONFIGS[0];

  const currentSelection = selections[activeCategory];

  const updateSelection = (categoryKey: DropdownCategoryKey, option: DropdownOption | null) => {
    setSelections((previous) => ({
      ...previous,
      [categoryKey]: option,
    }));
  };

  const clearCurrentSelection = () => {
    setSelections((previous) => ({
      ...previous,
      [activeCategory]: null,
    }));
  };

  const closeModal = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/logs');
  };

  const handleSetNow = () => {
    setLoggedAtInput(toLocalDateTimeInput(new Date().toISOString()));
  };

  const handleSave = async () => {
    if (isSaving || isEntryLoading) return;

    const parsedTimestamp = parseLocalDateTimeInput(loggedAtInput);
    if (!parsedTimestamp) {
      Alert.alert('Invalid Time', 'Use format YYYY-MM-DD HH:mm (example: 2026-03-21 18:40).');
      return;
    }

    if (selectedCount === 0) {
      Alert.alert('Select A Category', 'Choose at least one category before saving this log.');
      return;
    }

    setIsSaving(true);

    const payload = {
      loggedAt: parsedTimestamp,
      note,
      foodOption: selections.food,
      painOption: selections.pain,
      stressOption: selections.stress,
      medicineOption: selections.medicine,
    };

    const result = isEditMode && entryIdParam ? await updateLogEntry(entryIdParam, payload) : await createLogEntry(payload);

    if (!isMountedRef.current) return;

    setIsSaving(false);

    if (result.error) {
      Alert.alert('Save Failed', result.error);
      return;
    }

    Alert.alert(isEditMode ? 'Log Updated' : 'Log Saved', 'Your entry has been saved successfully.', [
      {
        text: 'OK',
        onPress: closeModal,
      },
    ]);
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <View style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.glowPrimary,
            {
              backgroundColor: theme === 'dark' ? 'rgba(186, 195, 255, 0.08)' : 'rgba(3, 22, 50, 0.06)',
            },
          ]}
        />
        <View
          style={[
            styles.glowSecondary,
            {
              backgroundColor: theme === 'dark' ? 'rgba(102, 217, 204, 0.08)' : 'rgba(0, 104, 118, 0.07)',
            },
          ]}
        />
      </View>

      <TopGlassBar
        iconName="create-outline"
        isModal={true}
        leadingIconName="close"
        onPressLeading={closeModal}
        showLeading
        title={isEditMode ? 'Edit Log' : 'New Log'}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topOffset, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.metaCard,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.ghostBorder,
            },
          ]}>
          <View style={styles.metaHeaderRow}>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Logged At</Text>
            <Pressable accessibilityRole="button" disabled={isSaving || isEntryLoading} onPress={handleSetNow}>
              <Text style={[styles.nowText, { color: colors.primary }]}>Now</Text>
            </Pressable>
          </View>

          <TextInput
            editable={!isSaving && !isEntryLoading}
            onChangeText={setLoggedAtInput}
            placeholder="YYYY-MM-DD HH:mm"
            placeholderTextColor={colors.outline}
            style={[
              styles.dateInput,
              {
                backgroundColor: colors.surfaceContainerHighest,
                color: colors.text,
              },
            ]}
            value={loggedAtInput}
          />

          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Optional Note</Text>
          <TextInput
            editable={!isSaving && !isEntryLoading}
            multiline
            onChangeText={setNote}
            placeholder="Add context for this bundle log"
            placeholderTextColor={colors.outline}
            style={[
              styles.noteInput,
              {
                backgroundColor: colors.surfaceContainerHighest,
                color: colors.text,
              },
            ]}
            textAlignVertical="top"
            value={note}
          />
        </View>

        <View style={styles.tabRow}>
          {DROPDOWN_CATEGORY_CONFIGS.map((category) => {
            const selected = activeCategory === category.key;
            const hasValue = Boolean(selections[category.key]);

            return (
              <Pressable
                key={category.key}
                accessibilityRole="button"
                disabled={isEntryLoading || isSaving}
                onPress={() => setActiveCategory(category.key)}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: selected ? colors.primaryContainer : colors.surfaceContainerHigh,
                  },
                ]}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabChipText,
                    {
                      color: selected ? colors.onPrimaryContainer : colors.text,
                    },
                  ]}>
                  Log {category.label}
                </Text>
                {hasValue ? (
                  <View style={[styles.tabDot, { backgroundColor: selected ? colors.secondary : colors.primary }]} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.panelCard,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.ghostBorder,
            },
          ]}>
          <View style={styles.panelHeader}>
            <View style={styles.panelTitleWrap}>
              <Text style={[styles.panelTitle, { color: colors.text }]}>{categoryConfig.label}</Text>
              <Text style={[styles.panelHint, { color: colors.textMuted }]}>
                {categoryConfig.behavior === 'variable'
                  ? 'Search defaults or add your own options.'
                  : 'Fixed options for consistent tracking.'}
              </Text>
            </View>

            {currentSelection ? (
              <Pressable accessibilityRole="button" disabled={isSaving || isEntryLoading} onPress={clearCurrentSelection}>
                <Text style={[styles.clearText, { color: colors.primary }]}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          <SmartDropdown
            categoryKey={activeCategory}
            disabled={isSaving || isEntryLoading}
            label={`${categoryConfig.label} Option`}
            onChange={(option) => updateSelection(activeCategory, option)}
            value={currentSelection}
          />

          <View style={styles.selectionSummaryRow}>
            <Ionicons color={colors.textMuted} name="layers-outline" size={15} />
            <Text style={[styles.selectionSummaryText, { color: colors.textMuted }]}>
              {selectedCount} of 4 categories selected
            </Text>
          </View>
        </View>

        {screenError ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.surfaceContainer,
              },
            ]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{screenError}</Text>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={closeModal}
            style={[
              styles.secondaryButton,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.ghostBorder,
              },
            ]}>
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving || isEntryLoading}
            onPress={handleSave}
            style={styles.primaryButtonWrap}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.primaryButton}>
              {isSaving ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  {isEditMode ? 'Update Log' : 'Save Log'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    gap: 14,
    paddingHorizontal: 16,
  },
  glowPrimary: {
    borderRadius: 999,
    height: 260,
    left: -120,
    position: 'absolute',
    top: -70,
    width: 260,
  },
  glowSecondary: {
    borderRadius: 999,
    bottom: -140,
    height: 340,
    position: 'absolute',
    right: -150,
    width: 340,
  },
  metaCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metaHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
  },
  nowText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  dateInput: {
    borderRadius: 12,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteInput: {
    borderRadius: 12,
    fontSize: 14,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabChip: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabDot: {
    borderRadius: 99,
    height: 6,
    width: 6,
  },
  panelCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  panelTitleWrap: {
    flex: 1,
  },
  panelTitle: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  panelHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 2,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectionSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  selectionSummaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorCard: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButtonWrap: {
    borderRadius: 999,
    flex: 1,
    overflow: 'hidden',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
