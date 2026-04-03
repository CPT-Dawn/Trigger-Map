import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/lib/theme';

const ICONS = {
  index: { active: 'home', inactive: 'home-outline' },
  logs: { active: 'list', inactive: 'list-outline' },
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
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  const navRoutes = state.routes;

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
    <View style={styles.outer}>
      <BlurView
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        intensity={theme === 'dark' ? 34 : 50}
        tint={theme === 'dark' ? 'dark' : 'light'}
        style={[
          styles.bar,
          {
            backgroundColor: colors.glassSurface,
            borderColor: colors.ghostBorder,
            shadowColor: colors.primary,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}>
        <View style={styles.row}>{navRoutes.map(renderRoute)}</View>

        <Pressable
          accessibilityLabel="Add or edit"
          accessibilityRole="button"
          onPress={onPressAdd}
          style={[styles.addButton, { shadowColor: colors.primary }]}
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.addGradient}>
            <View style={[styles.addInnerRing, { borderColor: colors.ghostBorder }]}>
              <Ionicons color={colors.onPrimary} name="add" size={22} />
            </View>
          </LinearGradient>
        </Pressable>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 35,
  },
  bar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 82,
    paddingHorizontal: 12,
    paddingTop: 10,
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 10,
    gap: 2,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  addButton: {
    borderRadius: 16,
    height: 50,
    overflow: 'hidden',
    width: 50,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  addGradient: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  addInnerRing: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
