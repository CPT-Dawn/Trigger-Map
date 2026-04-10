import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Chip, ProgressBar, Snackbar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused, useRouter } from 'expo-router';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabase';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';
import { CustomButton } from '../../components/ui/CustomButton';

type LogType = 'pain' | 'stress' | 'medicine' | 'food';

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

interface DailyContextRow {
  id: string;
  date: string;
  weather_data: unknown;
  day_rating: number | null;
}

interface DashboardEntry {
  id: string;
  type: LogType;
  logDate: string;
  loggedAt: string;
  level?: number;
  title: string;
  subtitle: string;
}

interface TriggerSuggestion {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const NO_WEATHER_CONTEXT = 'No weather context saved yet.';

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(date: Date, offsetDays: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + offsetDays);
  return nextDate;
}

function formatTime(loggedAt: string) {
  return new Date(loggedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSectionLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = shiftDate(today, -1);

  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  if (sameDay(date, today)) {
    return 'Today';
  }

  if (sameDay(date, yesterday)) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatAverage(value: number | null) {
  return value === null || Number.isNaN(value) ? '--' : value.toFixed(1);
}

function formatDayRating(value: number | null) {
  return value === null || Number.isNaN(value) ? '--' : value.toFixed(1);
}

function readStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function summarizeWeather(weatherData: unknown) {
  if (typeof weatherData === 'string') {
    const trimmed = weatherData.trim();

    if (!trimmed) {
      return NO_WEATHER_CONTEXT;
    }

    try {
      return summarizeWeather(JSON.parse(trimmed) as unknown);
    } catch {
      return trimmed;
    }
  }

  if (!weatherData || typeof weatherData !== 'object') {
    return NO_WEATHER_CONTEXT;
  }

  const data = weatherData as Record<string, unknown>;
  const condition =
    readStringValue(data.condition) ??
    readStringValue(data.summary) ??
    readStringValue(data.description) ??
    readStringValue(data.weather) ??
    readStringValue(data.main_condition);
  const temperature =
    readNumberValue(data.temperature) ??
    readNumberValue(data.temp) ??
    readNumberValue(data.current_temperature);
  const humidity = readNumberValue(data.humidity);
  const wind = readNumberValue(data.wind_speed) ?? readNumberValue(data.wind);

  const pieces = [condition, temperature !== null ? `${Math.round(temperature)}°` : null, humidity !== null ? `Humidity ${Math.round(humidity)}%` : null, wind !== null ? `Wind ${Math.round(wind)} km/h` : null].filter((piece): piece is string => !!piece);

  return pieces.length > 0 ? pieces.join(' • ') : NO_WEATHER_CONTEXT;
}

function hasWeatherSignal(weatherSummary: string) {
  return /rain|storm|snow|humid|humidity|wind|pressure|cold|heat|cloud|drizzle/i.test(weatherSummary);
}

function buildDisplayName(item?: UserItemRow | null) {
  if (!item) {
    return 'Unknown item';
  }

  if (item.display_name && item.display_name.trim().length > 0) {
    return item.display_name;
  }

  const pieces = [item.name?.trim(), item.quantity !== null ? String(item.quantity) : null, item.unit?.trim()].filter(
    (piece): piece is string => !!piece,
  );

  return pieces.length > 0 ? pieces.join(' ') : 'Unknown item';
}

export default function HomeScreen() {
  const colors = useAppColors();
  const { user } = useAuth();
  const router = useRouter();
  const isFocused = useIsFocused();

  const [entries, setEntries] = useState<DashboardEntry[]>([]);
  const [dailyContexts, setDailyContexts] = useState<DailyContextRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const showError = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const loadDashboard = async (mode: 'initial' | 'refresh' = 'refresh') => {
    if (!user) {
      setEntries([]);
      setDailyContexts([]);
      setLoading(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
      return;
    }

    const today = new Date();
    const todayKey = formatDateKey(today);
    const weekStartKey = formatDateKey(shiftDate(today, -6));

    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [painResult, stressResult, medicineResult, foodResult, medicineItemsResult, foodItemsResult, dailyContextResult] =
        await Promise.all([
          supabase
            .from('pain_logs')
            .select('id, logged_at, log_date, level')
            .eq('user_id', user.id)
            .gte('log_date', weekStartKey)
            .order('logged_at', { ascending: false }),
          supabase
            .from('stress_logs')
            .select('id, logged_at, log_date, level')
            .eq('user_id', user.id)
            .gte('log_date', weekStartKey)
            .order('logged_at', { ascending: false }),
          supabase
            .from('medicine_logs')
            .select('id, logged_at, log_date, medicine_id')
            .eq('user_id', user.id)
            .gte('log_date', weekStartKey)
            .order('logged_at', { ascending: false }),
          supabase
            .from('food_logs')
            .select('id, logged_at, log_date, food_id')
            .eq('user_id', user.id)
            .gte('log_date', weekStartKey)
            .order('logged_at', { ascending: false }),
          supabase
            .from('user_medicines')
            .select('id, display_name, name, quantity, unit')
            .eq('user_id', user.id),
          supabase
            .from('user_foods')
            .select('id, display_name, name, quantity, unit')
            .eq('user_id', user.id),
          supabase
            .from('daily_context')
            .select('id, date, weather_data, day_rating')
            .eq('user_id', user.id)
            .gte('date', weekStartKey)
            .order('date', { ascending: false }),
        ]);

      const firstError =
        painResult.error ||
        stressResult.error ||
        medicineResult.error ||
        foodResult.error ||
        medicineItemsResult.error ||
        foodItemsResult.error ||
        dailyContextResult.error;

      if (firstError) {
        throw firstError;
      }

      const medicineItems = new Map<string, UserItemRow>(
        (medicineItemsResult.data ?? []).map((item) => [item.id, item]),
      );
      const foodItems = new Map<string, UserItemRow>((foodItemsResult.data ?? []).map((item) => [item.id, item]));

      const painEntries: DashboardEntry[] = (painResult.data ?? []).map((row: PainLogRow) => ({
        id: `pain-${row.id}`,
        type: 'pain',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        level: row.level,
        title: `Pain level ${row.level}`,
        subtitle: `${formatSectionLabel(row.log_date)} • ${formatTime(row.logged_at)}`,
      }));

      const stressEntries: DashboardEntry[] = (stressResult.data ?? []).map((row: StressLogRow) => ({
        id: `stress-${row.id}`,
        type: 'stress',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        level: row.level,
        title: `Stress level ${row.level}`,
        subtitle: `${formatSectionLabel(row.log_date)} • ${formatTime(row.logged_at)}`,
      }));

      const medicineEntries: DashboardEntry[] = (medicineResult.data ?? []).map((row: MedicineLogRow) => ({
        id: `medicine-${row.id}`,
        type: 'medicine',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        title: buildDisplayName(medicineItems.get(row.medicine_id)),
        subtitle: `${formatSectionLabel(row.log_date)} • ${formatTime(row.logged_at)}`,
      }));

      const foodEntries: DashboardEntry[] = (foodResult.data ?? []).map((row: FoodLogRow) => ({
        id: `food-${row.id}`,
        type: 'food',
        logDate: row.log_date,
        loggedAt: row.logged_at,
        title: buildDisplayName(foodItems.get(row.food_id)),
        subtitle: `${formatSectionLabel(row.log_date)} • ${formatTime(row.logged_at)}`,
      }));

      const allEntries = [...painEntries, ...stressEntries, ...medicineEntries, ...foodEntries].sort(
        (left, right) => new Date(right.loggedAt).getTime() - new Date(left.loggedAt).getTime(),
      );

      setEntries(allEntries);
      setDailyContexts((dailyContextResult.data ?? []) as DailyContextRow[]);
    } catch (error: any) {
      showError(error?.message || 'Unable to load your dashboard from Supabase.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadDashboard(hasLoadedOnce ? 'refresh' : 'initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, user?.id]);

  const todayKey = formatDateKey(new Date());
  const latestEntry = entries[0] ?? null;
  const todayEntries = entries.filter((entry) => entry.logDate === todayKey);
  const weeklyDatesWithLogs = new Set(entries.map((entry) => entry.logDate));
  const consistencyScore = Math.min(100, Math.round((weeklyDatesWithLogs.size / 7) * 100));

  const todayPainValues = todayEntries.filter((entry) => entry.type === 'pain' && entry.level !== undefined).map((entry) => entry.level as number);
  const todayStressValues = todayEntries.filter((entry) => entry.type === 'stress' && entry.level !== undefined).map((entry) => entry.level as number);
  const weeklyPainValues = entries.filter((entry) => entry.type === 'pain' && entry.level !== undefined).map((entry) => entry.level as number);
  const weeklyStressValues = entries.filter((entry) => entry.type === 'stress' && entry.level !== undefined).map((entry) => entry.level as number);

  const averagePain = todayPainValues.length > 0 ? average(todayPainValues) : average(weeklyPainValues);
  const averageStress = todayStressValues.length > 0 ? average(todayStressValues) : average(weeklyStressValues);

  const currentContext = dailyContexts.find((context) => context.date === todayKey) ?? dailyContexts[0] ?? null;
  const weatherSummary = summarizeWeather(currentContext?.weather_data);
  const contextIsCurrentDay = currentContext?.date === todayKey;
  const contextDayLabel = currentContext ? formatSectionLabel(currentContext.date) : 'No daily context yet';
  const currentDayRating = currentContext?.day_rating ?? null;

  const triggerSuggestions: TriggerSuggestion[] = [];

  if (todayStressValues.length > 0 && (average(todayStressValues) ?? 0) >= 4) {
    triggerSuggestions.push({ label: 'Stress', icon: 'brain' });
  }

  if (todayPainValues.length > 0 && (average(todayPainValues) ?? 0) >= 4) {
    triggerSuggestions.push({ label: 'Pain', icon: 'thermometer-lines' });
  }

  if (todayEntries.some((entry) => entry.type === 'food')) {
    triggerSuggestions.push({ label: 'Food', icon: 'food-apple' });
  }

  if (contextIsCurrentDay && weatherSummary !== NO_WEATHER_CONTEXT && hasWeatherSignal(weatherSummary)) {
    triggerSuggestions.push({ label: 'Weather', icon: 'weather-partly-cloudy' });
  }

  if (triggerSuggestions.length === 0) {
    triggerSuggestions.push({ label: 'No clear trigger', icon: 'shield-check' });
  }

  const recentEntries = entries.slice(0, 4);

  const dashboardStats = [
    {
      label: 'Logs today',
      value: String(todayEntries.length),
      detail: 'All entry types',
      icon: 'timeline-text',
      background: colors.primaryContainer,
      iconColor: colors.onPrimaryContainer,
      textColor: colors.onPrimaryContainer,
    },
    {
      label: 'Avg pain',
      value: formatAverage(averagePain),
      detail: todayPainValues.length > 0 ? 'Today' : '7-day average',
      icon: 'thermometer-lines',
      background: colors.tertiaryContainer,
      iconColor: colors.onTertiaryContainer,
      textColor: colors.onTertiaryContainer,
    },
    {
      label: 'Avg stress',
      value: formatAverage(averageStress),
      detail: todayStressValues.length > 0 ? 'Today' : '7-day average',
      icon: 'brain',
      background: colors.secondaryContainer,
      iconColor: colors.onSecondaryContainer,
      textColor: colors.onSecondaryContainer,
    },
    {
      label: 'Day rating',
      value: formatDayRating(currentDayRating),
      detail: currentContext ? `From ${contextDayLabel.toLowerCase()}` : 'No daily context',
      icon: 'emoticon-happy-outline',
      background: colors.surfaceContainerHighest,
      iconColor: colors.text,
      textColor: colors.text,
    },
  ] as const;

  const renderRecentEntry = (entry: DashboardEntry) => {
    const iconName =
      entry.type === 'pain'
        ? 'thermometer-lines'
        : entry.type === 'stress'
          ? 'brain'
          : entry.type === 'medicine'
            ? 'pill'
            : 'food-apple';

    const iconBackground =
      entry.type === 'pain'
        ? colors.tertiaryContainer
        : entry.type === 'stress'
          ? colors.secondaryContainer
          : entry.type === 'medicine'
            ? colors.primaryContainer
            : colors.surfaceContainerHighest;

    const iconColor =
      entry.type === 'pain'
        ? colors.onTertiaryContainer
        : entry.type === 'stress'
          ? colors.onSecondaryContainer
          : entry.type === 'medicine'
            ? colors.onPrimaryContainer
            : colors.text;

    const typeLabel =
      entry.type === 'pain' ? 'Pain' : entry.type === 'stress' ? 'Stress' : entry.type === 'medicine' ? 'Medicine' : 'Food';

    return (
      <View key={entry.id} style={[styles.recentRow, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
        <View style={styles.recentLeading}>
          <View style={[styles.recentIconWrap, { backgroundColor: iconBackground }]}> 
            <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
          </View>
          <View style={styles.recentTextBlock}>
            <Text variant="titleMedium" style={{ color: colors.text }} numberOfLines={1}>
              {entry.title}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.textMuted }} numberOfLines={1}>
              {entry.subtitle}
            </Text>
          </View>
        </View>

        <Chip compact style={[styles.recentChip, { backgroundColor: iconBackground }]} textStyle={{ color: iconColor }}>
          {typeLabel}
        </Chip>
      </View>
    );
  };

  if (loading && !hasLoadedOnce) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingScreen}>

          <View style={[styles.loadingCard, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
            <ActivityIndicator color={colors.primary} />
            <Text variant="bodyMedium" style={{ color: colors.textMuted, textAlign: 'center' }}>
              Loading your dashboard from Supabase...
            </Text>
          </View>
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

  const hasEntries = entries.length > 0;

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadDashboard('refresh')}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      > 

        <View style={[styles.heroCard, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleBlock}>
              <Text variant="labelLarge" style={{ color: colors.textMuted }}>
                Consistency score
              </Text>
              <Text variant="displaySmall" style={{ color: colors.text, fontWeight: '700' }}>
                {consistencyScore}%
              </Text>
            </View>

            <View style={[styles.heroIconWrap, { backgroundColor: colors.primaryContainer }]}> 
              <MaterialCommunityIcons name="chart-line" size={24} color={colors.onPrimaryContainer} />
            </View>
          </View>

          <ProgressBar progress={consistencyScore / 100} color={colors.primary} style={styles.progress} />

          <Text variant="bodySmall" style={{ color: colors.textMuted }}>
            {hasEntries
              ? `You logged data on ${weeklyDatesWithLogs.size} of the last 7 days. Latest update ${latestEntry ? formatTime(latestEntry.loggedAt) : 'not available yet'}.`
              : 'Start logging pain, stress, food, or medicine to build your snapshot.'}
          </Text>

          <View style={styles.heroActions}>
            <CustomButton mode="contained" onPress={() => router.push('/add-log')} style={styles.heroActionButton}>
              Add Entry
            </CustomButton>
            <CustomButton mode="outlined" onPress={() => router.push('/logs')} style={styles.heroActionButton}>
              View Logs
            </CustomButton>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          {dashboardStats.map((stat) => (
            <View key={stat.label} style={[styles.metricCard, { backgroundColor: stat.background, borderColor: colors.ghostBorder }]}> 
              <View style={styles.metricTopRow}>
                <Text variant="labelMedium" style={{ color: stat.textColor }}>
                  {stat.label}
                </Text>
                <MaterialCommunityIcons name={stat.icon} size={18} color={stat.iconColor} />
              </View>
              <Text variant="headlineMedium" style={{ color: stat.textColor, fontWeight: '700' }}>
                {stat.value}
              </Text>
              <Text variant="bodySmall" style={{ color: stat.textColor, opacity: 0.8 }}>
                {stat.detail}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <MaterialCommunityIcons name="weather-partly-cloudy" size={20} color={colors.text} />
              <Text variant="titleMedium" style={{ color: colors.text }}>
                Daily context
              </Text>
            </View>

            <Chip compact style={[styles.contextChip, { backgroundColor: colors.surfaceContainerLow }]} textStyle={{ color: colors.textMuted }}>
              {contextDayLabel}
            </Chip>
          </View>

          <View style={styles.contextBody}>
            <View style={styles.contextTextBlock}>
              <Text variant="bodyMedium" style={{ color: colors.text }} numberOfLines={2}>
                {weatherSummary}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                {currentContext ? 'Weather and rating loaded from daily_context.' : 'Add a daily context entry to track weather and rating.'}
              </Text>
            </View>

            <View style={[styles.ratingPill, { backgroundColor: colors.primaryContainer }]}> 
              <Text variant="labelMedium" style={{ color: colors.onPrimaryContainer }}>
                Day rating
              </Text>
              <Text variant="headlineMedium" style={{ color: colors.onPrimaryContainer, fontWeight: '700' }}>
                {formatDayRating(currentDayRating)}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <MaterialCommunityIcons name="radiology-box" size={20} color={colors.text} />
              <Text variant="titleMedium" style={{ color: colors.text }}>
                Likely triggers today
              </Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            {triggerSuggestions.map((trigger) => (
              <Chip key={trigger.label} compact icon={trigger.icon} style={[styles.triggerChip, { backgroundColor: colors.surfaceContainer }]}>
                {trigger.label}
              </Chip>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <MaterialCommunityIcons name="history" size={20} color={colors.text} />
              <Text variant="titleMedium" style={{ color: colors.text }}>
                Recent activity
              </Text>
            </View>

            <CustomButton mode="text" onPress={() => router.push('/logs')} compact>
              View all
            </CustomButton>
          </View>

          {recentEntries.length > 0 ? (
            <View style={styles.recentList}>
              {recentEntries.map((entry) => renderRecentEntry(entry))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="bodyMedium" style={{ color: colors.textMuted, textAlign: 'center' }}>
                No logs yet. Add your first entry to start building correlations.
              </Text>
              <CustomButton mode="contained" onPress={() => router.push('/add-log')} style={styles.emptyButton}>
                Add Entry
              </CustomButton>
            </View>
          )}
        </View>
      </ScrollView>

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
  loadingScreen: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  loadingCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl * 2 + Spacing.lg,
  },
  header: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  heroCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  heroTitleBlock: {
    flex: 1,
    gap: Spacing.xxs,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progress: {
    height: 8,
    borderRadius: Radius.full,
  },
  heroActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  heroActionButton: {
    flex: 1,
    minWidth: 140,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metricCard: {
    width: '48%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  contextChip: {
    borderRadius: Radius.full,
  },
  contextBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.md,
  },
  contextTextBlock: {
    flex: 1,
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  ratingPill: {
    minWidth: 92,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  triggerChip: {
    borderRadius: Radius.full,
  },
  recentList: {
    gap: Spacing.sm,
  },
  recentRow: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  recentLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  recentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTextBlock: {
    flex: 1,
    gap: Spacing.xxs,
  },
  recentChip: {
    borderRadius: Radius.full,
  },
  emptyState: {
    gap: Spacing.md,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  emptyButton: {
    width: '100%',
  },
});
