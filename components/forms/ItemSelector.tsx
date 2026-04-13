import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Radius, Spacing } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { useAppColors } from '../../providers/ThemeProvider';
import { AppCard } from '../ui/AppCard';
import { AppSnackbar } from '../ui/AppSnackbar';
import { CustomButton } from '../ui/CustomButton';

export interface ItemRecord {
  id: string;
  display_name: string | null;
  name: string | null;
  quantity: number | null;
  unit: string | null;
}

export interface ItemSelectorHandle {
  present: (options?: { editItemId?: string | null }) => void;
  dismiss: () => void;
}

interface ItemSelectorProps {
  type: 'medicine' | 'food';
  visible?: boolean;
  onClose?: () => void;
  onSelect: (id: string, displayName: string) => void;
  onMasterItemChange?: (item: ItemRecord) => void;
  onMasterItemDelete?: (id: string) => void;
}

function buildMasterItemDisplayName(name: string, quantity: number | null, unit: string | null) {
  const pieces = [name.trim(), quantity !== null && Number.isFinite(quantity) ? String(quantity) : null, unit?.trim() || null].filter(
    (piece): piece is string => !!piece,
  );

  return pieces.length > 0 ? pieces.join(' ') : 'Saved item';
}

function getMasterItemDisplayName(item: Pick<ItemRecord, 'display_name' | 'name' | 'quantity' | 'unit'>) {
  const displayName = item.display_name?.trim();

  if (displayName) {
    return displayName;
  }

  return buildMasterItemDisplayName(item.name ?? '', item.quantity, item.unit ?? null);
}

function getMasterItemSearchText(item: Pick<ItemRecord, 'display_name' | 'name' | 'quantity' | 'unit'>) {
  return [item.display_name, item.name, item.quantity !== null ? String(item.quantity) : null, item.unit]
    .filter((piece): piece is string => !!piece && piece.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

function sortMasterItems(items: ItemRecord[]) {
  return [...items].sort((left, right) => getMasterItemDisplayName(left).localeCompare(getMasterItemDisplayName(right)));
}

const sheetReveal = (delay: number) => FadeInDown.delay(delay).duration(300);

interface SheetTextFieldProps extends React.ComponentProps<typeof BottomSheetTextInput> {
  label?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  trailing?: React.ReactNode;
  colors: ReturnType<typeof useAppColors>;
}

function SheetTextField({ label, icon, trailing, colors, style, ...props }: SheetTextFieldProps) {
  return (
    <View style={styles.fieldBlock}>
      {label ? (
        <Text variant="labelMedium" style={[styles.fieldLabel, { color: colors.textMuted }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.fieldSurface,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.ghostBorder,
          },
        ]}
      >
        {icon ? <MaterialCommunityIcons name={icon} size={18} color={colors.textMuted} /> : null}
        <BottomSheetTextInput
          {...props}
          style={[styles.fieldInput, { color: colors.text }, style]}
          placeholderTextColor={colors.textMuted}
        />
        {trailing}
      </View>
    </View>
  );
}

interface ItemRowProps {
  item: ItemRecord;
  index: number;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  colors: ReturnType<typeof useAppColors>;
  onSelect: (item: ItemRecord) => void;
  onEdit: (item: ItemRecord) => void;
  onDelete: (item: ItemRecord) => void;
}

function ItemRow({ item, index, iconName, colors, onSelect, onEdit, onDelete }: ItemRowProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const displayName = getMasterItemDisplayName(item);
  const subtitle = item.name?.trim() || [item.quantity !== null ? String(item.quantity) : null, item.unit?.trim() || null]
    .filter((piece): piece is string => !!piece)
    .join(' • ');

  const closeSwipeable = () => {
    swipeableRef.current?.close();
  };

  return (
    <Animated.View entering={sheetReveal(index * 35)} layout={Layout.springify()}>
      <Swipeable
        ref={swipeableRef}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={() => (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              closeSwipeable();
              onDelete(item);
            }}
            style={[styles.swipeAction, styles.deleteAction, { backgroundColor: colors.errorContainer }]}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.error} />
            <Text variant="labelSmall" style={[styles.swipeActionLabel, { color: colors.error }]}>Delete</Text>
          </Pressable>
        )}
        renderRightActions={() => (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              closeSwipeable();
              onEdit(item);
            }}
            style={[styles.swipeAction, styles.editAction, { backgroundColor: colors.primaryContainer }]}
          >
            <MaterialCommunityIcons name="pencil-outline" size={22} color={colors.onPrimaryContainer} />
            <Text variant="labelSmall" style={[styles.swipeActionLabel, { color: colors.onPrimaryContainer }]}>Edit</Text>
          </Pressable>
        )}
      >
        <AppCard
          style={styles.itemCard}
          variant="subtle"
          onPress={() => {
            closeSwipeable();
            onSelect(item);
          }}
        >
          <View style={[styles.itemIconContainer, { backgroundColor: colors.surfaceContainerLow }]}> 
            <MaterialCommunityIcons name={iconName} size={20} color={colors.primary} />
          </View>
          <View style={styles.itemTextBlock}>
            <Text variant="titleSmall" style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {!!subtitle && (
              <Text variant="bodySmall" style={[styles.itemSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
        </AppCard>
      </Swipeable>
    </Animated.View>
  );
}

export const ItemSelector = forwardRef<ItemSelectorHandle, ItemSelectorProps>(function ItemSelector(
  { type, visible, onClose, onSelect, onMasterItemChange, onMasterItemDelete },
  ref,
) {
  const colors = useAppColors();
  const { user } = useAuth();
  const sheetRef = useRef<BottomSheetModal>(null);
  const pendingOpenOptionsRef = useRef<{ editItemId?: string | null } | null>(null);

  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeForm, setActiveForm] = useState<{ mode: 'create' | 'edit'; itemId?: string } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftQuantity, setDraftQuantity] = useState('');
  const [draftUnit, setDraftUnit] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const tableName = type === 'medicine' ? 'user_medicines' : 'user_foods';
  const logTableName = type === 'medicine' ? 'medicine_logs' : 'food_logs';
  const logForeignKey = type === 'medicine' ? 'medicine_id' : 'food_id';
  const iconName = type === 'medicine' ? 'pill' : 'food-apple';
  const displayType = type === 'medicine' ? 'Medicine' : 'Food';
  const createLabel = `Create New ${displayType}`;
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const showError = useCallback((message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  }, []);

  const resetForm = useCallback(() => {
    setActiveForm(null);
    setDraftName('');
    setDraftQuantity('');
    setDraftUnit('');
  }, []);

  const fetchItems = useCallback(async (targetEditItemId?: string | null) => {
    if (!user) {
      setItems([]);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('id, display_name, name, quantity, unit')
        .eq('user_id', user.id)
        .order('display_name', { ascending: true });

      if (error) {
        throw error;
      }

      const nextItems = (data ?? []) as ItemRecord[];
      setItems(nextItems);

      if (targetEditItemId) {
        const targetItem = nextItems.find((item) => item.id === targetEditItemId);

        if (targetItem) {
          setActiveForm({ mode: 'edit', itemId: targetItem.id });
          setDraftName(targetItem.name?.trim() || getMasterItemDisplayName(targetItem));
          setDraftQuantity(targetItem.quantity !== null ? String(targetItem.quantity) : '');
          setDraftUnit(targetItem.unit?.trim() || '');
          setSearchQuery(getMasterItemDisplayName(targetItem));
        }
      }
    } catch (error: any) {
      showError(error?.message ?? `Unable to load ${displayType.toLowerCase()} items.`);
    } finally {
      setLoading(false);
    }
  }, [displayType, showError, tableName, user]);

  const openSheet = useCallback(
    (options?: { editItemId?: string | null }) => {
      pendingOpenOptionsRef.current = options ?? null;
      sheetRef.current?.present();
      void fetchItems(options?.editItemId ?? null);
    },
    [fetchItems],
  );

  const closeSheet = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  useImperativeHandle(ref, () => ({
    present: openSheet,
    dismiss: closeSheet,
  }), [closeSheet, openSheet]);

  useEffect(() => {
    if (visible === undefined) {
      return;
    }

    if (visible) {
      openSheet();
    } else {
      closeSheet();
    }
  }, [closeSheet, openSheet, visible]);

  const filteredItems = useMemo(
    () => items.filter((item) => getMasterItemSearchText(item).includes(normalizedSearch)),
    [items, normalizedSearch],
  );

  const hasExactMatch = useMemo(() => {
    if (normalizedSearch.length === 0) {
      return false;
    }

    return items.some((item) => getMasterItemDisplayName(item).toLowerCase() === normalizedSearch);
  }, [items, normalizedSearch]);

  const handleSelectItem = useCallback(
    (item: ItemRecord) => {
      onSelect(item.id, getMasterItemDisplayName(item));
      closeSheet();
    },
    [closeSheet, onSelect],
  );

  const handleOpenCreateForm = useCallback(() => {
    setActiveForm({ mode: 'create' });
    setDraftName(searchQuery.trim());
    setDraftQuantity('');
    setDraftUnit('');
  }, [searchQuery]);

  const handleEditMasterItem = useCallback((item: ItemRecord) => {
    setActiveForm({ mode: 'edit', itemId: item.id });
    setDraftName(item.name?.trim() || getMasterItemDisplayName(item));
    setDraftQuantity(item.quantity !== null ? String(item.quantity) : '');
    setDraftUnit(item.unit?.trim() || '');
  }, []);

  const performDeleteMasterItem = useCallback(
    async (item: ItemRecord) => {
      if (!user) {
        showError('You must be logged in to delete saved items.');
        return;
      }

      setIsSaving(true);

      try {
        const logsDeleteResult = await supabase
          .from(logTableName)
          .delete()
          .eq('user_id', user.id)
          .eq(logForeignKey, item.id);

        if (logsDeleteResult.error) {
          throw logsDeleteResult.error;
        }

        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', item.id)
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }

        setItems((currentItems) => sortMasterItems(currentItems.filter((currentItem) => currentItem.id !== item.id)));
        onMasterItemDelete?.(item.id);

        if (activeForm?.itemId === item.id) {
          resetForm();
        }

        showError(`${displayType} deleted.`);
      } catch (error: any) {
        showError(error?.message ?? `Unable to delete this ${displayType.toLowerCase()}.`);
      } finally {
        setIsSaving(false);
      }
    },
    [activeForm, displayType, logForeignKey, logTableName, onMasterItemDelete, resetForm, showError, tableName, user],
  );

  const handleDeleteMasterItem = useCallback(
    (item: ItemRecord) => {
      Alert.alert(
        'Delete saved item?',
        'Delete this saved item? This will remove historical logs associated with it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void performDeleteMasterItem(item);
            },
          },
        ],
      );
    },
    [performDeleteMasterItem],
  );

  const handleSubmitMasterItem = useCallback(async () => {
    if (!user) {
      showError('You must be logged in to save items.');
      return;
    }

    const trimmedName = draftName.trim();

    if (!trimmedName) {
      showError('Name is required.');
      return;
    }

    const trimmedUnit = draftUnit.trim();
    const parsedQuantity = draftQuantity.trim().length > 0 ? Number(draftQuantity) : null;

    if (parsedQuantity !== null && !Number.isFinite(parsedQuantity)) {
      showError('Quantity must be a valid number.');
      return;
    }

    const payload = {
      user_id: user.id,
      name: trimmedName,
      quantity: parsedQuantity,
      unit: trimmedUnit.length > 0 ? trimmedUnit : null,
      display_name: buildMasterItemDisplayName(trimmedName, parsedQuantity, trimmedUnit.length > 0 ? trimmedUnit : null),
    };

    setIsSaving(true);

    try {
      if (activeForm?.mode === 'edit' && activeForm.itemId) {
        const { data, error } = await supabase
          .from(tableName)
          .update(payload)
          .eq('id', activeForm.itemId)
          .eq('user_id', user.id)
          .select('id, display_name, name, quantity, unit')
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const nextItem = data as ItemRecord;
          setItems((currentItems) => sortMasterItems(currentItems.map((currentItem) => (currentItem.id === nextItem.id ? nextItem : currentItem))));
          onMasterItemChange?.(nextItem);
          setSearchQuery(getMasterItemDisplayName(nextItem));
        }

        resetForm();
        showError(`${displayType} updated.`);
      } else {
        const { data, error } = await supabase
          .from(tableName)
          .insert(payload)
          .select('id, display_name, name, quantity, unit')
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const createdItem = data as ItemRecord;
          setItems((currentItems) => sortMasterItems([...currentItems, createdItem]));
          onMasterItemChange?.(createdItem);
          onSelect(createdItem.id, getMasterItemDisplayName(createdItem));
          closeSheet();
        }

        resetForm();
      }
    } catch (error: any) {
      showError(error?.message ?? `Unable to save this ${displayType.toLowerCase()}.`);
    } finally {
      setIsSaving(false);
    }
  }, [activeForm, closeSheet, displayType, draftName, draftQuantity, draftUnit, onMasterItemChange, onSelect, resetForm, showError, tableName, user]);

  const handleDismiss = useCallback(() => {
    setSearchQuery('');
    setItems([]);
    resetForm();
    pendingOpenOptionsRef.current = null;
    onClose?.();
  }, [onClose, resetForm]);

  const snapPoints = useMemo(() => ['74%', '92%'], []);

  const renderBackdrop = useCallback(
    (backdropProps: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...backdropProps} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} />
    ),
    [],
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <View style={[styles.headerIconShell, { backgroundColor: colors.surfaceContainerLow }]}> 
            <MaterialCommunityIcons name={iconName} size={20} color={colors.primary} />
          </View>
          <View style={styles.headerTextBlock}>
            <Text variant="titleLarge" style={[styles.sheetTitle, { color: colors.text }]}>
              Select {displayType}
            </Text>
            <Text variant="bodySmall" style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
              Swipe right to edit or left to delete saved items.
            </Text>
          </View>
        </View>
        <IconButton icon="close" iconColor={colors.text} size={24} onPress={closeSheet} />
      </View>

      <SheetTextField
        colors={colors}
        icon="magnify"
        placeholder={`Search ${displayType.toLowerCase()}...`}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        trailing={
          searchQuery.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => setSearchQuery('')} hitSlop={Spacing.sm}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null
        }
      />

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="bodySmall" style={[styles.loadingText, { color: colors.textMuted }]}>Refreshing saved items...</Text>
        </View>
      )}

      {activeForm && (
        <AppCard style={styles.formCard} animated delay={45}>
          <Text variant="titleMedium" style={[styles.formTitle, { color: colors.text }]}>
            {activeForm.mode === 'edit' ? `Edit ${displayType}` : createLabel}
          </Text>

          <View style={styles.formFields}>
            <SheetTextField
              colors={colors}
              label="Name"
              placeholder={`e.g. ${type === 'medicine' ? 'Ibuprofen' : 'Apple'}`}
              value={draftName}
              onChangeText={setDraftName}
              autoCapitalize="words"
              autoFocus
            />

            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <SheetTextField
                  colors={colors}
                  label="Quantity"
                  placeholder="e.g. 400"
                  value={draftQuantity}
                  onChangeText={setDraftQuantity}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.formColumn}>
                <SheetTextField
                  colors={colors}
                  label="Unit"
                  placeholder={`e.g. ${type === 'medicine' ? 'mg' : 'piece'}`}
                  value={draftUnit}
                  onChangeText={setDraftUnit}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              </View>
            </View>
          </View>

          <View style={styles.formActions}>
            <CustomButton mode="text" onPress={resetForm} style={styles.formActionButton}>
              Cancel
            </CustomButton>
            <CustomButton mode="contained" onPress={handleSubmitMasterItem} isLoading={isSaving} style={styles.formActionButton}>
              {activeForm.mode === 'edit' ? 'Save Changes' : 'Create & Select'}
            </CustomButton>
          </View>
        </AppCard>
      )}
    </View>
  );

  const renderFooter = () => {
    if (activeForm || hasExactMatch) {
      return null;
    }

    return (
      <View style={styles.footerContainer}>
        <CustomButton
          mode="contained"
          icon="plus"
          onPress={handleOpenCreateForm}
          buttonColor={type === 'medicine' ? colors.primaryContainer : colors.secondaryContainer}
          textColor={type === 'medicine' ? colors.onPrimaryContainer : colors.onSecondaryContainer}
        >
          {createLabel}
        </CustomButton>
      </View>
    );
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDismissOnClose
      backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}
      handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: colors.ghostBorder }]}
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
    >
      <View style={styles.sheetContent}>
        <BottomSheetFlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ItemRow
              item={item}
              index={index}
              iconName={iconName}
              colors={colors}
              onSelect={handleSelectItem}
              onEdit={handleEditMasterItem}
              onDelete={handleDeleteMasterItem}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="magnify" size={32} color={colors.textMuted} />
                <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>No matching saved items.</Text>
              </View>
            )
          }
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </View>

      <AppSnackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </AppSnackbar>
    </BottomSheetModal>
  );
});

ItemSelector.displayName = 'ItemSelector';

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
  },
  handleIndicator: {
    width: 48,
    height: 5,
  },
  sheetContent: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerCopy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    flex: 1,
  },
  headerIconShell: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  sheetTitle: {
    fontWeight: '700',
  },
  sheetSubtitle: {
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  loadingText: {
    flex: 1,
  },
  fieldBlock: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    marginLeft: Spacing.xs,
  },
  fieldSurface: {
    minHeight: 52,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fieldInput: {
    flex: 1,
    minHeight: 24,
  },
  formCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  formTitle: {
    fontWeight: '700',
  },
  formFields: {
    gap: Spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  formColumn: {
    flex: 1,
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  formActionButton: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl + Spacing.xl,
    gap: Spacing.sm,
  },
  itemCard: {
    minHeight: 72,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  itemTitle: {
    fontWeight: '700',
  },
  itemSubtitle: {
    lineHeight: 18,
  },
  swipeAction: {
    width: 96,
    marginBottom: Spacing.sm,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  deleteAction: {
    marginRight: Spacing.sm,
  },
  editAction: {
    marginLeft: Spacing.sm,
  },
  swipeActionLabel: {
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
  },
  footerContainer: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
});