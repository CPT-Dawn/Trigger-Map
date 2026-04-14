import React, {
  forwardRef,
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Alert, Pressable, StyleSheet, View, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { ActivityIndicator, IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useHeaderHeight } from '@react-navigation/elements';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Radius, Spacing } from '../../constants/theme';
import { addToSyncQueue, createUuid, db } from '../../lib/localDb';
import { runSync } from '../../lib/syncEngine';
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
  const resolvedName = name.trim();
  const quantityPiece = quantity !== null && Number.isFinite(quantity) ? String(quantity) : null;
  const unitPiece = unit?.trim() || null;

  if (quantityPiece) {
    const quantityWithUnit = unitPiece ? `${quantityPiece} ${unitPiece}` : quantityPiece;
    return resolvedName.length > 0 ? `${resolvedName} • ${quantityWithUnit}` : quantityWithUnit;
  }

  if (resolvedName.length > 0) {
    return resolvedName;
  }

  return 'Saved item';
}

function formatQuantityAndUnit(quantity: number | null, unit: string | null) {
  const quantityPiece = quantity !== null && Number.isFinite(quantity) ? String(quantity) : '';
  const unitPiece = unit?.trim() || '';

  if (quantityPiece && unitPiece) {
    return `${quantityPiece} ${unitPiece}`;
  }

  if (quantityPiece) {
    return quantityPiece;
  }

  if (unitPiece) {
    return unitPiece;
  }

  return '';
}

function getMasterItemName(item: Pick<ItemRecord, 'display_name' | 'name'>) {
  const directName = item.name?.trim();

  if (directName) {
    return directName;
  }

  const displayName = item.display_name?.trim() || '';

  if (displayName.length === 0) {
    return 'Saved item';
  }

  const [leadingDisplayName] = displayName.split('•');
  const fallbackName = leadingDisplayName?.trim();

  return fallbackName && fallbackName.length > 0 ? fallbackName : displayName;
}

function getMasterItemQuantityLabel(item: Pick<ItemRecord, 'display_name' | 'quantity' | 'unit'>) {
  const quantityLabel = formatQuantityAndUnit(item.quantity, item.unit);

  if (quantityLabel.length > 0) {
    return quantityLabel;
  }

  const displayName = item.display_name?.trim() || '';
  const separatorIndex = displayName.indexOf('•');

  if (separatorIndex >= 0) {
    const trailingSegment = displayName.slice(separatorIndex + 1).trim();

    if (trailingSegment.length > 0) {
      return trailingSegment;
    }
  }

  return '';
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

function normalizeItemPiece(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeItemName(name: string | null | undefined) {
  return normalizeItemPiece(name);
}

function sortMasterItems(items: ItemRecord[]) {
  return [...items].sort((left, right) => getMasterItemDisplayName(left).localeCompare(getMasterItemDisplayName(right)));
}

const sheetReveal = (delay: number) => FadeInDown.delay(delay).duration(300);

const MEDICINE_UNIT_SUGGESTIONS = [
  'mg',         // Milligrams (The universal standard for dosage)
  'tablet',     // Physical pill
  'capsule',    // Physical pill
  'ml',         // Milliliters (Liquid medications)
  'drops',      // Eye drops, liquid vitamins
  'puff',       // Inhalers (Asthma is a major trigger tracked in apps)
  'tsp',        // Teaspoon (Common for liquid suspensions, 5ml)
  'cap',       // Tablespoon (15ml)
  'mcg',        // Micrograms (Common for Vitamin D, B12, Thyroid meds)
  'g',          // Grams (Large supplements)
  'patch',      // Pain patches, birth control, nicotine
  'spray',      // Nasal sprays (Allergy triggers)
  'unit',       // Insulin, specialized injections
  'application',// Topical creams, ointments (Eczema/Skin triggers)
] as const;
const FOOD_UNIT_SUGGESTIONS = [
  'serving',    // The ultimate catch-all (e.g., "Lasagna 1 serving")
  'cup',        // Universal for solids/liquids (Coffee, rice, veggies)
  'piece',      // Fruit, sushi, chicken
  'slice',      // Bread, pizza, cheese
  'g',          // Grams (For users who track strictly)
  'ml',         // Milliliters (Drinks)
  'bowl',       // Soup, cereal, pasta (Highly intuitive)
  'glass',      // Water, juice, alcohol
  'handful',    // Nuts, chips, berries (Low-friction tracking)
  'bottle',     // Water, soda, beer
  'can',        // Soda, energy drinks
] as const;

interface SheetTextFieldProps extends React.ComponentProps<typeof BottomSheetTextInput> {
  label?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  trailing?: React.ReactNode;
  colors: ReturnType<typeof useAppColors>;
  containerStyle?: StyleProp<ViewStyle>;
  surfaceStyle?: StyleProp<ViewStyle>;
}

function SheetTextField({ label, icon, trailing, colors, containerStyle, surfaceStyle, style, ...props }: SheetTextFieldProps) {
  return (
    <View style={[styles.fieldBlock, containerStyle]}>
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
          surfaceStyle,
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
  animateRows: boolean;
  accentColor: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  errorColor: string;
  onSelect: (item: ItemRecord) => void;
  onEdit: (item: ItemRecord) => void;
  onDelete: (item: ItemRecord) => void;
}

const ItemRow = React.memo(function ItemRow({
  item,
  index,
  animateRows,
  accentColor,
  backgroundColor,
  borderColor,
  textColor,
  errorColor,
  onSelect,
  onEdit,
  onDelete,
}: ItemRowProps) {
  const itemName = getMasterItemName(item);
  const quantityLabel = getMasterItemQuantityLabel(item);
  const inlineLabel = quantityLabel.length > 0 ? `${itemName} • ${quantityLabel}` : itemName;
  const revealAnimation = animateRows && index < 10 ? sheetReveal(index * 34) : undefined;

  return (
    <Animated.View entering={revealAnimation}>
      <AppCard
        style={[
          styles.itemCard,
          {
            backgroundColor,
            borderColor,
          },
        ]}
        variant="subtle"
      >
        <View style={styles.itemRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Select ${itemName}`}
            onPress={() => onSelect(item)}
            style={({ pressed }) => [styles.itemSelectArea, pressed && styles.itemSelectPressed]}
          >
            <Text variant="titleSmall" style={[styles.itemMarker, { color: accentColor }]}>{'>'}</Text>
            <View style={styles.itemTextBlock}>
              <Text variant="titleSmall" style={[styles.itemTitle, { color: textColor }]} numberOfLines={1}>
                {inlineLabel}
              </Text>
            </View>
          </Pressable>

          <View style={styles.itemActionGroup}>
            <IconButton
              icon="pencil-outline"
              iconColor={accentColor}
              size={20}
              style={styles.itemActionButton}
              onPress={() => onEdit(item)}
              accessibilityLabel={`Edit ${itemName}`}
            />
            <IconButton
              icon="trash-can-outline"
              iconColor={errorColor}
              size={20}
              style={styles.itemActionButton}
              onPress={() => onDelete(item)}
              accessibilityLabel={`Delete ${itemName}`}
            />
          </View>
        </View>
      </AppCard>
    </Animated.View>
  );
});

export const ItemSelector = forwardRef<ItemSelectorHandle, ItemSelectorProps>(function ItemSelector(
  { type, visible, onClose, onSelect, onMasterItemChange, onMasterItemDelete },
  ref,
) {
  const colors = useAppColors();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();
  const sheetRef = useRef<BottomSheetModal>(null);

  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [, startSearchTransition] = useTransition();
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
  const accentColor = type === 'medicine' ? colors.onPrimaryContainer : colors.onSecondaryContainer;
  const accentContainerColor = type === 'medicine' ? colors.primaryContainer : colors.secondaryContainer;
  const createLabel = `Create New ${displayType}`;
  const unitSuggestions = type === 'medicine' ? MEDICINE_UNIT_SUGGESTIONS : FOOD_UNIT_SUGGESTIONS;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
  const hasSearchQuery = searchInputValue.trim().length > 0;

  const showError = useCallback((message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  }, []);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchInputValue(value);
    startSearchTransition(() => {
      setSearchQuery(value);
    });
  }, [startSearchTransition]);

  const clearSearchQuery = useCallback(() => {
    setSearchInputValue('');
    setSearchQuery('');
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
      const nextItems = db.getAllSync<ItemRecord>(
        `
          SELECT id, display_name, name, quantity, unit
          FROM ${tableName}
          WHERE user_id = ?
          ORDER BY display_name ASC;
        `,
        [user.id],
      );

      setItems(sortMasterItems(nextItems));

      if (targetEditItemId) {
        const targetItem = nextItems.find((item) => item.id === targetEditItemId);

        if (targetItem) {
          setActiveForm({ mode: 'edit', itemId: targetItem.id });
          setDraftName(targetItem.name?.trim() || getMasterItemDisplayName(targetItem));
          setDraftQuantity(targetItem.quantity !== null ? String(targetItem.quantity) : '');
          setDraftUnit(targetItem.unit?.trim() || '');
          const targetLabel = getMasterItemDisplayName(targetItem);
          setSearchInputValue(targetLabel);
          setSearchQuery(targetLabel);
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
    setDraftName(searchInputValue.trim());
    setDraftQuantity('');
    setDraftUnit('');
  }, [searchInputValue]);

  const handleEditMasterItem = useCallback((item: ItemRecord) => {
    setActiveForm({ mode: 'edit', itemId: item.id });
    setDraftName(item.name?.trim() || getMasterItemDisplayName(item));
    setDraftQuantity(item.quantity !== null ? String(item.quantity) : '');
    setDraftUnit(item.unit?.trim() || '');
  }, []);

  const findItemByName = useCallback(
    (name: string, excludeId?: string) => {
      const normalizedName = normalizeItemName(name);

      if (normalizedName.length === 0) {
        return null;
      }

      return items.find((item) => {
        if (excludeId && item.id === excludeId) {
          return false;
        }

        const itemName = item.name?.trim() || getMasterItemName(item);
        return normalizeItemName(itemName) === normalizedName;
      }) ?? null;
    },
    [items],
  );

  const performDeleteMasterItem = useCallback(
    async (item: ItemRecord) => {
      if (!user) {
        showError('You must be logged in to delete saved items.');
        return;
      }

      setIsSaving(true);

      try {
        db.execSync('BEGIN TRANSACTION;');

        try {
          db.runSync(
            `
              DELETE FROM ${tableName}
              WHERE id = ? AND user_id = ?;
            `,
            [item.id, user.id],
          );

          addToSyncQueue(tableName, 'DELETE', { id: item.id, user_id: user.id }, { userId: user.id });

          db.execSync('COMMIT;');
        } catch (error) {
          db.execSync('ROLLBACK;');
          throw error;
        }

        setItems((currentItems) => sortMasterItems(currentItems.filter((currentItem) => currentItem.id !== item.id)));
        onMasterItemDelete?.(item.id);

        if (activeForm?.itemId === item.id) {
          resetForm();
        }

        showError(`${displayType} deleted.`);
        void runSync();
      } catch (error: any) {
        showError(error?.message ?? `Unable to delete this ${displayType.toLowerCase()}.`);
      } finally {
        setIsSaving(false);
      }
    },
    [activeForm, displayType, onMasterItemDelete, resetForm, showError, tableName, user],
  );

  const handleDeleteMasterItem = useCallback(
    (item: ItemRecord) => {
      const relatedLogCount = user
        ? Number(
            db.getFirstSync<{ count: number }>(
              `
                SELECT COUNT(1) AS count
                FROM ${logTableName}
                WHERE user_id = ? AND ${logForeignKey} = ?;
              `,
              [user.id, item.id],
            )?.count ?? 0,
          )
        : 0;

      const linkedLogsHint =
        relatedLogCount > 0
          ? `This item is referenced by ${relatedLogCount} historical log${relatedLogCount === 1 ? '' : 's'}. Existing logs will be kept.`
          : 'This only removes the saved item from future selections.';

      Alert.alert(
        'Delete saved item?',
        linkedLogsHint,
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
    [logForeignKey, logTableName, performDeleteMasterItem, user],
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

    const normalizedUnit = trimmedUnit.length > 0 ? trimmedUnit : null;
    const basePayload = {
      name: trimmedName,
      quantity: parsedQuantity,
      unit: normalizedUnit,
    };
    const resolvedDisplayName = buildMasterItemDisplayName(
      trimmedName,
      parsedQuantity,
      normalizedUnit,
    );
    const syncPayload = {
      ...basePayload,
      display_name: resolvedDisplayName,
    };
    const existingItemWithName = findItemByName(
      trimmedName,
      activeForm?.mode === 'edit' ? activeForm.itemId : undefined,
    );

    if (existingItemWithName && activeForm?.mode === 'edit') {
      showError(`Another ${displayType.toLowerCase()} already uses this name.`);
      return;
    }

    setIsSaving(true);

    try {
      if (existingItemWithName && activeForm?.mode !== 'edit') {
        const resolvedItem: ItemRecord = {
          id: existingItemWithName.id,
          display_name: resolvedDisplayName,
          ...basePayload,
        };

        db.execSync('BEGIN TRANSACTION;');

        try {
          db.runSync(
            `
              UPDATE ${tableName}
              SET name = ?, quantity = ?, unit = ?, display_name = ?
              WHERE id = ? AND user_id = ?;
            `,
            [
              basePayload.name,
              basePayload.quantity,
              basePayload.unit,
              resolvedItem.display_name,
              existingItemWithName.id,
              user.id,
            ],
          );

          addToSyncQueue(tableName, 'UPDATE', {
            id: existingItemWithName.id,
            user_id: user.id,
            data: syncPayload,
          }, { userId: user.id });

          db.execSync('COMMIT;');
        } catch (error) {
          db.execSync('ROLLBACK;');
          throw error;
        }

        setItems((currentItems) =>
          sortMasterItems(currentItems.map((currentItem) => (currentItem.id === resolvedItem.id ? resolvedItem : currentItem))),
        );
        onMasterItemChange?.(resolvedItem);
        onSelect(resolvedItem.id, getMasterItemDisplayName(resolvedItem));
        closeSheet();
        resetForm();
        showError(`${displayType} updated and selected.`);
        void runSync();
        return;
      }

      if (activeForm?.mode === 'edit' && activeForm.itemId) {
        const resolvedItem: ItemRecord = {
          id: activeForm.itemId,
          display_name: resolvedDisplayName,
          ...basePayload,
        };

        db.execSync('BEGIN TRANSACTION;');

        try {
          db.runSync(
            `
              UPDATE ${tableName}
              SET name = ?, quantity = ?, unit = ?, display_name = ?
              WHERE id = ? AND user_id = ?;
            `,
            [
              basePayload.name,
              basePayload.quantity,
              basePayload.unit,
              resolvedItem.display_name,
              activeForm.itemId,
              user.id,
            ],
          );

          addToSyncQueue(tableName, 'UPDATE', {
            id: activeForm.itemId,
            user_id: user.id,
            data: syncPayload,
          }, { userId: user.id });

          db.execSync('COMMIT;');
        } catch (error) {
          db.execSync('ROLLBACK;');
          throw error;
        }

        setItems((currentItems) =>
          sortMasterItems(currentItems.map((currentItem) => (currentItem.id === resolvedItem.id ? resolvedItem : currentItem))),
        );
        onMasterItemChange?.(resolvedItem);
        const updatedLabel = getMasterItemDisplayName(resolvedItem);
        setSearchInputValue(updatedLabel);
        setSearchQuery(updatedLabel);

        resetForm();
        showError(`${displayType} updated.`);
        void runSync();
      } else {
        const itemId = createUuid();
        const resolvedItem: ItemRecord = {
          id: itemId,
          display_name: resolvedDisplayName,
          ...basePayload,
        };

        db.execSync('BEGIN TRANSACTION;');

        try {
          db.runSync(
            `
              INSERT INTO ${tableName} (id, user_id, name, quantity, unit, display_name)
              VALUES (?, ?, ?, ?, ?, ?);
            `,
            [itemId, user.id, basePayload.name, basePayload.quantity, basePayload.unit, resolvedItem.display_name],
          );

          addToSyncQueue(tableName, 'INSERT', {
            id: itemId,
            user_id: user.id,
            ...syncPayload,
          }, { userId: user.id });

          db.execSync('COMMIT;');
        } catch (error) {
          db.execSync('ROLLBACK;');
          throw error;
        }

        setItems((currentItems) => sortMasterItems([...currentItems, resolvedItem]));
        onMasterItemChange?.(resolvedItem);
        onSelect(resolvedItem.id, getMasterItemDisplayName(resolvedItem));
        closeSheet();
        void runSync();

        resetForm();
      }
    } catch (error: any) {
      showError(error?.message ?? `Unable to save this ${displayType.toLowerCase()}.`);
    } finally {
      setIsSaving(false);
    }
  }, [activeForm, closeSheet, displayType, draftName, draftQuantity, draftUnit, findItemByName, onMasterItemChange, onSelect, resetForm, showError, tableName, user]);

  const handleDismiss = useCallback(() => {
    setSearchInputValue('');
    setSearchQuery('');
    setItems([]);
    resetForm();
    onClose?.();
  }, [onClose, resetForm]);

  const snapPoints = useMemo(() => (activeForm ? ['100%'] : ['74%', '92%']), [activeForm]);
  const keyboardBehavior: 'extend' = 'extend';
  const sheetTopInset = headerHeight + Spacing.xs;

  const renderBackdrop = useCallback(
    (backdropProps: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...backdropProps} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} />
    ),
    [],
  );

  const headerContent = useMemo(
    () => (
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <View style={[styles.headerIconShell, { backgroundColor: accentContainerColor }]}> 
              <MaterialCommunityIcons name={iconName} size={20} color={accentColor} />
            </View>
            <View style={styles.headerTextBlock}>
              <Text variant="titleLarge" style={[styles.sheetTitle, { color: colors.text }]}>
                {activeForm ? (activeForm.mode === 'edit' ? `Edit ${displayType}` : createLabel) : `Select ${displayType}`}
              </Text>
              <Text variant="bodySmall" style={[styles.sheetSubtitle, { color: colors.textMuted }]}> 
                {activeForm ? 'Enter item details below.' : `Choose a saved ${displayType.toLowerCase()} or create a new one.`}
              </Text>
            </View>
          </View>
          <IconButton icon="close" iconColor={colors.text} size={24} onPress={closeSheet} />
        </View>

        {!activeForm && (
          <>
            <SheetTextField
              colors={colors}
              containerStyle={styles.searchFieldBlock}
              surfaceStyle={styles.searchFieldSurface}
              icon="magnify"
              placeholder={`Search ${displayType.toLowerCase()}...`}
              value={searchInputValue}
              onChangeText={handleSearchQueryChange}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              returnKeyType="search"
              trailing={
                searchInputValue.length > 0 ? (
                  <Pressable accessibilityRole="button" onPress={clearSearchQuery} hitSlop={Spacing.sm}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null
              }
            />

            <View style={styles.headerMetaRow}>
              {hasSearchQuery && !hasExactMatch ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Create ${displayType} ${searchInputValue.trim()}`}
                  onPress={handleOpenCreateForm}
                  style={({ pressed }) => [
                    styles.quickCreateInline,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.ghostBorder,
                    },
                    pressed && styles.quickCreateInlinePressed,
                  ]}
                >
                  <MaterialCommunityIcons name="plus-circle-outline" size={16} color={accentColor} />
                  <Text variant="labelMedium" style={{ color: colors.text }} numberOfLines={1}>
                    Create "{searchInputValue.trim()}"
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}

        {loading && !activeForm && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text variant="bodySmall" style={[styles.loadingText, { color: colors.textMuted }]}>Refreshing saved items...</Text>
          </View>
        )}
      </View>
    ),
    [
      accentColor,
      accentContainerColor,
      activeForm,
      clearSearchQuery,
      closeSheet,
      colors,
      createLabel,
      displayType,
      handleOpenCreateForm,
      handleSearchQueryChange,
      hasExactMatch,
      hasSearchQuery,
      iconName,
      loading,
      searchInputValue,
    ],
  );

  const unitSuggestionChips = useMemo(
    () =>
      unitSuggestions.map((unitOption) => {
        const isSelected = draftUnit.trim().toLowerCase() === unitOption;

        return (
          <Pressable
            key={unitOption}
            onPress={() => setDraftUnit(unitOption)}
            style={({ pressed }) => [
              styles.unitSuggestionChip,
              {
                backgroundColor: isSelected ? accentContainerColor : colors.surfaceContainerLow,
                borderColor: colors.ghostBorder,
              },
              pressed && styles.unitSuggestionChipPressed,
            ]}
          >
            <Text variant="labelMedium" style={{ color: isSelected ? accentColor : colors.textMuted }}>
              {unitOption}
            </Text>
          </Pressable>
        );
      }),
    [accentColor, accentContainerColor, colors.ghostBorder, colors.surfaceContainerLow, colors.textMuted, draftUnit, unitSuggestions],
  );

  const renderForm = () => {
    const draftQuantityValue = draftQuantity.trim().length > 0 ? Number(draftQuantity) : null;
    const previewQuantity = draftQuantityValue !== null && Number.isFinite(draftQuantityValue) ? draftQuantityValue : null;
    const previewUnit = draftUnit.trim().length > 0 ? draftUnit.trim() : null;
    const previewLabel = buildMasterItemDisplayName(draftName, previewQuantity, previewUnit);

    return (
      <AppCard
        style={[
          styles.formCard,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.ghostBorder,
            borderLeftColor: accentColor,
            shadowColor: colors.shadowAmbient,
          },
        ]}
        variant="solid"
      >
        <View style={styles.formFields}>
          <SheetTextField
            colors={colors}
            label="Name"
            placeholder={`e.g. ${type === 'medicine' ? 'Ibuprofen' : 'Apple'}`}
            value={draftName}
            onChangeText={setDraftName}
            autoCapitalize="words"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            autoFocus={Platform.OS === 'android'}
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
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
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
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={styles.unitSuggestionRow}>
            {unitSuggestionChips}
          </View>

          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.ghostBorder,
              },
            ]}
          >
            <Text variant="labelMedium" style={{ color: colors.textMuted }}>
              Preview
            </Text>
            <Text variant="titleMedium" style={[styles.previewTitle, { color: colors.text }]} numberOfLines={1}>
              {previewLabel}
            </Text>
          </View>
        </View>

        <View style={styles.formActions}>
          <CustomButton mode="text" onPress={resetForm} style={styles.formActionButton}>
            Cancel
          </CustomButton>
          <CustomButton
            mode="contained"
            onPress={handleSubmitMasterItem}
            isLoading={isSaving}
            style={styles.formActionButton}
            buttonColor={accentContainerColor}
            textColor={accentColor}
          >
            {activeForm?.mode === 'edit' ? 'Save Changes' : 'Create & Select'}
          </CustomButton>
        </View>
      </AppCard>
    );
  };

  const shouldAnimateRows = !hasSearchQuery;

  const keyExtractor = useCallback((item: ItemRecord) => item.id, []);

  const renderListItem = useCallback(
    ({ item, index }: { item: ItemRecord; index: number }) => (
      <ItemRow
        item={item}
        index={index}
        animateRows={shouldAnimateRows}
        accentColor={accentColor}
        backgroundColor={colors.surfaceContainerLowest}
        borderColor={colors.ghostBorder}
        textColor={colors.text}
        errorColor={colors.error}
        onSelect={handleSelectItem}
        onEdit={handleEditMasterItem}
        onDelete={handleDeleteMasterItem}
      />
    ),
    [
      accentColor,
      colors.error,
      colors.ghostBorder,
      colors.surfaceContainerLowest,
      colors.text,
      handleDeleteMasterItem,
      handleEditMasterItem,
      handleSelectItem,
      shouldAnimateRows,
    ],
  );

  const listEmptyContent = useMemo(
    () =>
      loading ? null : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="magnify" size={32} color={colors.textMuted} />
          <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>No matching saved items.</Text>
        </View>
      ),
    [colors.textMuted, loading],
  );

  const listFooterContent = useMemo(() => {
    if (activeForm || hasExactMatch || hasSearchQuery) {
      return null;
    }

    return (
      <View style={styles.footerContainer}>
        <CustomButton
          mode="contained"
          icon="plus"
          onPress={handleOpenCreateForm}
          buttonColor={accentContainerColor}
          textColor={accentColor}
        >
          {createLabel}
        </CustomButton>
      </View>
    );
  }, [accentColor, accentContainerColor, activeForm, createLabel, handleOpenCreateForm, hasExactMatch, hasSearchQuery]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      enableDismissOnClose
      backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}
      handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: colors.ghostBorder }]}
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      android_keyboardInputMode="adjustResize"
      topInset={sheetTopInset}
    >
      <View style={styles.sheetContent}>
        {headerContent}

        {activeForm ? (
          <BottomSheetScrollView
            style={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={styles.formScrollContent}
          >
            {renderForm()}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetFlatList
            style={styles.list}
            data={filteredItems}
            keyExtractor={keyExtractor}
            renderItem={renderListItem}
            ListEmptyComponent={listEmptyContent}
            ListFooterComponent={listFooterContent}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
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
  list: {
    flex: 1,
  },
  formScroll: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 0,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
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
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  savedCountPill: {
    minHeight: 30,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedCountText: {
    fontWeight: '700',
  },
  quickCreateInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: Spacing.sm,
    maxWidth: '68%',
  },
  quickCreateInlinePressed: {
    opacity: 0.92,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xxs,
  },
  loadingText: {
    flex: 1,
  },
  fieldBlock: {
    gap: Spacing.xs,
  },
  searchFieldBlock: {
    width: '100%',
  },
  fieldLabel: {
    marginLeft: Spacing.sm,
  },
  fieldSurface: {
    minHeight: 56,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchFieldSurface: {
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 0,
  },
  fieldInput: {
    flex: 1,
    minHeight: 24,
  },
  formCard: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: Radius.xl,
    shadowOpacity: 0.11,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: Spacing.md,
    padding: Spacing.md,
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
  unitSuggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  unitSuggestionChip: {
    minHeight: 34,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitSuggestionChipPressed: {
    opacity: 0.9,
  },
  previewCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xxs,
  },
  previewTitle: {
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  formActionButton: {
    flex: 1,
  },
  formScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl + Spacing.xl,
    paddingTop: Spacing.xs,
    gap: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxxl + Spacing.xl,
    gap: Spacing.xs,
  },
  itemCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xxs,
  },
  itemRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xxs,
  },
  itemSelectArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: Spacing.xxs,
    paddingRight: Spacing.xxs,
    gap: Spacing.sm,
  },
  itemSelectPressed: {
    opacity: 0.86,
  },
  itemMarker: {
    width: 14,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 14,
  },
  itemTextBlock: {
    flex: 1,
  },
  itemTitle: {
    fontWeight: '600',
  },
  itemActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  itemActionButton: {
    margin: 0,
    width: 48,
    height: 48,
  },
  emptyState: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
  },
  footerContainer: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
});