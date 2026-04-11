import React, { useEffect, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View, ScrollView } from 'react-native';
import { ActivityIndicator, Chip, Snackbar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabase';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';
import { CustomButton } from '../../components/ui/CustomButton';

type LogFilter = 'all' | 'pain' | 'stress' | 'medicine' | 'food';
type LogType = Exclude<LogFilter, 'all'>;

interface PainLogRow {
  id: string;
  logged_at: string;
  log_date: string;
  level: number;
}

interface StressLogRow {
  id: string;
  logged_at: string;
  log_date: string;
  level: number;
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

export default function LogsScreen() {
  const colors = useAppColors();
  const { user } = useAuth();
  const router = useRouter();
  const isFocused = useIsFocused();

  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<LogFilter>('all');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const showError = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
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
            .select('id, logged_at, log_date, level')
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
        title: `Pain level ${row.level}`,
        subtitle: `Logged at ${formatTime(row.logged_at)}`,
      }));

      const stressEntries: TimelineEntry[] = (stressResult.data ?? []).map((row: StressLogRow) => ({
        id: `stress-${row.id}`,
        type: 'stress',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        title: `Stress level ${row.level}`,
        subtitle: `Logged at ${formatTime(row.logged_at)}`,
      }));

      const medicineEntries: TimelineEntry[] = (medicineResult.data ?? []).map((row: MedicineLogRow) => ({
        id: `medicine-${row.id}`,
        type: 'medicine',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        title: buildDisplayName(medicineItems.get(row.medicine_id)),
        subtitle: `Logged at ${formatTime(row.logged_at)}`,
      }));

      const foodEntries: TimelineEntry[] = (foodResult.data ?? []).map((row: FoodLogRow) => ({
        id: `food-${row.id}`,
        type: 'food',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        title: buildDisplayName(foodItems.get(row.food_id)),
        subtitle: `Logged at ${formatTime(row.logged_at)}`,
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

  const today = new Date();
  const visibleTodayCount = visibleEntries.filter((entry) => isSameLocalDay(parseLocalDate(entry.logDate), today)).length;
  const visibleSymptomsCount = visibleEntries.filter((entry) => entry.type === 'pain' || entry.type === 'stress').length;
  const visibleContextCount = visibleEntries.filter((entry) => entry.type === 'medicine' || entry.type === 'food').length;

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

  const filterOptions: Array<{ value: LogFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
    { value: 'all', label: 'All', icon: 'timeline-text' },
    { value: 'pain', label: 'Pain', icon: 'thermometer-lines' },
    { value: 'stress', label: 'Stress', icon: 'brain' },
    { value: 'medicine', label: 'Medicine', icon: 'pill' },
    { value: 'food', label: 'Food', icon: 'food-apple' },
  ];

  const renderEntry = ({ item }: { item: TimelineEntry }) => {
    const config = typeConfig[item.type];

    return (
      <View style={[styles.entryCard, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
        <View style={styles.entryTopRow}>
          <View style={styles.entryLeading}>
            <View style={[styles.iconWrap, { backgroundColor: config.container }]}> 
              <MaterialCommunityIcons name={config.icon} size={20} color={config.iconColor} />
            </View>
            <View style={styles.entryTextBlock}>
              <Text variant="titleMedium" style={{ color: colors.text }}>
                {item.title}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                {item.subtitle}
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
            {formatTime(item.loggedAt)}
          </Text>
          <Text variant="labelSmall" style={{ color: colors.textMuted }}>
            {formatSectionTitle(item.logDate)}
          </Text>
        </View>
      </View>
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

          <View style={[styles.loadingCard, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
            <ActivityIndicator color={colors.primary} />
            <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
              Loading logs from Supabase...
            </Text>
          </View>
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
      <View style={[styles.emptyCard, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
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
        <CustomButton mode="contained" onPress={() => router.push('/add-log')} style={styles.emptyButton}>
          Add Entry
        </CustomButton>
      </View>
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

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ backgroundColor: colors.surfaceContainerHighest }}
        theme={{ colors: { onSurface: colors.text } }}
      >
        {snackbarMessage}
      </Snackbar>
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
    paddingTop: Spacing.sm,
    paddingBottom: 75,
    gap: Spacing.md,
  },
  headerStack: {
    gap: Spacing.lg,
  },
  headerBlock: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  loadingCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
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
  emptyCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
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
