import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import {
  createOrGetCustomOption,
  deleteCustomOption,
  doesSearchExactlyMatchOption,
  getCategoryConfig,
  getHiddenDefaultOptions,
  getDropdownOptions,
  hideDefaultOption,
  isVariableDropdownCategory,
  isSameDropdownOption,
  markOptionUsed,
  renameCustomOption,
  unhideDefaultOption,
  type DropdownCategoryKey,
  type DropdownOption,
} from '@/lib/dropdowns';
import { useAppTheme } from '@/lib/theme';

type SmartDropdownProps = {
  categoryKey: DropdownCategoryKey;
  label: string;
  placeholder?: string;
  value: DropdownOption | null;
  onChange: (next: DropdownOption | null) => void;
  disabled?: boolean;
};

export function SmartDropdown({
  categoryKey,
  label,
  placeholder = 'Select an option',
  value,
  onChange,
  disabled = false,
}: SmartDropdownProps) {
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];
  const categoryConfig = getCategoryConfig(categoryKey);
  const isVariableCategory = categoryConfig.behavior === 'variable';
  const isMountedRef = useRef(true);
  const queryIdRef = useRef(0);

  const [isVisible, setIsVisible] = useState(false);
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [searchText, setSearchText] = useState('');
  const [renameText, setRenameText] = useState('');
  const [renameTarget, setRenameTarget] = useState<DropdownOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isLoadingHidden, setIsLoadingHidden] = useState(false);
  const [showHiddenOptions, setShowHiddenOptions] = useState(false);
  const [hiddenOptions, setHiddenOptions] = useState<DropdownOption[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeChipColor = theme === 'dark' ? 'rgba(186, 195, 255, 0.14)' : 'rgba(3, 22, 50, 0.08)';
  const focusBorderColor = theme === 'dark' ? 'rgba(186, 195, 255, 0.42)' : 'rgba(3, 22, 50, 0.22)';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadOptions = useCallback(
    async (query: string, showSpinner = false) => {
      if (showSpinner && isMountedRef.current) {
        setIsLoading(true);
      }

      const requestId = queryIdRef.current + 1;
      queryIdRef.current = requestId;

      const result = await getDropdownOptions(categoryKey, query);
      if (!isMountedRef.current || queryIdRef.current !== requestId) return;

      if (showSpinner) {
        setIsLoading(false);
      }

      if (result.error) {
        setErrorMessage(result.error);
        return;
      }

      setErrorMessage(null);
      setOptions(result.data ?? []);
    },
    [categoryKey]
  );

  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      void loadOptions(searchText);
    }, 180);

    return () => {
      clearTimeout(timer);
    };
  }, [isVisible, loadOptions, searchText]);

  const openPicker = () => {
    if (disabled) return;
    setSearchText('');
    setErrorMessage(null);
    setRenameTarget(null);
    setShowHiddenOptions(false);
    setHiddenOptions([]);
    setIsVisible(true);
    void loadOptions('', true);
  };

  const closePicker = () => {
    if (isMutating) return;
    setIsVisible(false);
    setRenameTarget(null);
    setRenameText('');
    setShowHiddenOptions(false);
    setHiddenOptions([]);
  };

  const selectOption = async (option: DropdownOption) => {
    if (isMutating) return;
    setIsMutating(true);

    const usageResult = await markOptionUsed(categoryKey, option.source, option.id);

    if (!isMountedRef.current) return;
    setIsMutating(false);

    if (usageResult.error) {
      Alert.alert('Could Not Save Selection', usageResult.error);
      return;
    }

    onChange({
      ...option,
      lastSelectedAt: new Date().toISOString(),
    });
    setIsVisible(false);
    setRenameTarget(null);
    setRenameText('');
  };

  const createFromSearch = async () => {
    if (!isVariableCategory) return;
    if (isMutating) return;
    setIsMutating(true);

    const createResult = await createOrGetCustomOption(categoryKey, searchText);
    if (!isMountedRef.current) return;

    if (createResult.error || !createResult.data) {
      setIsMutating(false);
      Alert.alert('Could Not Add Option', createResult.error ?? 'Unable to add option.');
      return;
    }

    const usageResult = await markOptionUsed(categoryKey, 'custom', createResult.data.id);
    if (!isMountedRef.current) return;

    setIsMutating(false);

    if (usageResult.error) {
      Alert.alert('Could Not Save Selection', usageResult.error);
      return;
    }

    onChange({
      ...createResult.data,
      lastSelectedAt: new Date().toISOString(),
    });
    setIsVisible(false);
    setRenameTarget(null);
    setRenameText('');
  };

  const handleHideDefault = async (option: DropdownOption) => {
    if (!isVariableCategory) return;
    if (isMutating) return;
    setIsMutating(true);

    const result = await hideDefaultOption(option.id);

    if (!isMountedRef.current) return;
    setIsMutating(false);

    if (result.error) {
      Alert.alert('Could Not Hide Option', result.error);
      return;
    }

    if (isSameDropdownOption(value, option)) {
      onChange(null);
    }

    void loadOptions(searchText, true);
  };

  const handleDeleteCustom = async (option: DropdownOption) => {
    if (!isVariableCategory) return;
    if (isMutating) return;
    setIsMutating(true);

    const result = await deleteCustomOption(option.id);

    if (!isMountedRef.current) return;
    setIsMutating(false);

    if (result.error) {
      Alert.alert('Could Not Delete Option', result.error);
      return;
    }

    if (isSameDropdownOption(value, option)) {
      onChange(null);
    }

    void loadOptions(searchText, true);
  };

  const saveRename = async () => {
    if (!isVariableCategory) return;
    if (!renameTarget || isMutating) return;
    setIsMutating(true);

    const result = await renameCustomOption(renameTarget.id, renameText);

    if (!isMountedRef.current) return;
    setIsMutating(false);

    if (result.error || !result.data) {
      Alert.alert('Could Not Rename Option', result.error ?? 'Unable to rename option.');
      return;
    }

    if (value && isSameDropdownOption(value, renameTarget)) {
      onChange({
        ...value,
        label: result.data.label,
      });
    }

    setRenameTarget(null);
    setRenameText('');
    void loadOptions(searchText, true);
  };

  const openActions = (option: DropdownOption) => {
    if (!isVariableCategory) return;
    if (isMutating) return;

    if (option.source === 'default') {
      Alert.alert(option.label, 'Choose an action', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Hide For Me',
          style: 'destructive',
          onPress: () => {
            void handleHideDefault(option);
          },
        },
      ]);
      return;
    }

    Alert.alert(option.label, 'Choose an action', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Rename',
        onPress: () => {
          setRenameTarget(option);
          setRenameText(option.label);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete Option', 'This removes this custom option from your list.', [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                void handleDeleteCustom(option);
              },
            },
          ]);
        },
      },
    ]);
  };

  const toggleHiddenDefaultsPanel = async () => {
    if (!isVariableCategory) return;
    if (isMutating) return;

    if (showHiddenOptions) {
      setShowHiddenOptions(false);
      return;
    }

    setIsLoadingHidden(true);
    const hiddenResult = await getHiddenDefaultOptions(categoryKey);
    if (!isMountedRef.current) return;
    setIsLoadingHidden(false);

    if (hiddenResult.error) {
      Alert.alert('Could Not Load Hidden Defaults', hiddenResult.error);
      return;
    }

    if (!hiddenResult.data || hiddenResult.data.length === 0) {
      Alert.alert('Nothing Hidden', 'You do not have hidden defaults in this dropdown.');
      return;
    }

    setHiddenOptions(hiddenResult.data);
    setShowHiddenOptions(true);
  };

  const restoreSingleHiddenOption = async (option: DropdownOption) => {
    if (!isVariableCategory) return;
    if (isMutating) return;
    setIsMutating(true);

    const unhideResult = await unhideDefaultOption(option.id);
    if (!isMountedRef.current) return;

    setIsMutating(false);
    if (unhideResult.error) {
      Alert.alert('Could Not Restore Option', unhideResult.error);
      return;
    }

    setHiddenOptions((previous) => {
      const next = previous.filter((item) => item.id !== option.id);
      setShowHiddenOptions(next.length > 0);
      return next;
    });
    void loadOptions(searchText, true);
  };

  const addEnabled = useMemo(() => {
    if (!isVariableDropdownCategory(categoryKey)) return false;
    if (!searchText.trim()) return false;
    if (doesSearchExactlyMatchOption(searchText, options)) return false;
    return true;
  }, [categoryKey, options, searchText]);

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={openPicker}
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.ghostBorder,
          },
          disabled && styles.disabled,
        ]}>
        <Text
          numberOfLines={1}
          style={[
            styles.fieldText,
            {
              color: value ? colors.text : colors.outline,
            },
          ]}>
          {value?.label ?? placeholder}
        </Text>
        <Ionicons color={colors.textMuted} name="chevron-down" size={18} />
      </Pressable>

      <Modal animationType="slide" transparent visible={isVisible} onRequestClose={closePicker}>
        <Pressable style={styles.overlay} onPress={closePicker}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.ghostBorder,
              },
            ]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{label}</Text>
              <View style={styles.sheetHeaderActions}>
                {isVariableCategory ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isMutating || isLoadingHidden}
                    onPress={() => void toggleHiddenDefaultsPanel()}>
                    <Text style={[styles.restoreText, { color: colors.primary }]}>
                      {showHiddenOptions ? 'Done' : 'Restore'}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" disabled={isMutating} onPress={closePicker}>
                  <Ionicons color={colors.textMuted} name="close" size={22} />
                </Pressable>
              </View>
            </View>

            <TextInput
              editable={!isMutating}
              onChangeText={setSearchText}
              placeholder={
                isVariableCategory
                  ? `Search or add ${label.toLowerCase()}`
                  : `Search ${label.toLowerCase()} options`
              }
              placeholderTextColor={colors.outline}
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.surfaceContainerHighest,
                  borderColor: focusBorderColor,
                  color: colors.text,
                },
              ]}
              value={searchText}
            />

            {showHiddenOptions ? (
              <View style={[styles.hiddenPanel, { backgroundColor: colors.surfaceContainer }]}>
                <Text style={[styles.hiddenPanelTitle, { color: colors.textMuted }]}>Hidden Defaults</Text>
                {isLoadingHidden ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={colors.primary} size="small" />
                  </View>
                ) : (
                  hiddenOptions.map((option) => (
                    <View key={`hidden:${option.id}`} style={styles.hiddenRow}>
                      <Text numberOfLines={1} style={[styles.hiddenLabel, { color: colors.text }]}>
                        {option.label}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isMutating}
                        onPress={() => {
                          void restoreSingleHiddenOption(option);
                        }}>
                        <Text style={[styles.hiddenRestoreText, { color: colors.primary }]}>Restore</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
                <Pressable onPress={() => void loadOptions(searchText, true)}>
                  <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            <ScrollView contentContainerStyle={styles.optionsList} keyboardShouldPersistTaps="handled">
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.primary} size="small" />
                </View>
              ) : (
                <>
                  {options.map((option) => {
                    const selected = isSameDropdownOption(option, value);
                    return (
                      <Pressable
                        key={`${option.source}:${option.id}`}
                        accessibilityRole="button"
                        onLongPress={
                          isVariableCategory
                            ? () => {
                                openActions(option);
                              }
                            : undefined
                        }
                        onPress={() => {
                          void selectOption(option);
                        }}
                        style={[
                          styles.optionRow,
                          {
                            backgroundColor: selected ? activeChipColor : colors.surfaceContainer,
                          },
                        ]}>
                        <View style={styles.optionMain}>
                          <Text numberOfLines={1} style={[styles.optionLabel, { color: colors.text }]}>
                            {option.label}
                          </Text>
                          <View style={[styles.badge, { backgroundColor: colors.surfaceContainerHigh }]}>
                            <Text style={[styles.badgeText, { color: colors.textMuted }]}>{option.source}</Text>
                          </View>
                        </View>
                        {selected ? <Ionicons color={colors.primary} name="checkmark" size={18} /> : null}
                      </Pressable>
                    );
                  })}

                  {addEnabled ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isMutating}
                      onPress={() => {
                        void createFromSearch();
                      }}
                      style={[
                        styles.optionRow,
                        {
                          backgroundColor: colors.surfaceContainerHigh,
                        },
                        isMutating && styles.disabled,
                      ]}>
                      <Text numberOfLines={1} style={[styles.addText, { color: colors.primary }]}>
                        + Add &quot;{searchText.trim()}&quot;
                      </Text>
                    </Pressable>
                  ) : null}

                  {!isLoading && options.length === 0 && !addEnabled ? (
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>No options found.</Text>
                  ) : null}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent visible={Boolean(renameTarget)} onRequestClose={() => setRenameTarget(null)}>
        <Pressable style={styles.overlay} onPress={() => setRenameTarget(null)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.renameCard,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.ghostBorder,
              },
            ]}>
            <Text style={[styles.renameTitle, { color: colors.text }]}>Rename Custom Option</Text>
            <TextInput
              editable={!isMutating}
              onChangeText={setRenameText}
              placeholder="New name"
              placeholderTextColor={colors.outline}
              style={[
                styles.renameInput,
                {
                  backgroundColor: colors.surfaceContainerHighest,
                  borderColor: focusBorderColor,
                  color: colors.text,
                },
              ]}
              value={renameText}
            />
            <View style={styles.renameActions}>
              <Pressable onPress={() => setRenameTarget(null)} style={styles.renameActionBtn}>
                <Text style={[styles.renameActionText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isMutating || !renameText.trim()}
                onPress={() => {
                  void saveRename();
                }}
                style={styles.renameActionBtn}>
                <Text
                  style={[
                    styles.renameActionText,
                    {
                      color: isMutating || !renameText.trim() ? colors.outline : colors.primary,
                    },
                  ]}>
                  Save
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
  },
  field: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  fieldText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '82%',
    minHeight: '56%',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  restoreText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  hiddenPanel: {
    borderRadius: 14,
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  hiddenPanelTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  hiddenRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 34,
  },
  hiddenLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 10,
  },
  hiddenRestoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  searchInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    marginBottom: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBox: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    paddingRight: 10,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  optionsList: {
    gap: 8,
    paddingBottom: 12,
  },
  loadingRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  optionRow: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    marginRight: 8,
  },
  optionLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  addText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 4,
    paddingVertical: 8,
    textAlign: 'center',
  },
  renameCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 140,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  renameTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  renameInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  renameActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  renameActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
