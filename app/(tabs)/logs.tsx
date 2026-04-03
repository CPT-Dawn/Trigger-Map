import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopGlassBar, useTopGlassBarOffset } from '@/components/navigation/top-glass-bar';
import { Colors } from '@/constants/theme';
import {
  DROPDOWN_CATEGORY_CONFIGS,
  LOG_CATEGORY_ORDER,
  type DropdownCategoryKey,
} from '@/lib/dropdowns';
import { deleteLogEntry, getLogEntries, type LogEntryView, type LogView } from '@/lib/logs';
import { useAppTheme } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

const CategoryLogList = memo(({
  viewKey,
  isActive,
  onOpenEntry,
  onConfirmDelete,
  isDeletingId,
  theme,
  colors,
  tabBarHeight
}: {
  viewKey: LogView;
  isActive: boolean;
  onOpenEntry: (entry: LogEntryView, viewKey: LogView) => void;
  onConfirmDelete: (entry: LogEntryView) => void;
  isDeletingId: string | null;
  theme: 'light' | 'dark';
  colors: any;
  tabBarHeight: number;
}) => {
  const [entries, setEntries] = useState<LogEntryView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLogs = useCallback(
    async (refreshing = false) => {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);

      const result = await getLogEntries(viewKey, 80);

      if (result.error) {
        setErrorMessage(result.error);
        setEntries([]);
      } else {
        setErrorMessage(null);
        setEntries(result.data ?? []);
      }
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [viewKey]
  );

  useFocusEffect(
    useCallback(() => {
      if (isActive) {
        void loadLogs();
      }
    }, [isActive, loadLogs])
  );

  useEffect(() => {
    if (isActive && entries.length === 0 && !isLoading) {
      void loadLogs();
    }
  }, [isActive]);

  const onRefresh = () => {
    void loadLogs(true);
  };

  const renderItem = useCallback(
    ({ item }: { item: LogEntryView }) => {
      const categories = LOG_CATEGORY_ORDER.filter((category) => Boolean(item.itemsByCategory[category]));

      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenEntry(item, viewKey)}
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
              onPress={() => onConfirmDelete(item)}
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

              const isViewCategory = viewKey !== 'combined' && viewKey === category;
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
    },
    [viewKey, onOpenEntry, onConfirmDelete, isDeletingId, colors]
  );

  return (
    <View style={{ width: SCREEN_WIDTH }}>
      {isLoading && !isRefreshing && entries.length === 0 ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading logs...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 36, paddingHorizontal: 16 }]}
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
        <View style={[styles.errorCard, { backgroundColor: colors.surfaceContainer, marginHorizontal: 16 }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
});

export default function LogsScreen() {
  const topOffset = useTopGlassBarOffset();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  const [activeIndex, setActiveIndex] = useState(0);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const navScrollRef = useRef<ScrollView>(null);

  const activeFilterBackground = theme === 'dark' ? 'rgba(186, 195, 255, 0.22)' : 'rgba(3, 22, 50, 0.08)';

  const openEntry = useCallback(
    (entry: LogEntryView, viewKey: LogView) => {
      if (viewKey === 'combined') {
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
          focusCategory: viewKey,
        },
      });
    },
    [router]
  );

  const handleDeleteEntry = async (entryId: string) => {
    if (isDeletingId) return;

    setIsDeletingId(entryId);
    const result = await deleteLogEntry(entryId);
    setIsDeletingId(null);

    if (result.error) {
      Alert.alert('Delete Failed', result.error);
      return;
    }
    
    // Changing standard refetch logic, might need to re-trigger for active pane:
    // Focus effect in the CategoryLogList should re-fetch natively if log deleted,
    // or we can refresh just by a small event, but we don't have global state. Let's just 
    // force an update but since child relies on `useFocusEffect`, we may need a global trigger.
    // For simplicity, a user deleting it directly causes it to disappear on next focus, 
    // or we can rely on a fast reload. Let's rely on standard reload by setting state slightly,
    // or we'll just let React navigation unmount/mount doing its thing, but it stays mounted...
    // To simplify: I'll increment a key to remount the list.
    setRefetchTick(t => t + 1);
  };

  const [refetchTick, setRefetchTick] = useState(0);

  const confirmDeleteEntry = useCallback(
    (entry: LogEntryView) => {
      if (isDeletingId) return;

      Alert.alert('Delete Log', 'This permanently removes this bundled log entry.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void handleDeleteEntry(entry.id) },
      ]);
    },
    [isDeletingId]
  );

  const handleTabPress = (index: number) => {
    setActiveIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleMomentumScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < LOG_VIEWS.length && index !== activeIndex) {
      setActiveIndex(index);
      navScrollRef.current?.scrollTo({ x: Math.max(0, index * 80 - SCREEN_WIDTH / 2 + 50), animated: true });
    }
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.glowTop, { backgroundColor: theme === 'dark' ? 'rgba(186, 195, 255, 0.08)' : 'rgba(3, 22, 50, 0.06)' }]} />
        <View style={[styles.glowBottom, { backgroundColor: theme === 'dark' ? 'rgba(102, 217, 204, 0.08)' : 'rgba(0, 104, 118, 0.07)' }]} />
      </View>

      <TopGlassBar iconName="time-outline" title="Logs" />

      <View style={[styles.screenContent, { paddingTop: topOffset }]}>
        <View style={[styles.navContainer, {
          backgroundColor: theme === 'dark' ? 'rgba(30,30,40,0.1)' : 'rgba(3, 22, 50, 0.02)',
          borderBottomColor: colors.ghostBorder,
        }]}>
          <ScrollView
            ref={navScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.navScrollContent}
          >
            {LOG_VIEWS.map((view, index) => {
              const selected = activeIndex === index;
              return (
                <Pressable
                  key={view.key}
                  accessibilityRole="button"
                  onPress={() => handleTabPress(index)}
                  style={[
                    styles.navChip,
                    { backgroundColor: selected ? activeFilterBackground : 'transparent' },
                  ]}>
                  <Text style={[styles.navChipText, { color: selected ? colors.primary : colors.textMuted }]}>
                    {view.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <FlatList
          key={refetchTick}
          ref={flatListRef}
          data={LOG_VIEWS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          keyExtractor={(item) => item.key}
          renderItem={({ item, index }) => (
            <CategoryLogList
              viewKey={item.key}
              isActive={activeIndex === index}
              onOpenEntry={openEntry}
              onConfirmDelete={confirmDeleteEntry}
              isDeletingId={isDeletingId}
              theme={theme}
              colors={colors}
              tabBarHeight={tabBarHeight}
            />
          )}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screenContent: { flex: 1 },
  navContainer: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  navScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  navChip: {
    alignItems: 'center',
    borderRadius: 999,
    minHeight: 34,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  navChipText: {
    fontSize: 14,
    fontWeight: '700',
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
  listContent: {
    gap: 10,
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
