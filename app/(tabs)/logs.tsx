import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopGlassBar } from '@/components/navigation/top-glass-bar';
import { Colors } from '@/constants/theme';
import {
  DROPDOWN_CATEGORY_CONFIGS,
  LOG_CATEGORY_ORDER,
  type DropdownCategoryKey,
} from '@/lib/dropdowns';
import { deleteLogEntry, getLogEntries, type LogEntryView, type LogView } from '@/lib/logs';
import { useAppTheme } from '@/lib/theme';

const LOG_VIEWS: { key: LogView; label: string }[] = [
  { key: 'combined', label: 'Combined' },
  { key: 'food', label: 'Food' },
  { key: 'medicine', label: 'Medicine' },
  { key: 'pain', label: 'Pain' },
  { key: 'stress', label: 'Stress' },
];

const CATEGORY_LABEL_MAP = DROPDOWN_CATEGORY_CONFIGS.reduce<Record<DropdownCategoryKey, string>>(
  (acc, item) => {
    acc[item.key] = item.label;
    return acc;
  },
  {
    food: 'Food',
    pain: 'Pain',
    stress: 'Stress',
    medicine: 'Medicine',
  }
);

function formatLoggedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function LogsScreen() {
  const router = useRouter();
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  const [activeView, setActiveView] = useState<LogView>('combined');
  const [entries, setEntries] = useState<LogEntryView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeFilterBackground = theme === 'dark' ? 'rgba(186, 195, 255, 0.22)' : 'rgba(3, 22, 50, 0.08)';

  const loadLogs = useCallback(
    async (refreshing = false) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const result = await getLogEntries(activeView, 80);

      if (result.error) {
        setErrorMessage(result.error);
        setEntries([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      setErrorMessage(null);
      setEntries(result.data ?? []);
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [activeView]
  );

  useFocusEffect(
    useCallback(() => {
      void loadLogs(false);
    }, [loadLogs])
  );

  const onRefresh = () => {
    void loadLogs(true);
  };

  const openEntry = (entry: LogEntryView) => {
    if (activeView === 'combined') {
      router.push({
        pathname: '/add-edit',
        params: { entryId: entry.id },
      });
      return;
    }

    router.push({
      pathname: '/add-edit',
      params: {
        entryId: entry.id,
        focusCategory: activeView,
      },
    });
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (isDeletingId) return;

    setIsDeletingId(entryId);
    const result = await deleteLogEntry(entryId);
    setIsDeletingId(null);

    if (result.error) {
      Alert.alert('Delete Failed', result.error);
      return;
    }

    await loadLogs(false);
  };

  const confirmDeleteEntry = (entry: LogEntryView) => {
    if (isDeletingId) return;

    Alert.alert('Delete Log', 'This permanently removes this bundled log entry.', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void handleDeleteEntry(entry.id);
        },
      },
    ]);
  };

  const headerSubtitle = useMemo(() => {
    const activeCount = entries.length;
    if (activeCount === 0) return 'Recent-first timeline';
    return `${activeCount} ${activeCount === 1 ? 'entry' : 'entries'} in ${LOG_VIEWS.find((view) => view.key === activeView)?.label ?? 'view'
      }`;
  }, [activeView, entries.length]);

  const renderItem = ({ item }: { item: LogEntryView }) => {
    const categories = LOG_CATEGORY_ORDER.filter((category) => Boolean(item.itemsByCategory[category]));

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => openEntry(item)}
        style={[
          styles.rowCard,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.ghostBorder,
          },
        ]}>
        <View style={styles.rowTop}>
          <View style={styles.rowTimeWrap}>
            <Ionicons color={colors.textMuted} name="time-outline" size={14} />
            <Text style={[styles.rowTimeText, { color: colors.textMuted }]}>{formatLoggedAt(item.loggedAt)}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={Boolean(isDeletingId)}
            hitSlop={8}
            onPress={() => confirmDeleteEntry(item)}
            style={styles.deleteButton}>
            {isDeletingId === item.id ? (
              <ActivityIndicator color={colors.error} size="small" />
            ) : (
              <Ionicons color={colors.error} name="trash-outline" size={18} />
            )}
          </Pressable>
        </View>

        <View style={styles.chipsWrap}>
          {categories.map((category) => {
            const option = item.itemsByCategory[category];
            if (!option) return null;

            const isViewCategory = activeView !== 'combined' && activeView === category;
            const chipBackground = isViewCategory ? colors.primaryContainer : colors.surfaceContainerHigh;
            const chipText = isViewCategory ? colors.onPrimaryContainer : colors.text;

            return (
              <View key={`${item.id}:${category}`} style={[styles.categoryChip, { backgroundColor: chipBackground }]}>
                <Text numberOfLines={1} style={[styles.categoryChipText, { color: chipText }]}>
                  {CATEGORY_LABEL_MAP[category]}: {option.label}
                </Text>
              </View>
            );
          })}
        </View>

        {item.note ? (
          <Text numberOfLines={2} style={[styles.noteText, { color: colors.textMuted }]}>
            {item.note}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <View style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.glowTop,
            {
              backgroundColor: theme === 'dark' ? 'rgba(186, 195, 255, 0.08)' : 'rgba(3, 22, 50, 0.06)',
            },
          ]}
        />
        <View
          style={[
            styles.glowBottom,
            {
              backgroundColor: theme === 'dark' ? 'rgba(102, 217, 204, 0.08)' : 'rgba(0, 104, 118, 0.07)',
            },
          ]}
        />
      </View>

      <TopGlassBar iconName="time-outline" subtitle={headerSubtitle} title="Logs" />

      <View style={styles.screenContent}>
        <View
          style={[
            styles.filterWrap,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.ghostBorder,
            },
          ]}>
          {LOG_VIEWS.map((view) => {
            const selected = activeView === view.key;
            return (
              <Pressable
                key={view.key}
                accessibilityRole="button"
                disabled={isLoading || Boolean(isDeletingId)}
                onPress={() => setActiveView(view.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected ? activeFilterBackground : colors.surfaceContainerHigh,
                  },
                ]}>
                <Text style={[styles.filterChipText, { color: selected ? colors.primary : colors.textMuted }]}>
                  {view.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading logs...</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={entries}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.ghostBorder,
                  },
                ]}>
                <Ionicons color={colors.textMuted} name="sparkles-outline" size={22} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No logs yet in this view</Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Create one using the center + button.</Text>
              </View>
            }
          />
        )}

        {errorMessage ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.surfaceContainer,
              },
            ]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  glowTop: {
    borderRadius: 999,
    height: 280,
    left: -120,
    position: 'absolute',
    top: -110,
    width: 280,
  },
  glowBottom: {
    borderRadius: 999,
    bottom: -140,
    height: 340,
    position: 'absolute',
    right: -150,
    width: 340,
  },
  filterWrap: {
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  filterChip: {
    alignItems: 'center',
    borderRadius: 999,
    minHeight: 34,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    gap: 10,
    paddingBottom: 128,
  },
  rowCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowTimeWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  rowTimeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 26,
    minWidth: 26,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryChip: {
    borderRadius: 999,
    maxWidth: '100%',
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noteText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 8,
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 22,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  errorCard: {
    borderRadius: 12,
    marginBottom: 6,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
