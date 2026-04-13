import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
} from 'react-native';
import Reanimated, {
  Easing,
  FadeInDown,
  FadeOut,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ActivityIndicator, Chip, IconButton, SegmentedButtons, Switch, Text } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors, useThemePreference } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { addToSyncQueue, db } from '../../lib/localDb';
import { runSync } from '../../lib/syncEngine';
import { AppCard } from '../../components/ui/AppCard';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';
import { CustomButton } from '../../components/ui/CustomButton';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { ItemSelector } from '../../components/forms/ItemSelector';

type LogFilter = 'all' | 'pain' | 'stress' | 'medicine' | 'food';
type LogType = Exclude<LogFilter, 'all'>;
type StressLevel = 'none' | 'low' | 'moderate' | 'high';
type StressLevelValue = number | 'none' | 'low' | 'moderate' | 'high';

type EditItemType = 'medicine' | 'food';

interface SelectedItem {
  id: string;
  name: string;
}

interface PainLogRow {
  id: string;
  logged_at: string;
  log_date: string;
  body_part: string | null;
  pain_level: number | null;
  swelling: boolean | null;
}

interface PainLogSqlRow {
  id: string;
  logged_at: string;
  log_date: string;
  body_part: string | null;
  pain_level: number | null;
  swelling: number | null;
}

interface StressLogRow {
  id: string;
  logged_at: string;
  log_date: string;
  level: StressLevelValue | null;
}

interface MedicineLogRow {
  id: string;
  logged_at: string;
  log_date: string;
  medicine_id: string;
  item_display_name: string | null;
  item_name: string | null;
  item_quantity: number | null;
  item_unit: string | null;
}

interface FoodLogRow {
  id: string;
  logged_at: string;
  log_date: string;
  food_id: string;
  item_display_name: string | null;
  item_name: string | null;
  item_quantity: number | null;
  item_unit: string | null;
}

interface UserItemRow {
  id: string;
  display_name: string | null;
  name: string | null;
  quantity: number | null;
  unit: string | null;
}

interface ItemSnapshotRow {
  name: string | null;
  quantity: number | null;
  unit: string | null;
  display_name: string | null;
}

interface TimelineEntry {
  id: string;
  type: LogType;
  logDate: string;
  loggedAt: string;
  title: string;
  subtitle: string;
  payload:
    | { kind: 'pain'; row: PainLogRow }
    | { kind: 'stress'; row: StressLogRow }
    | { kind: 'medicine'; row: MedicineLogRow; item: UserItemRow | null }
    | { kind: 'food'; row: FoodLogRow; item: UserItemRow | null };
}

interface LogSection {
  title: string;
  data: TimelineEntry[];
  dateKey: string;
}

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatSectionTitle(dateString: string) {
  const date = parseLocalDate(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameLocalDay(date, today)) {
    return 'Today';
  }

  if (isSameLocalDay(date, yesterday)) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateString: string) {
  return new Date(dateString)
    .toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/\s?(AM|PM)$/, (match) => match.toLowerCase());
}

function titleCase(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPainEntryTitle(row: PainLogRow) {
  const bodyPart = row.body_part?.trim();

  return bodyPart && bodyPart.length > 0 ? bodyPart : 'Pain entry';
}

function formatPainEntrySubtitle(row: PainLogRow) {
  const pieces: string[] = [];

  if (row.pain_level !== null && row.pain_level !== undefined) {
    pieces.push(String(row.pain_level));
  }

  if (row.swelling) {
    pieces.push('Swelling');
  }

  pieces.push(formatTime(row.logged_at));

  return pieces.join(' • ');
}

function formatStressLabel(value: StressLevelValue | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string') {
    return titleCase(value);
  }

  return 'Unknown';
}

function formatStressEntryTitle(value: StressLevelValue | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string') {
    return formatStressLabel(value);
  }

  return 'Unknown';
}

function coerceStressLevel(value: StressLevelValue | null | undefined): StressLevel {
  if (value === 'none' || value === 'low' || value === 'moderate' || value === 'high') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 2) return 'low';
    if (value <= 5) return 'moderate';
    return 'high';
  }

  return 'none';
}

function normalizeStressLevel(value: StressLevelValue | string | null | undefined): StressLevel {
  if (value === 'none' || value === 'low' || value === 'moderate' || value === 'high') {
    return value;
  }

  if (typeof value === 'string') {
    const lowered = value.toLowerCase();

    if (lowered === 'mid') {
      return 'moderate';
    }

    return 'none';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return coerceStressLevel(value);
  }

  return 'none';
}

const listReveal = (delay: number) => FadeInDown.delay(delay).duration(300);

function buildDisplayName(item?: UserItemRow | null) {
  if (!item) {
    return 'Unknown item';
  }

  if (item.name && item.name.trim().length > 0) {
    return item.name;
  }

  if (item.display_name && item.display_name.trim().length > 0) {
    return item.display_name;
  }

  return 'Unknown item';
}

function formatItemQuantityAndUnit(item?: UserItemRow | null) {
  if (!item) {
    return '';
  }

  const quantity = item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : '';
  const unit = item.unit?.trim() ?? '';

  if (quantity && unit) {
    return `${quantity} ${unit}`;
  }

  if (quantity) {
    return quantity;
  }

  if (unit) {
    return unit;
  }

  return '';
}

function formatSnapshotQuantityAndUnit(quantityValue: number | null | undefined, unitValue: string | null | undefined) {
  const quantity = quantityValue !== null && quantityValue !== undefined ? String(quantityValue) : '';
  const unit = unitValue?.trim() ?? '';

  if (quantity && unit) {
    return `${quantity} ${unit}`;
  }

  if (quantity) {
    return quantity;
  }

  if (unit) {
    return unit;
  }

  return '';
}

function groupEntriesByDate(entries: TimelineEntry[]) {
  const grouped = new Map<string, TimelineEntry[]>();

  entries.forEach((entry) => {
    const existing = grouped.get(entry.logDate) ?? [];
    existing.push(entry);
    grouped.set(entry.logDate, existing);
  });

  return Array.from(grouped.entries()).map<LogSection>(([dateKey, data]) => ({
    dateKey,
    title: formatSectionTitle(dateKey),
    data,
  }));
}

interface ExpandableLogCardProps {
  entry: TimelineEntry;
  config: {
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    container: string;
    iconColor: string;
  };
  colors: ReturnType<typeof useAppColors>;
  itemIndex: number;
  isExpanded: boolean;
  onToggle: (entry: TimelineEntry) => void;
  onEdit: (entry: TimelineEntry) => void;
  onDelete: (entry: TimelineEntry) => void;
}

function ExpandableLogCard({
  entry,
  config,
  colors,
  itemIndex,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: ExpandableLogCardProps) {
  const pressProgress = useSharedValue(0);
  const expandProgress = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    expandProgress.value = withSpring(isExpanded ? 1 : 0, {
      damping: 18,
      stiffness: 210,
      mass: 0.9,
    });
  }, [expandProgress, isExpanded]);

  const cardMotionStyle = useAnimatedStyle(() => {
    const lift = expandProgress.value * 2.5 + pressProgress.value * 1.5;

    return {
      transform: [{ translateY: -lift }, { scale: 1 - pressProgress.value * 0.015 }] as const,
    };
  });

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expandProgress.value * 180}deg` }],
  }));

  const handlePressIn = () => {
    pressProgress.value = withTiming(1, {
      duration: 120,
      easing: Easing.out(Easing.quad),
    });
  };

  const handlePressOut = () => {
    pressProgress.value = withTiming(0, {
      duration: 170,
      easing: Easing.out(Easing.cubic),
    });
  };

  return (
    <Reanimated.View
      entering={listReveal(Math.min(itemIndex * 24, 220))}
      layout={Layout.springify().damping(19).stiffness(170)}
      style={styles.motionCardWrap}
    >
      <Reanimated.View style={cardMotionStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${entry.type} entry ${entry.title}`}
          onPress={() => onToggle(entry)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.entryCard,
            styles.entryPressable,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: isExpanded ? config.iconColor : colors.ghostBorder,
              borderLeftColor: config.iconColor,
              shadowColor: colors.shadowAmbient,
            },
          ]}
        >
          <View style={styles.entryTopRow}>
            <View style={styles.entryLeading}>
              <View style={[styles.iconWrap, { backgroundColor: config.container }]}> 
                <MaterialCommunityIcons name={config.icon} size={20} color={config.iconColor} />
              </View>
              <View style={styles.entryTextBlock}>
                <Text variant="titleMedium" style={{ color: colors.text }}>
                  {entry.title}
                </Text>
                <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                  {entry.subtitle}
                </Text>
              </View>
            </View>

            <View style={styles.entryHeaderRight}>
              <Chip
                compact
                style={[styles.entryChip, { backgroundColor: config.container }]}
                textStyle={{ color: config.iconColor }}
              >
                {config.label}
              </Chip>

              <Reanimated.View
                style={[
                  styles.expandIndicator,
                  chevronStyle,
                  {
                    backgroundColor: colors.surfaceContainerHigh,
                    borderColor: colors.ghostBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textMuted} />
              </Reanimated.View>
            </View>
          </View>
        </Pressable>
      </Reanimated.View>

      {isExpanded ? (
        <Reanimated.View
          entering={FadeInDown.duration(240)}
          exiting={FadeOut.duration(160)}
          layout={Layout.springify().damping(20).stiffness(180)}
          style={[
            styles.actionDrawer,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.ghostBorder,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${entry.title}`}
            onPress={() => onEdit(entry)}
            style={[
              styles.drawerActionButton,
              {
                backgroundColor: colors.primaryContainer,
                borderColor: colors.ghostBorder,
              },
            ]}
          >
            <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.onPrimaryContainer} />
            <Text variant="labelLarge" style={[styles.drawerActionLabel, { color: colors.onPrimaryContainer }]}>
              Edit
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${entry.title}`}
            onPress={() => onDelete(entry)}
            style={[
              styles.drawerActionButton,
              {
                backgroundColor: colors.errorContainer,
                borderColor: colors.ghostBorder,
              },
            ]}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.onErrorContainer} />
            <Text variant="labelLarge" style={[styles.drawerActionLabel, { color: colors.onErrorContainer }]}>
              Delete
            </Text>
          </Pressable>
        </Reanimated.View>
      ) : null}
    </Reanimated.View>
  );
}

export default function LogsScreen() {
  const colors = useAppColors();
  const { appliedTheme } = useThemePreference();
  const { user } = useAuth();
  const router = useRouter();
  const isFocused = useIsFocused();

  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<LogFilter>('all');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);
  const [editPainBodyPart, setEditPainBodyPart] = useState('');
  const [editPainLevel, setEditPainLevel] = useState(1);
  const [editPainSwelling, setEditPainSwelling] = useState(false);
  const [editStressLevel, setEditStressLevel] = useState<StressLevel>('none');
  const [editSelectedItem, setEditSelectedItem] = useState<SelectedItem | null>(null);
  const [editSelectorVisible, setEditSelectorVisible] = useState(false);
  const [editSelectorType, setEditSelectorType] = useState<EditItemType>('medicine');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<TimelineEntry | null>(null);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);
  const [deletedEntry, setDeletedEntry] = useState<TimelineEntry | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const showError = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const closeEditor = () => {
    setEditingEntry(null);
    setEditSelectorVisible(false);
    setEditSelectedItem(null);
    setPendingDeleteEntry(null);
    setIsDeletingEntry(false);
    setExpandedEntryId(null);
  };

  const openEditor = (entry: TimelineEntry) => {
    setExpandedEntryId(entry.id);
    setEditingEntry(entry);
    setEditSelectorVisible(false);
    setPendingDeleteEntry(null);
    setIsDeletingEntry(false);

    if (entry.payload.kind === 'pain') {
      setEditPainBodyPart(entry.payload.row.body_part ?? '');
      setEditPainLevel(entry.payload.row.pain_level ?? 1);
      setEditPainSwelling(Boolean(entry.payload.row.swelling));
      setEditSelectedItem(null);
      return;
    }

    if (entry.payload.kind === 'stress') {
      setEditStressLevel(coerceStressLevel(entry.payload.row.level));
      setEditSelectedItem(null);
      return;
    }

    setEditSelectedItem(
      entry.payload.item
        ? { id: entry.payload.item.id, name: entry.payload.item.display_name ?? entry.payload.item.name ?? entry.title }
        : null,
    );
  };

  const openEditItemSelector = (type: EditItemType) => {
    setEditSelectorType(type);
    setEditSelectorVisible(true);
  };

  const openDeleteConfirm = (entry: TimelineEntry) => {
    setEditingEntry(null);
    setEditSelectorVisible(false);
    setEditSelectedItem(null);
    setPendingDeleteEntry(entry);
    setIsDeletingEntry(false);
    setExpandedEntryId(entry.id);
  };

  const closeDeleteConfirm = () => {
    setPendingDeleteEntry(null);
    setIsDeletingEntry(false);
    setExpandedEntryId(null);
  };

  const insertPayloadRow = async (entry: TimelineEntry) => {
    if (!user) {
      throw new Error('You must be logged in to restore entries.');
    }

    if (entry.payload.kind === 'pain') {
      const payload = {
        id: entry.payload.row.id,
        user_id: user.id,
        logged_at: entry.loggedAt,
        log_date: entry.logDate,
        body_part: entry.payload.row.body_part,
        pain_level: entry.payload.row.pain_level,
        swelling: entry.payload.row.swelling,
      };

      db.runSync(
        `
          INSERT OR REPLACE INTO pain_logs
          (id, user_id, logged_at, log_date, body_part, pain_level, swelling)
          VALUES (?, ?, ?, ?, ?, ?, ?);
        `,
        [
          payload.id,
          payload.user_id,
          payload.logged_at,
          payload.log_date,
          payload.body_part,
          payload.pain_level,
          payload.swelling === null ? null : payload.swelling ? 1 : 0,
        ],
      );

      addToSyncQueue('pain_logs', 'INSERT', payload);
      return;
    }

    if (entry.payload.kind === 'stress') {
      const payload = {
        id: entry.payload.row.id,
        user_id: user.id,
        logged_at: entry.loggedAt,
        log_date: entry.logDate,
        level: normalizeStressLevel(entry.payload.row.level),
      };

      db.runSync(
        `
          INSERT OR REPLACE INTO stress_logs
          (id, user_id, logged_at, log_date, level)
          VALUES (?, ?, ?, ?, ?);
        `,
        [payload.id, payload.user_id, payload.logged_at, payload.log_date, payload.level],
      );

      addToSyncQueue('stress_logs', 'INSERT', payload);
      return;
    }

    if (entry.payload.kind === 'medicine') {
      const itemDisplayName = entry.payload.row.item_display_name?.trim() || entry.title;
      const payload = {
        id: entry.payload.row.id,
        user_id: user.id,
        medicine_id: entry.payload.row.medicine_id,
        item_display_name: itemDisplayName,
        item_name: entry.payload.row.item_name,
        item_quantity: entry.payload.row.item_quantity,
        item_unit: entry.payload.row.item_unit,
        logged_at: entry.loggedAt,
        log_date: entry.logDate,
      };

      db.runSync(
        `
          INSERT OR REPLACE INTO medicine_logs
          (id, user_id, medicine_id, item_display_name, item_name, item_quantity, item_unit, logged_at, log_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          payload.id,
          payload.user_id,
          payload.medicine_id,
          payload.item_display_name,
          payload.item_name,
          payload.item_quantity,
          payload.item_unit,
          payload.logged_at,
          payload.log_date,
        ],
      );

      addToSyncQueue('medicine_logs', 'INSERT', {
        id: payload.id,
        user_id: payload.user_id,
        medicine_id: payload.medicine_id,
        logged_at: payload.logged_at,
        log_date: payload.log_date,
      });
      return;
    }

    const itemDisplayName = entry.payload.row.item_display_name?.trim() || entry.title;
    const payload = {
      id: entry.payload.row.id,
      user_id: user.id,
      food_id: entry.payload.row.food_id,
      item_display_name: itemDisplayName,
      item_name: entry.payload.row.item_name,
      item_quantity: entry.payload.row.item_quantity,
      item_unit: entry.payload.row.item_unit,
      logged_at: entry.loggedAt,
      log_date: entry.logDate,
    };

    db.runSync(
      `
        INSERT OR REPLACE INTO food_logs
        (id, user_id, food_id, item_display_name, item_name, item_quantity, item_unit, logged_at, log_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        payload.id,
        payload.user_id,
        payload.food_id,
        payload.item_display_name,
        payload.item_name,
        payload.item_quantity,
        payload.item_unit,
        payload.logged_at,
        payload.log_date,
      ],
    );

    addToSyncQueue('food_logs', 'INSERT', {
      id: payload.id,
      user_id: payload.user_id,
      food_id: payload.food_id,
      logged_at: payload.logged_at,
      log_date: payload.log_date,
    });
  };

  const deleteLogEntry = async (entry: TimelineEntry) => {
    if (!user) {
      showError('You must be logged in to manage logs.');
      throw new Error('Missing authenticated user.');
    }

    try {
      if (entry.payload.kind === 'pain') {
        db.runSync('DELETE FROM pain_logs WHERE id = ? AND user_id = ?;', [entry.payload.row.id, user.id]);
        addToSyncQueue('pain_logs', 'DELETE', { id: entry.payload.row.id });
      } else if (entry.payload.kind === 'stress') {
        db.runSync('DELETE FROM stress_logs WHERE id = ? AND user_id = ?;', [entry.payload.row.id, user.id]);
        addToSyncQueue('stress_logs', 'DELETE', { id: entry.payload.row.id });
      } else if (entry.payload.kind === 'medicine') {
        db.runSync('DELETE FROM medicine_logs WHERE id = ? AND user_id = ?;', [entry.payload.row.id, user.id]);
        addToSyncQueue('medicine_logs', 'DELETE', { id: entry.payload.row.id });
      } else {
        db.runSync('DELETE FROM food_logs WHERE id = ? AND user_id = ?;', [entry.payload.row.id, user.id]);
        addToSyncQueue('food_logs', 'DELETE', { id: entry.payload.row.id });
      }

    } catch (error: any) {
      showError(error?.message || 'Unable to delete this log.');
      throw error;
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteEntry) {
      closeDeleteConfirm();
      return;
    }

    try {
      setIsDeletingEntry(true);
      await deleteLogEntry(pendingDeleteEntry);
      void runSync();
      setDeletedEntry(pendingDeleteEntry);
      setUndoVisible(true);
      closeDeleteConfirm();
      await loadLogs('refresh');
    } catch {
      setIsDeletingEntry(false);
    }
  };

  const handleUndoDelete = async () => {
    if (!deletedEntry || !user) {
      setUndoVisible(false);
      setDeletedEntry(null);
      return;
    }

    try {
      await insertPayloadRow(deletedEntry);
      void runSync();
      setUndoVisible(false);
      setDeletedEntry(null);
      await loadLogs('refresh');
    } catch (error: any) {
      setUndoVisible(false);
      setDeletedEntry(null);
      showError(error?.message || 'Unable to restore the deleted log.');
      await loadLogs('refresh');
    }
  };

  const handleSaveEdit = async () => {
    if (!user || !editingEntry) {
      showError('You must be logged in to edit logs.');
      return;
    }

    setIsSavingEdit(true);

    try {
      if (editingEntry.payload.kind === 'pain') {
        if (!editPainBodyPart.trim()) {
          showError('Body part is required.');
          return;
        }

        const updateData = {
          body_part: editPainBodyPart.trim(),
          pain_level: editPainLevel,
          swelling: editPainSwelling,
        };

        db.runSync(
          `
            UPDATE pain_logs
            SET body_part = ?, pain_level = ?, swelling = ?
            WHERE id = ? AND user_id = ?;
          `,
          [
            updateData.body_part,
            updateData.pain_level,
            updateData.swelling ? 1 : 0,
            editingEntry.payload.row.id,
            user.id,
          ],
        );

        addToSyncQueue('pain_logs', 'UPDATE', {
          id: editingEntry.payload.row.id,
          data: updateData,
        });
      } else if (editingEntry.payload.kind === 'stress') {
        const normalizedLevel = normalizeStressLevel(editStressLevel);

        db.runSync(
          `
            UPDATE stress_logs
            SET level = ?
            WHERE id = ? AND user_id = ?;
          `,
          [normalizedLevel, editingEntry.payload.row.id, user.id],
        );

        addToSyncQueue('stress_logs', 'UPDATE', {
          id: editingEntry.payload.row.id,
          data: { level: normalizedLevel },
        });
      } else if (editingEntry.payload.kind === 'medicine') {
        if (!editSelectedItem) {
          showError('Select a medicine before saving.');
          return;
        }

        const snapshotRow = db.getFirstSync<ItemSnapshotRow>(
          `
            SELECT name, quantity, unit, display_name
            FROM user_medicines
            WHERE id = ? AND user_id = ?;
          `,
          [editSelectedItem.id, user.id],
        );

        const nextItemName = snapshotRow?.name?.trim() || editSelectedItem.name;
        const nextItemQuantity = snapshotRow?.quantity ?? null;
        const nextItemUnit = snapshotRow?.unit?.trim() || null;
        const nextItemDisplayName = snapshotRow?.display_name?.trim() || editSelectedItem.name;

        db.runSync(
          `
            UPDATE medicine_logs
            SET medicine_id = ?, item_display_name = ?, item_name = ?, item_quantity = ?, item_unit = ?
            WHERE id = ? AND user_id = ?;
          `,
          [
            editSelectedItem.id,
            nextItemDisplayName,
            nextItemName,
            nextItemQuantity,
            nextItemUnit,
            editingEntry.payload.row.id,
            user.id,
          ],
        );

        addToSyncQueue('medicine_logs', 'UPDATE', {
          id: editingEntry.payload.row.id,
          data: { medicine_id: editSelectedItem.id },
        });
      } else {
        if (!editSelectedItem) {
          showError('Select a food item before saving.');
          return;
        }

        const snapshotRow = db.getFirstSync<ItemSnapshotRow>(
          `
            SELECT name, quantity, unit, display_name
            FROM user_foods
            WHERE id = ? AND user_id = ?;
          `,
          [editSelectedItem.id, user.id],
        );

        const nextItemName = snapshotRow?.name?.trim() || editSelectedItem.name;
        const nextItemQuantity = snapshotRow?.quantity ?? null;
        const nextItemUnit = snapshotRow?.unit?.trim() || null;
        const nextItemDisplayName = snapshotRow?.display_name?.trim() || editSelectedItem.name;

        db.runSync(
          `
            UPDATE food_logs
            SET food_id = ?, item_display_name = ?, item_name = ?, item_quantity = ?, item_unit = ?
            WHERE id = ? AND user_id = ?;
          `,
          [
            editSelectedItem.id,
            nextItemDisplayName,
            nextItemName,
            nextItemQuantity,
            nextItemUnit,
            editingEntry.payload.row.id,
            user.id,
          ],
        );

        addToSyncQueue('food_logs', 'UPDATE', {
          id: editingEntry.payload.row.id,
          data: { food_id: editSelectedItem.id },
        });
      }

      void runSync();
      closeEditor();
      await loadLogs('refresh');
    } catch (error: any) {
      showError(error?.message || 'Unable to save your changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const loadLogs = async (mode: 'initial' | 'refresh' = 'refresh', selectedDate: string | null = null) => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const dateClause = selectedDate ? ' AND log_date = ?' : '';
      const dateArgs = selectedDate ? [selectedDate] : [];

      const painRows = db.getAllSync<PainLogSqlRow>(
        `
          SELECT id, logged_at, log_date, body_part, pain_level, swelling
          FROM pain_logs
          WHERE user_id = ?${dateClause}
          ORDER BY logged_at DESC;
        `,
        [user.id, ...dateArgs],
      );
      const stressRows = db.getAllSync<StressLogRow>(
        `
          SELECT id, logged_at, log_date, level
          FROM stress_logs
          WHERE user_id = ?${dateClause}
          ORDER BY logged_at DESC;
        `,
        [user.id, ...dateArgs],
      );
      const medicineRows = db.getAllSync<MedicineLogRow>(
        `
          SELECT id, logged_at, log_date, medicine_id, item_display_name, item_name, item_quantity, item_unit
          FROM medicine_logs
          WHERE user_id = ?${dateClause}
          ORDER BY logged_at DESC;
        `,
        [user.id, ...dateArgs],
      );
      const foodRows = db.getAllSync<FoodLogRow>(
        `
          SELECT id, logged_at, log_date, food_id, item_display_name, item_name, item_quantity, item_unit
          FROM food_logs
          WHERE user_id = ?${dateClause}
          ORDER BY logged_at DESC;
        `,
        [user.id, ...dateArgs],
      );
      const medicineItemRows = db.getAllSync<UserItemRow>(
        `
          SELECT id, display_name, name, quantity, unit
          FROM user_medicines
          WHERE user_id = ?;
        `,
        [user.id],
      );
      const foodItemRows = db.getAllSync<UserItemRow>(
        `
          SELECT id, display_name, name, quantity, unit
          FROM user_foods
          WHERE user_id = ?;
        `,
        [user.id],
      );

      const medicineItems = new Map<string, UserItemRow>(medicineItemRows.map((item) => [item.id, item]));
      const foodItems = new Map<string, UserItemRow>(foodItemRows.map((item) => [item.id, item]));

      const painEntries: TimelineEntry[] = painRows.map((row) => {
        const normalizedPainRow: PainLogRow = {
          ...row,
          swelling: row.swelling === null ? null : row.swelling === 1,
        };

        return {
          id: `pain-${row.id}`,
          type: 'pain',
          logDate: row.log_date,
          loggedAt: row.logged_at,
          title: formatPainEntryTitle(normalizedPainRow),
          subtitle: formatPainEntrySubtitle(normalizedPainRow),
          payload: { kind: 'pain', row: normalizedPainRow },
        };
      });

      const stressEntries: TimelineEntry[] = stressRows.map((row: StressLogRow) => ({
        id: `stress-${row.id}`,
        type: 'stress',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        title: formatStressEntryTitle(row.level),
        subtitle: formatTime(row.logged_at),
        payload: { kind: 'stress', row },
      }));

      const medicineEntries: TimelineEntry[] = medicineRows.map((row: MedicineLogRow) => {
        const medicineItem = medicineItems.get(row.medicine_id) ?? null;
        const snapshotTitle = row.item_name?.trim() || row.item_display_name?.trim() || '';
        const snapshotDose = formatSnapshotQuantityAndUnit(row.item_quantity, row.item_unit);
        const medicineDose = snapshotDose || formatItemQuantityAndUnit(medicineItem);
        const resolvedTitle = snapshotTitle || buildDisplayName(medicineItem);

        return {
          id: `medicine-${row.id}`,
          type: 'medicine',
          logDate: row.log_date,
          loggedAt: row.logged_at,
          title: resolvedTitle,
          subtitle: medicineDose ? `${medicineDose} • ${formatTime(row.logged_at)}` : formatTime(row.logged_at),
          payload: { kind: 'medicine', row, item: medicineItem },
        };
      });

      const foodEntries: TimelineEntry[] = foodRows.map((row: FoodLogRow) => {
        const foodItem = foodItems.get(row.food_id) ?? null;
        const snapshotTitle = row.item_name?.trim() || row.item_display_name?.trim() || '';
        const snapshotServing = formatSnapshotQuantityAndUnit(row.item_quantity, row.item_unit);
        const serving = snapshotServing || formatItemQuantityAndUnit(foodItem);
        const resolvedTitle = snapshotTitle || buildDisplayName(foodItem);

        return {
          id: `food-${row.id}`,
          type: 'food',
          logDate: row.log_date,
          loggedAt: row.logged_at,
          title: resolvedTitle,
          subtitle: serving ? `${serving} • ${formatTime(row.logged_at)}` : formatTime(row.logged_at),
          payload: { kind: 'food', row, item: foodItem },
        };
      });

      const allEntries = [...painEntries, ...stressEntries, ...medicineEntries, ...foodEntries].sort(
        (left, right) => new Date(right.loggedAt).getTime() - new Date(left.loggedAt).getTime(),
      );

      setEntries(allEntries);
    } catch (error: any) {
      showError(error?.message || 'Unable to load logs from local database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadLogs(entries.length === 0 ? 'initial' : 'refresh');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, user?.id]);

  const visibleEntries = useMemo(
    () => entries.filter((entry) => filter === 'all' || entry.type === filter),
    [entries, filter],
  );
  const visibleSections = useMemo(() => groupEntriesByDate(visibleEntries), [visibleEntries]);

  const typeConfig: Record<LogType, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; container: string; iconColor: string }> = {
    pain: {
      label: 'Pain',
      icon: 'thermometer-lines',
      container: colors.errorContainer,
      iconColor: colors.onErrorContainer,
    },
    stress: {
      label: 'Stress',
      icon: 'brain',
      container: colors.tertiaryContainer,
      iconColor: colors.onTertiaryContainer,
    },
    medicine: {
      label: 'Medicine',
      icon: 'pill',
      container: colors.primaryContainer,
      iconColor: colors.onPrimaryContainer,
    },
    food: {
      label: 'Food',
      icon: 'food-apple',
      container: colors.secondaryContainer,
      iconColor: colors.onSecondaryContainer,
    },
  };

  const pendingDeleteConfig = pendingDeleteEntry ? typeConfig[pendingDeleteEntry.type] : null;
  const deleteModalScrimColor = appliedTheme === 'dark' ? colors.background : colors.text;

  const filterOptions: Array<{ value: LogFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
    { value: 'all', label: 'All', icon: 'timeline-text' },
    { value: 'food', label: 'Food', icon: 'food-apple' },
    { value: 'pain', label: 'Pain', icon: 'thermometer-lines' },
    { value: 'medicine', label: 'Medicine', icon: 'pill' },
    { value: 'stress', label: 'Stress', icon: 'brain' },
  ];

  const toggleEntryActions = (entry: TimelineEntry) => {
    setExpandedEntryId((currentId) => (currentId === entry.id ? null : entry.id));
  };

  const renderEntry = ({ item, index }: { item: TimelineEntry; index: number }) => {
    const config = typeConfig[item.type];

    return (
      <ExpandableLogCard
        entry={item}
        config={config}
        colors={colors}
        itemIndex={index}
        isExpanded={expandedEntryId === item.id}
        onToggle={toggleEntryActions}
        onEdit={openEditor}
        onDelete={openDeleteConfirm}
      />
    );
  };

  const renderListHeader = () => {
    if (loading && entries.length === 0) {
      return (
        <View style={styles.headerStack}>
          <View style={styles.headerBlock}>
            <Text variant="headlineSmall" style={{ color: colors.text }}>
              Recent Logs
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
              Track what happened and when.
            </Text>
          </View>

          <Reanimated.View entering={listReveal(40)}>
            <AppCard style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
              <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                Loading local logs...
              </Text>
            </AppCard>
          </Reanimated.View>
        </View>
      );
    }

    return null;
  };

  const renderFilterBar = () => {
    return (
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filterOptions.map((option) => {
            const selected = filter === option.value;
            const categoryConfig = option.value === 'all' ? null : typeConfig[option.value];
            const selectedBackground = categoryConfig?.container ?? colors.surfaceContainerHighest;
            const selectedTextColor = categoryConfig?.iconColor ?? colors.text;

            return (
              <Chip
                key={option.value}
                icon={({ size, color }) => (
                  <MaterialCommunityIcons
                    name={option.icon}
                    size={size}
                    color={selected ? selectedTextColor : color}
                  />
                )}
                selected={selected}
                onPress={() => setFilter(option.value)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected ? selectedBackground : colors.surfaceContainerLow,
                    borderColor: selected ? selectedBackground : colors.ghostBorder,
                  },
                ]}
                textStyle={{ color: selected ? selectedTextColor : colors.textMuted }}
              >
                {option.label}
              </Chip>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading && entries.length === 0) {
      return null;
    }

    const isFiltered = filter !== 'all';

    return (
      <Reanimated.View entering={listReveal(60)}>
        <AppCard style={styles.emptyCard}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceContainerHigh }]}> 
            <MaterialCommunityIcons name={isFiltered ? 'filter-off' : 'clipboard-text-outline'} size={24} color={colors.textMuted} />
          </View>
          <Text variant="titleMedium" style={{ color: colors.text, textAlign: 'center' }}>
            {isFiltered ? 'No logs match this filter.' : 'Nothing logged yet.'}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textMuted, textAlign: 'center' }}>
            {isFiltered
              ? 'Try another filter or add a fresh log to continue building your history.'
              : 'Use the plus button to add pain, stress, medicine, or food entries.'}
          </Text>
          <CustomButton
            mode="contained"
            onPress={() => router.push('/add-log')}
            buttonColor={colors.primary}
            textColor={colors.onPrimary}
            style={styles.emptyButton}
          >
            Add Entry
          </CustomButton>
        </AppCard>
      </Reanimated.View>
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.screenContent}>
        {renderFilterBar()}

        <SectionList
          style={styles.list}
          sections={visibleSections}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          renderSectionHeader={({ section }) => (
              <View
                style={[
                  styles.sectionHeaderCard,
                  {
                    backgroundColor: colors.surfaceContainerHighest,
                    borderColor: colors.ghostBorder,
                    shadowColor: colors.shadowAmbient,
                  },
                ]}
              >
                <View style={styles.sectionHeaderTitleRow}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={16} color={colors.textMuted} />
                  <Text variant="titleSmall" style={[styles.sectionHeaderTitle, { color: colors.text }]}>
                    {section.title}
                  </Text>
                </View>

                <View style={[styles.sectionHeaderCountPill]}>
                  <Text variant="labelMedium" style={[styles.sectionHeaderCountText, { color: colors.onPrimaryContainer }]}>
                    {section.data.length} {section.data.length === 1 ? 'entry' : 'entries'}
                  </Text>
                </View>
              </View>
          )}
          ListHeaderComponent={renderListHeader()}
          ListEmptyComponent={renderEmptyState()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          removeClippedSubviews={false}
          initialNumToRender={12}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void (async () => {
                  try {
                    await runSync();
                  } finally {
                    await loadLogs('refresh');
                  }
                })();
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      </View>

      <Modal visible={editingEntry !== null} transparent animationType="fade" onRequestClose={closeEditor}>
        <View style={styles.modalContainer}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.text, opacity: 0.45 }]} onPress={closeEditor} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <AppCard style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text variant="titleLarge" style={[styles.cardTitle, { color: colors.text }]}>
                  Edit {editingEntry?.type === 'pain' ? 'Pain' : editingEntry?.type === 'stress' ? 'Stress' : editingEntry?.type === 'medicine' ? 'Medicine' : 'Food'} Entry
                </Text>
                <IconButton icon="close" iconColor={colors.text} size={24} onPress={closeEditor} />
              </View>

              {editingEntry?.payload.kind === 'pain' && (
                <>
                  <CustomTextInput
                    label="Body part"
                    placeholder="e.g. left knee"
                    value={editPainBodyPart}
                    onChangeText={setEditPainBodyPart}
                    autoCapitalize="words"
                  />

                  <View style={styles.editSliderBlock}>
                    <View style={styles.editSliderRow}>
                      <Text variant="bodyMedium" style={[styles.sectionBody, { color: colors.textMuted }]}>
                        Pain level
                      </Text>
                      <View
                        style={[
                          styles.painLevelBadge,
                          { backgroundColor: colors.surfaceContainerLow, borderColor: colors.ghostBorder },
                        ]}
                      >
                        <Text variant="titleMedium" style={[styles.painLevelText, { color: colors.chartTrigger }]}>
                          {editPainLevel}
                        </Text>
                      </View>
                    </View>

                    <Slider
                      style={styles.slider}
                      minimumValue={1}
                      maximumValue={5}
                      step={1}
                      value={editPainLevel}
                      onValueChange={(value) => setEditPainLevel(value)}
                      minimumTrackTintColor={colors.chartTrigger}
                      maximumTrackTintColor={colors.surfaceContainerHighest}
                      thumbTintColor={colors.chartTrigger}
                    />
                  </View>

                  <View style={styles.swellingRow}>
                    <Text variant="bodyMedium" style={styles.swellingLabel}>
                      Swelling Present?
                    </Text>
                    <Switch value={editPainSwelling} onValueChange={setEditPainSwelling} color={colors.primary} />
                  </View>
                </>
              )}

              {editingEntry?.payload.kind === 'stress' && (
                <SegmentedButtons
                  value={editStressLevel}
                  onValueChange={(value) => {
                    if (value === 'none' || value === 'low' || value === 'moderate' || value === 'high') {
                      setEditStressLevel(value);
                    }
                  }}
                  density="small"
                  style={styles.segmentedRoot}
                  buttons={[
                    { value: 'none', label: 'None', showSelectedCheck: false, style: styles.segmentedButton },
                    { value: 'low', label: 'Low', showSelectedCheck: false, style: styles.segmentedButton },
                    { value: 'moderate', label: 'Moderate', showSelectedCheck: false, style: styles.segmentedButton },
                    { value: 'high', label: 'High', showSelectedCheck: false, style: styles.segmentedButton },
                  ]}
                  theme={{
                    colors: {
                      secondaryContainer: colors.primaryContainer,
                      onSecondaryContainer: colors.onPrimaryContainer,
                      outline: colors.ghostBorder,
                    },
                  }}
                />
              )}

              {(editingEntry?.payload.kind === 'medicine' || editingEntry?.payload.kind === 'food') && (
                <View
                  style={[
                    styles.selectionEditCard,
                    { backgroundColor: colors.surfaceContainerLow, borderColor: colors.ghostBorder },
                  ]}
                >
                  <Text variant="bodyMedium" style={[styles.sectionBody, { color: colors.textMuted }]}>
                    Current item
                  </Text>
                  <View
                    style={[
                      styles.selectedItemRow,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.ghostBorder },
                    ]}
                  >
                    <Text variant="bodyMedium" style={[styles.selectedItemText, { color: colors.text }]}>
                      {editSelectedItem?.name ?? editingEntry.title}
                    </Text>
                  </View>

                  <CustomButton
                    mode="outlined"
                    icon="swap-horizontal"
                    onPress={() => openEditItemSelector(editingEntry.payload.kind === 'medicine' ? 'medicine' : 'food')}
                  >
                    Change item
                  </CustomButton>
                </View>
              )}

              <View style={styles.modalActions}>
                <CustomButton mode="outlined" onPress={closeEditor} style={styles.modalActionButton}>
                  Cancel
                </CustomButton>
                <CustomButton
                  mode="contained"
                  onPress={handleSaveEdit}
                  isLoading={isSavingEdit}
                  buttonColor={colors.primary}
                  textColor={colors.onPrimary}
                  style={styles.modalActionButton}
                >
                  Save
                </CustomButton>
              </View>
            </AppCard>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={pendingDeleteEntry !== null} transparent animationType="fade" onRequestClose={closeDeleteConfirm}>
        <View style={styles.modalContainer}>
          <Pressable
            style={[styles.modalBackdrop, { backgroundColor: deleteModalScrimColor, opacity: 0.66 }]}
            onPress={isDeletingEntry ? undefined : closeDeleteConfirm}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <AppCard variant="solid" style={[styles.modalCard, styles.deleteModalCard]}>
              <View style={styles.deleteModalTopRow}>
                <View style={styles.deleteModalHeadingBlock}>
                  <View style={[styles.deleteModalIconWrap, { backgroundColor: colors.errorContainer }]}> 
                    <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.onErrorContainer} />
                  </View>
                  <Text variant="titleMedium" style={[styles.deleteModalTitle, { color: colors.text }]} numberOfLines={1}>
                    Confirm Delete
                  </Text>
                </View>
                <IconButton
                  icon="close"
                  iconColor={colors.text}
                  size={24}
                  onPress={closeDeleteConfirm}
                  disabled={isDeletingEntry}
                  style={styles.deleteModalCloseButton}
                />
              </View>

              <View
                style={[
                  styles.deleteModalSummaryCard,
                  { backgroundColor: colors.surfaceContainerLow, borderColor: colors.ghostBorder },
                ]}
              >
                <View style={styles.deleteModalSummaryTop}>
                  <View
                    style={[
                      styles.deleteModalTypeIcon,
                      { backgroundColor: pendingDeleteConfig?.container ?? colors.surfaceContainerHighest },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={pendingDeleteConfig?.icon ?? 'clipboard-text-outline'}
                      size={18}
                      color={pendingDeleteConfig?.iconColor ?? colors.textMuted}
                    />
                  </View>

                  <View style={styles.deleteModalSummaryCopy}>
                      <Text variant="titleMedium" style={[styles.deleteModalTitle, { color: colors.text }]} numberOfLines={2}>
                        {pendingDeleteEntry?.title ?? 'Entry'}
                      </Text>
                      {pendingDeleteEntry ? (
                        <Text variant="bodySmall" style={{ color: colors.textMuted }} numberOfLines={2}>
                          {pendingDeleteEntry.subtitle}
                        </Text>
                        
                      ) : null}
                  </View>
                  <Chip
                    compact
                    style={[
                      styles.deleteModalTypeChip,
                      { backgroundColor: pendingDeleteConfig?.container ?? colors.surfaceContainerHighest },
                    ]}
                    textStyle={{ color: pendingDeleteConfig?.iconColor ?? colors.text }}
                  >
                    {pendingDeleteEntry ? titleCase(pendingDeleteEntry.type) : 'Entry'}
                  </Chip>
                </View>
              </View>

              <View style={[styles.modalActions, styles.deleteModalActions]}>
                <CustomButton mode="outlined" onPress={closeDeleteConfirm} style={styles.modalActionButton} disabled={isDeletingEntry}>
                  Cancel
                </CustomButton>
                <CustomButton
                  mode="contained"
                  onPress={() => void handleConfirmDelete()}
                  isLoading={isDeletingEntry}
                  buttonColor={colors.error}
                  textColor={colors.onError}
                  style={styles.modalActionButton}
                >
                  Delete
                </CustomButton>
              </View>
            </AppCard>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ItemSelector
        type={editSelectorType}
        visible={editSelectorVisible}
        onClose={() => setEditSelectorVisible(false)}
        onSelect={(id, displayName) => {
          setEditSelectedItem({ id, name: displayName });
        }}
      />

      <AppSnackbar
        visible={undoVisible && deletedEntry !== null}
        onDismiss={() => {
          setUndoVisible(false);
          setDeletedEntry(null);
        }}
        duration={5000}
        action={{ label: 'Undo', onPress: () => void handleUndoDelete() }}
      >
        Entry deleted.
      </AppSnackbar>

      <AppSnackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </AppSnackbar>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  filterBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 10,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 75,
    gap: 8,
  },
  headerStack: {
    gap: Spacing.lg,
  },
  headerBlock: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  loadingCard: {
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
  },
  summaryCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metricCard: {
    width: '48%',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  filterChip: {
    borderWidth: 1,
  },
  sectionHeader: {
    minHeight: 48,
    justifyContent: 'center',
    zIndex: 1,
  },
  sectionHeaderCard: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
    shadowOpacity: 0.09,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeaderTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 0,
  },
  sectionHeaderTitle: {
    flexShrink: 1,
    fontWeight: '700',
  },
  sectionHeaderCountPill: {
    minHeight: 28,
    borderRadius: Radius.full,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  sectionHeaderCountText: {
    fontWeight: '700',
  },
  entryCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: Spacing.md,
    gap: Spacing.sm,
    shadowOpacity: 0.11,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  motionCardWrap: {
    marginBottom: Spacing.xxs,
    gap: Spacing.xs,
  },
  entryPressable: {
    minHeight: 74,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  entryLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryTextBlock: {
    flex: 1,
    gap: Spacing.xxs,
  },
  entryChip: {
    alignSelf: 'flex-start',
  },
  entryHeaderRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  expandIndicator: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionDrawer: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  drawerActionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  drawerActionLabel: {
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'center',
  },
  modalCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  deleteModalCard: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  deleteModalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  deleteModalCloseButton: {
    margin: 0,
  },
  deleteModalHeadingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  deleteModalEyebrow: {
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  deleteModalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalSummaryCard: {
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  deleteModalSummaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  deleteModalTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalSummaryCopy: {
    flex: 1,
    gap: Spacing.xxs,
  },
  deleteModalTitle: {
    fontWeight: '700',
  },
  deleteModalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  deleteModalTypeChip: {
    borderWidth: 1,
  },
  deleteModalWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  deleteModalWarningText: {
    flex: 1,
  },
  deleteModalActions: {
    marginTop: Spacing.xs,
  },
  cardTitle: {
    fontWeight: '700',
    flexShrink: 1,
  },
  editSliderBlock: {
    gap: Spacing.sm,
  },
  editSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  sectionBody: {
    flexShrink: 1,
  },
  painLevelBadge: {
    minWidth: Spacing.xxxl,
    minHeight: Spacing.xxxl,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
  },
  painLevelText: {
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  swellingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  swellingLabel: {
    flexShrink: 1,
  },
  segmentedRoot: {
    marginTop: Spacing.xs,
  },
  segmentedButton: {
    flex: 1,
  },
  selectionEditCard: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  selectedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  selectedItemText: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalActionButton: {
    flex: 1,
  },
  emptyCard: {
    padding: Spacing.xl,
    marginTop: Spacing.sm,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButton: {
    width: '100%',
    marginTop: Spacing.xs,
  },
});
