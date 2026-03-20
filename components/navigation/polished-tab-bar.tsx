import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

const ICONS = {
  index: { active: 'home', inactive: 'home-outline' },
  logs: { active: 'list', inactive: 'list-outline' },
  track: { active: 'pulse', inactive: 'pulse-outline' },
  settings: { active: 'settings', inactive: 'settings-outline' },
} as const;

type TabRouteName = keyof typeof ICONS;
type IconName = keyof typeof Ionicons.glyphMap;

function toLabel(routeName: string, fallback?: string) {
  if (fallback) return fallback;
  if (routeName === 'index') return 'Home';
  return routeName.charAt(0).toUpperCase() + routeName.slice(1);
}

export function PolishedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2);

  const activeChip =
    theme === 'dark' ? 'rgba(186, 195, 255, 0.16)' : 'rgba(3, 22, 50, 0.08)';
  const tabLabelColor = colors.textMuted;

  const onPressTab = (routeKey: string, routeName: string, isFocused: boolean) => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }

    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const onPressAdd = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/add-edit');
  };

  const renderRoute = (route: (typeof state.routes)[number]) => {
    const routeIndex = state.routes.findIndex((candidate) => candidate.key === route.key);
    const isFocused = state.index === routeIndex;
    const descriptor = descriptors[route.key];
    const rawLabel = descriptor.options.tabBarLabel;
    const label =
      typeof rawLabel === 'string'
        ? rawLabel
        : toLabel(route.name, typeof descriptor.options.title === 'string' ? descriptor.options.title : undefined);
    const iconTokens = ICONS[route.name as TabRouteName] ?? ICONS.index;
    const iconName = (isFocused ? iconTokens.active : iconTokens.inactive) as IconName;
    const iconColor = isFocused ? colors.tabIconSelected : colors.tabIconDefault;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        style={[styles.tabButton, isFocused && { backgroundColor: activeChip }]}
        onPress={() => onPressTab(route.key, route.name, isFocused)}
        onLongPress={() =>
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          })
        }>
        <Ionicons color={iconColor} name={iconName} size={22} />
        <Text style={[styles.tabLabel, { color: isFocused ? iconColor : tabLabelColor }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.glassSurface,
            borderColor: colors.ghostBorder,
            shadowColor: colors.primary,
          },
        ]}>
        <View style={styles.group}>{leftRoutes.map(renderRoute)}</View>
        <View style={styles.centerGap} />
        <View style={styles.group}>{rightRoutes.map(renderRoute)}</View>
      </View>

      <Pressable
        accessibilityLabel="Add or edit"
        accessibilityRole="button"
        style={[styles.addButton, { shadowColor: colors.primary }]}
        onPress={onPressAdd}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.addGradient}>
          <View style={[styles.addInnerRing, { borderColor: colors.ghostBorder }]}>
            <Ionicons color={colors.onPrimary} name="add" size={30} />
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  bar: {
    borderRadius: 34,
    borderWidth: 1,
    flexDirection: 'row',
    width: '92%',
    maxWidth: 560,
    minHeight: 78,
    marginTop: 28,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 10,
  },
  group: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  centerGap: {
    width: 82,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 20,
    justifyContent: 'center',
    minWidth: 68,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 3,
  },
  addButton: {
    borderRadius: 34,
    height: 68,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    width: 68,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 12,
  },
  addGradient: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  addInnerRing: {
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
});
