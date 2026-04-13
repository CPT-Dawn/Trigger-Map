import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
} from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { ActivityIndicator, Chip, IconButton, SegmentedButtons, Switch, Text } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabase';
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
}

interface FoodLogRow {
  id: string;
  logged_at: string;
  log_date: string;
  food_id: string;
}

interface UserItemRow {
  id: string;
  display_name: string | null;
  name: string | null;
  quantity: number | null;
  unit: string | null;
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
  return new Date(dateString).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function titleCase(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPainEntryTitle(row: PainLogRow) {
  const bodyPart = row.body_part?.trim() || 'Pain entry';
  const painLevel = row.pain_level;

  return painLevel !== null && painLevel !== undefined ? `${bodyPart} · Pain ${painLevel}` : bodyPart;
}

function formatPainEntrySubtitle(row: PainLogRow) {
  const pieces: string[] = [`Logged at ${formatTime(row.logged_at)}`];

  if (row.swelling) {
    pieces.push('Swelling present');
  }

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
    return `Stress level ${value}`;
  }

  if (typeof value === 'string') {
    return `Stress: ${formatStressLabel(value)}`;
  }

  return 'Stress';
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

const swipeActionWidth = 112;
const swipeThreshold = 72;
const swipeActivationDistance = 8;
const listReveal = (delay: number) => FadeInDown.delay(delay).duration(300);

function buildDisplayName(item?: UserItemRow | null) {
  if (!item) {
    return 'Unknown item';
  }

  if (item.display_name && item.display_name.trim().length > 0) {
    return item.display_name;
  }

  const pieces = [item.name?.trim(), item.quantity !== null ? String(item.quantity) : null, item.unit?.trim()]
    .filter((piece): piece is string => !!piece);

  return pieces.length > 0 ? pieces.join(' ') : 'Unknown item';
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

interface SwipeableLogCardProps {
  entry: TimelineEntry;
  config: {
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    container: string;
    iconColor: string;
  };
  colors: ReturnType<typeof useAppColors>;
  isActive: boolean;
  onActivate: (entryId: string) => void;
  onEdit: (entry: TimelineEntry) => void;
  onDelete: (entry: TimelineEntry) => void;
}

function SwipeableLogCard({ entry, config, colors, isActive, onActivate, onEdit, onDelete }: SwipeableLogCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateXValue = useRef(0);
  const startX = useRef(0);

  const snapTo = (value: number, options?: { onComplete?: () => void; immediate?: boolean }) => {
    translateXValue.current = value;

    if (options?.immediate && options.onComplete) {
      options.onComplete();
    }

    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: true,
      friction: 13,
      tension: 230,
    }).start(({ finished }) => {
      if (finished && !options?.immediate && options?.onComplete) {
        options.onComplete();
      }
    });
  };

  useEffect(() => {
    if (!isActive) {
      snapTo(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const handleOpenEdit = () => {
    snapTo(swipeActionWidth, { onComplete: () => onEdit(entry), immediate: true });
  };

  const handleOpenDelete = () => {
    snapTo(-swipeActionWidth, { onComplete: () => onDelete(entry), immediate: true });
  };

  const editOpacity = translateX.interpolate({
    inputRange: [0, swipeActivationDistance, swipeActionWidth * 0.45, swipeActionWidth],
    outputRange: [0, 0.48, 0.86, 1],
    extrapolate: 'clamp',
  });

  const deleteOpacity = translateX.interpolate({
    inputRange: [-swipeActionWidth, -swipeActionWidth * 0.45, -swipeActivationDistance, 0],
    outputRange: [1, 0.86, 0.48, 0],
    extrapolate: 'clamp',
  });

  const editScale = translateX.interpolate({
    inputRange: [0, swipeActionWidth],
    outputRange: [0.95, 1],
    extrapolate: 'clamp',
  });

  const deleteScale = translateX.interpolate({
    inputRange: [-swipeActionWidth, 0],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });

  const editTranslate = translateX.interpolate({
    inputRange: [0, swipeActionWidth],
    outputRange: [10, 0],
    extrapolate: 'clamp',
  });

  const deleteTranslate = translateX.interpolate({
    inputRange: [-swipeActionWidth, 0],
    outputRange: [0, 10],
    extrapolate: 'clamp',
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderGrant: () => {
          translateX.stopAnimation((currentX) => {
            translateXValue.current = currentX;
            startX.current = currentX;
          });
          onActivate(entry.id);
        },
        onPanResponderMove: (_, gestureState) => {
          const nextX = Math.max(-swipeActionWidth, Math.min(swipeActionWidth, startX.current + gestureState.dx));
          translateXValue.current = nextX;
          translateX.setValue(nextX);
        },
        onPanResponderRelease: (_, gestureState) => {
          const projectedX = Math.max(
            -swipeActionWidth,
            Math.min(swipeActionWidth, startX.current + gestureState.dx + gestureState.vx * 24),
          );

          if (projectedX >= swipeThreshold) {
            handleOpenEdit();
            return;
          }

          if (projectedX <= -swipeThreshold) {
            handleOpenDelete();
            return;
          }

          snapTo(0);
        },
        onPanResponderTerminate: () => {
          snapTo(0);
        },
      }),
    [entry.id, onActivate, onDelete, onEdit, translateX],
  );

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeUnderlay} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
            onPress={handleOpenEdit}
            style={styles.swipeActionLeft}
        >
          <Animated.View
            style={[
              styles.swipeActionContent,
              {
                opacity: editOpacity,
                transform: [{ translateX: editTranslate }, { scale: editScale }],
                backgroundColor: colors.primaryContainer,
              },
            ]}
          >
            <View style={[styles.swipeActionIconWrap, { backgroundColor: colors.primaryContainer }]}> 
              <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.onPrimaryContainer} />
            </View>
            <Text variant="labelLarge" style={[styles.swipeActionLabel, { color: colors.onPrimaryContainer }]}> 
              Edit
            </Text>
          </Animated.View>
        </Pressable>

        <View style={styles.swipeSpacer} />

        <Pressable
          accessibilityRole="button"
          onPress={handleOpenDelete}
          style={styles.swipeActionRight}
        >
          <Animated.View
            style={[
              styles.swipeActionContent,
              {
                opacity: deleteOpacity,
                transform: [{ translateX: deleteTranslate }, { scale: deleteScale }],
                backgroundColor: colors.errorContainer,
              },
            ]}
          >
            <View style={[styles.swipeActionIconWrap, { backgroundColor: colors.errorContainer }]}> 
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.onErrorContainer} />
            </View>
            <Text variant="labelLarge" style={[styles.swipeActionLabel, { color: colors.onErrorContainer }]}> 
              Delete
            </Text>
          </Animated.View>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.entryCard,
          styles.swipeCard,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.ghostBorder,
            shadowColor: colors.shadowAmbient,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
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
              <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                {entry.subtitle}
              </Text>
            </View>
          </View>

          <Chip
            compact
            style={[styles.entryChip, { backgroundColor: config.container }]}
            textStyle={{ color: config.iconColor }}
          >
            {config.label}
          </Chip>
        </View>

        <View style={styles.entryFooter}>
          <Text variant="labelSmall" style={{ color: colors.textMuted }}>
            {formatTime(entry.loggedAt)}
          </Text>
          <Text variant="labelSmall" style={{ color: colors.textMuted }}>
            {formatSectionTitle(entry.logDate)}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function LogsScreen() {
  const colors = useAppColors();
  const { user } = useAuth();
  const router = useRouter();
  const isFocused = useIsFocused();

  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<LogFilter>('all');
  const [activeSwipeKey, setActiveSwipeKey] = useState<string | null>(null);
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
    setActiveSwipeKey(null);
  };

  const openEditor = (entry: TimelineEntry) => {
    setActiveSwipeKey(entry.id);
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
    setActiveSwipeKey(entry.id);
  };

  const closeDeleteConfirm = () => {
    setPendingDeleteEntry(null);
    setIsDeletingEntry(false);
    setActiveSwipeKey(null);
  };

  const insertPayloadRow = async (entry: TimelineEntry) => {
    if (!user) {
      throw new Error('You must be logged in to restore entries.');
    }

    if (entry.payload.kind === 'pain') {
      const { error } = await supabase.from('pain_logs').insert({
        user_id: user.id,
        logged_at: entry.loggedAt,
        log_date: entry.logDate,
        body_part: entry.payload.row.body_part,
        pain_level: entry.payload.row.pain_level,
        swelling: entry.payload.row.swelling,
      });

      if (error) {
        throw error;
      }
      return;
    }

    if (entry.payload.kind === 'stress') {
      const { error } = await supabase.from('stress_logs').insert({
        user_id: user.id,
        logged_at: entry.loggedAt,
        log_date: entry.logDate,
        level: entry.payload.row.level,
      });

      if (error) {
        throw error;
      }
      return;
    }

    if (entry.payload.kind === 'medicine') {
      const { error } = await supabase.from('medicine_logs').insert({
        user_id: user.id,
        medicine_id: entry.payload.row.medicine_id,
        logged_at: entry.loggedAt,
        log_date: entry.logDate,
      });

      if (error) {
        throw error;
      }
      return;
    }

    const { error } = await supabase.from('food_logs').insert({
      user_id: user.id,
      food_id: entry.payload.row.food_id,
      logged_at: entry.loggedAt,
      log_date: entry.logDate,
    });

    if (error) {
      throw error;
    }
  };

  const deleteLogEntry = async (entry: TimelineEntry) => {
    if (!user) {
      showError('You must be logged in to manage logs.');
      throw new Error('Missing authenticated user.');
    }

    try {
      if (entry.payload.kind === 'pain') {
        const { error } = await supabase.from('pain_logs').delete().eq('id', entry.payload.row.id).eq('user_id', user.id);

        if (error) throw error;
      } else if (entry.payload.kind === 'stress') {
        const { error } = await supabase.from('stress_logs').delete().eq('id', entry.payload.row.id).eq('user_id', user.id);

        if (error) throw error;
      } else if (entry.payload.kind === 'medicine') {
        const { error } = await supabase.from('medicine_logs').delete().eq('id', entry.payload.row.id).eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('food_logs').delete().eq('id', entry.payload.row.id).eq('user_id', user.id);

        if (error) throw error;
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

        const { error } = await supabase
          .from('pain_logs')
          .update({
            body_part: editPainBodyPart.trim(),
            pain_level: editPainLevel,
            swelling: editPainSwelling,
          })
          .eq('id', editingEntry.payload.row.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else if (editingEntry.payload.kind === 'stress') {
        const { error } = await supabase
          .from('stress_logs')
          .update({ level: editStressLevel })
          .eq('id', editingEntry.payload.row.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else if (editingEntry.payload.kind === 'medicine') {
        if (!editSelectedItem) {
          showError('Select a medicine before saving.');
          return;
        }

        const { error } = await supabase
          .from('medicine_logs')
          .update({ medicine_id: editSelectedItem.id })
          .eq('id', editingEntry.payload.row.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        if (!editSelectedItem) {
          showError('Select a food item before saving.');
          return;
        }

        const { error } = await supabase
          .from('food_logs')
          .update({ food_id: editSelectedItem.id })
          .eq('id', editingEntry.payload.row.id)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      closeEditor();
      await loadLogs('refresh');
    } catch (error: any) {
      showError(error?.message || 'Unable to save your changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const loadLogs = async (mode: 'initial' | 'refresh' = 'refresh') => {
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
      const [painResult, stressResult, medicineResult, foodResult, medicineItemsResult, foodItemsResult] =
        await Promise.all([
          supabase
            .from('pain_logs')
            .select('id, logged_at, log_date, body_part, pain_level, swelling')
            .eq('user_id', user.id)
            .order('logged_at', { ascending: false }),
          supabase
            .from('stress_logs')
            .select('id, logged_at, log_date, level')
            .eq('user_id', user.id)
            .order('logged_at', { ascending: false }),
          supabase
            .from('medicine_logs')
            .select('id, logged_at, log_date, medicine_id')
            .eq('user_id', user.id)
            .order('logged_at', { ascending: false }),
          supabase
            .from('food_logs')
            .select('id, logged_at, log_date, food_id')
            .eq('user_id', user.id)
            .order('logged_at', { ascending: false }),
          supabase
            .from('user_medicines')
            .select('id, display_name, name, quantity, unit')
            .eq('user_id', user.id),
          supabase
            .from('user_foods')
            .select('id, display_name, name, quantity, unit')
            .eq('user_id', user.id),
        ]);

      const firstError =
        painResult.error ||
        stressResult.error ||
        medicineResult.error ||
        foodResult.error ||
        medicineItemsResult.error ||
        foodItemsResult.error;

      if (firstError) {
        throw firstError;
      }

      const medicineItems = new Map<string, UserItemRow>(
        (medicineItemsResult.data ?? []).map((item) => [item.id, item]),
      );
      const foodItems = new Map<string, UserItemRow>(
        (foodItemsResult.data ?? []).map((item) => [item.id, item]),
      );

      const painEntries: TimelineEntry[] = (painResult.data ?? []).map((row: PainLogRow) => ({
        id: `pain-${row.id}`,
        type: 'pain',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        title: formatPainEntryTitle(row),
        subtitle: formatPainEntrySubtitle(row),
        payload: { kind: 'pain', row },
      }));

      const stressEntries: TimelineEntry[] = (stressResult.data ?? []).map((row: StressLogRow) => ({
        id: `stress-${row.id}`,
        type: 'stress',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        title: formatStressEntryTitle(row.level),
        subtitle: `Logged at ${formatTime(row.logged_at)}`,
        payload: { kind: 'stress', row },
      }));

      const medicineEntries: TimelineEntry[] = (medicineResult.data ?? []).map((row: MedicineLogRow) => ({
        id: `medicine-${row.id}`,
        type: 'medicine',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        title: buildDisplayName(medicineItems.get(row.medicine_id)),
        subtitle: `Logged at ${formatTime(row.logged_at)}`,
        payload: { kind: 'medicine', row, item: medicineItems.get(row.medicine_id) ?? null },
      }));

      const foodEntries: TimelineEntry[] = (foodResult.data ?? []).map((row: FoodLogRow) => ({
        id: `food-${row.id}`,
        type: 'food',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        title: buildDisplayName(foodItems.get(row.food_id)),
        subtitle: `Logged at ${formatTime(row.logged_at)}`,
        payload: { kind: 'food', row, item: foodItems.get(row.food_id) ?? null },
      }));

      const allEntries = [...painEntries, ...stressEntries, ...medicineEntries, ...foodEntries].sort(
        (left, right) => new Date(right.loggedAt).getTime() - new Date(left.loggedAt).getTime(),
      );

      setEntries(allEntries);
    } catch (error: any) {
      showError(error?.message || 'Unable to load logs from Supabase.');
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

  const visibleEntries = entries.filter((entry) => filter === 'all' || entry.type === filter);
  const visibleSections = groupEntriesByDate(visibleEntries);

  const typeConfig: Record<LogType, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; container: string; iconColor: string }> = {
    pain: {
      label: 'Pain',
      icon: 'thermometer-lines',
      container: colors.tertiaryContainer,
      iconColor: colors.onTertiaryContainer,
    },
    stress: {
      label: 'Stress',
      icon: 'brain',
      container: colors.secondaryContainer,
      iconColor: colors.onSecondaryContainer,
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
      container: colors.surfaceContainerHighest,
      iconColor: colors.text,
    },
  };

  const pendingDeleteConfig = pendingDeleteEntry ? typeConfig[pendingDeleteEntry.type] : null;

  const filterOptions: Array<{ value: LogFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
    { value: 'all', label: 'All', icon: 'timeline-text' },
    { value: 'food', label: 'Food', icon: 'food-apple' },
    { value: 'pain', label: 'Pain', icon: 'thermometer-lines' },
    { value: 'medicine', label: 'Medicine', icon: 'pill' },
    { value: 'stress', label: 'Stress', icon: 'brain' },
  ];

  const renderEntry = ({ item }: { item: TimelineEntry }) => {
    const config = typeConfig[item.type];

    return (
      <SwipeableLogCard
        entry={item}
        config={config}
        colors={colors}
        isActive={activeSwipeKey === item.id}
        onActivate={setActiveSwipeKey}
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
                Loading logs from Supabase...
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

            return (
              <Chip
                key={option.value}
                icon={option.icon}
                selected={selected}
                onPress={() => setFilter(option.value)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected ? colors.primaryContainer : colors.surfaceContainerLow,
                    borderColor: selected ? colors.primaryContainer : colors.ghostBorder,
                  },
                ]}
                textStyle={{ color: selected ? colors.onPrimaryContainer : colors.textMuted }}
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
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={{ color: colors.text }}>
                {section.title}
              </Text>
              <Text variant="labelMedium" style={{ color: colors.textMuted }}>
                {section.data.length} {section.data.length === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
          )}
          ListHeaderComponent={renderListHeader()}
          ListEmptyComponent={renderEmptyState()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadLogs('refresh')}
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
            style={[styles.modalBackdrop, { backgroundColor: colors.text, opacity: 0.45 }]}
            onPress={isDeletingEntry ? undefined : closeDeleteConfirm}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <AppCard style={styles.modalCard}>
              <View style={styles.deleteModalHeader}>
                <View style={styles.deleteModalHeaderLeft}>
                  <View style={[styles.deleteModalIconWrap, { backgroundColor: colors.errorContainer }]}>
                    <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.onErrorContainer} />
                  </View>
                  <View style={styles.deleteModalHeaderText}>
                    <Text variant="titleLarge" style={[styles.cardTitle, { color: colors.text }]}> 
                      Delete
                    </Text>
                  </View>
                </View>
                <IconButton icon="close" iconColor={colors.text} size={24} onPress={closeDeleteConfirm} disabled={isDeletingEntry} />
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
                    <Text variant="labelMedium" style={{ color: colors.textMuted }}>
                      Entry to delete
                    </Text>
                    <Text variant="titleMedium" style={{ color: colors.text }} numberOfLines={2}>
                      {pendingDeleteEntry?.title ?? 'Entry'}
                    </Text>
                  </View>
                </View>

                <View style={styles.deleteModalMetaRow}>
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
                  <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                    {pendingDeleteEntry
                      ? `${formatSectionTitle(pendingDeleteEntry.logDate)} · ${formatTime(pendingDeleteEntry.loggedAt)}`
                      : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.modalActions}>
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
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 10,
    paddingBottom: 75,
    gap: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  entryCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  swipeContainer: {
    marginBottom: Spacing.sm,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  swipeUnderlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  swipeActionLeft: {
    width: swipeActionWidth,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  swipeActionRight: {
    width: swipeActionWidth,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  swipeSpacer: {
    flex: 1,
  },
  swipeActionContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    overflow: 'hidden',
  },
  swipeActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeActionLabel: {
    fontWeight: '700',
    textAlign: 'center',
  },
  swipeActionHint: {
    textAlign: 'center',
    opacity: 0.88,
  },
  swipeCard: {
    marginBottom: 0,
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
  entryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 56,
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
  deleteModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  deleteModalHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  deleteModalHeaderText: {
    flex: 1,
    gap: Spacing.xxs,
  },
  deleteModalSubtitle: {
    lineHeight: 18,
  },
  deleteModalIconWrap: {
    width: 48,
    height: 48,
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
    alignItems: 'center',
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
