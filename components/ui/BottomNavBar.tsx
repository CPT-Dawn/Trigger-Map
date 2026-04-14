import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors, useThemePreference } from '../../providers/ThemeProvider';

type BottomNavBarProps = BottomTabBarProps & {
  onAddPress: () => void;
};

type TabName = 'index' | 'logs' | 'settings';

interface TabConfig {
  label: string;
  focusedIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  unfocusedIcon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const TAB_CONFIG: Record<TabName, TabConfig> = {
  index: {
    label: 'Home',
    focusedIcon: 'home-variant',
    unfocusedIcon: 'home-variant-outline',
  },
  logs: {
    label: 'Logs',
    focusedIcon: 'format-list-bulleted',
    unfocusedIcon: 'format-list-bulleted',
  },
  settings: {
    label: 'Settings',
    focusedIcon: 'cog',
    unfocusedIcon: 'cog-outline',
  },
};

interface NavTabButtonProps {
  routeName: TabName;
  routeKey: string;
  focused: boolean;
  navigation: BottomTabBarProps['navigation'];
  label: string;
  focusedIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  unfocusedIcon: keyof typeof MaterialCommunityIcons.glyphMap;
}

function NavTabButton({
  routeName,
  routeKey,
  focused,
  navigation,
  label,
  focusedIcon,
  unfocusedIcon,
}: NavTabButtonProps) {
  const colors = useAppColors();
  const tabColor = focused ? colors.onPrimaryContainer : colors.tabIconDefault;

  return (
    <Pressable
      key={routeKey}
      onPress={() => {
        const event = navigation.emit({
          type: 'tabPress',
          target: routeKey,
          canPreventDefault: true,
        });

        if (!focused && !event.defaultPrevented) {
          navigation.navigate(routeName as never);
        }
      }}
      onLongPress={() => {
        navigation.emit({
          type: 'tabLongPress',
          target: routeKey,
        });
      }}
      style={[
        styles.tabItem,
        {
          backgroundColor: focused ? colors.primaryContainer : 'transparent',
          borderColor: focused ? colors.ghostBorder : 'transparent',
        },
      ]}
    >
      <View style={styles.tabContent}>
        <MaterialCommunityIcons name={focused ? focusedIcon : unfocusedIcon} size={focused ? 24 : 22} color={tabColor} />
        <Text variant="labelSmall" style={[styles.tabLabel, { color: tabColor }, focused && styles.tabLabelFocused]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function BottomNavBar({ state, navigation, onAddPress }: BottomNavBarProps) {
  const colors = useAppColors();
  const { appliedTheme } = useThemePreference();
  const insets = useSafeAreaInsets();
  const hasPersistentNavigationBar = Platform.OS === 'android' && insets.bottom >= 24;
  const dockBottomOffset = hasPersistentNavigationBar ? insets.bottom : 0;
  const activeRouteName = state.routes[state.index]?.name;
  const chromeBaseColor = appliedTheme === 'dark' ? colors.surfaceContainerLow : colors.surfaceContainerLowest;
  const depthVeilOpacity = appliedTheme === 'dark' ? 0.26 : 0.12;
  const topSheenOpacity = appliedTheme === 'dark' ? 0.24 : 0.5;

  const routeByName = (routeName: TabName) => state.routes.find((route) => route.name === routeName);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.shell, { shadowColor: colors.shadowAmbient, bottom: dockBottomOffset }]}
    >
      <View
        style={[
          styles.surface,
          {
            backgroundColor: chromeBaseColor,
            borderColor: colors.ghostBorder,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.depthVeil,
            {
              backgroundColor: colors.surfaceContainerHighest,
              opacity: depthVeilOpacity,
            },
          ]}
        />
        <View style={[styles.topSheen, { backgroundColor: colors.acrylicEdge, opacity: topSheenOpacity }]} />
        <View style={styles.row}>
          <View style={styles.tabsGroup}>
            <NavTabButton
              routeName="index"
              routeKey={routeByName('index')?.key ?? 'index'}
              focused={activeRouteName === 'index'}
              navigation={navigation}
              label={TAB_CONFIG.index.label}
              focusedIcon={TAB_CONFIG.index.focusedIcon}
              unfocusedIcon={TAB_CONFIG.index.unfocusedIcon}
            />
            <NavTabButton
              routeName="logs"
              routeKey={routeByName('logs')?.key ?? 'logs'}
              focused={activeRouteName === 'logs'}
              navigation={navigation}
              label={TAB_CONFIG.logs.label}
              focusedIcon={TAB_CONFIG.logs.focusedIcon}
              unfocusedIcon={TAB_CONFIG.logs.unfocusedIcon}
            />
            <NavTabButton
              routeName="settings"
              routeKey={routeByName('settings')?.key ?? 'settings'}
              focused={activeRouteName === 'settings'}
              navigation={navigation}
              label={TAB_CONFIG.settings.label}
              focusedIcon={TAB_CONFIG.settings.focusedIcon}
              unfocusedIcon={TAB_CONFIG.settings.unfocusedIcon}
            />
          </View>

          <View style={styles.addSlot}>
            <Pressable onPress={onAddPress} accessibilityRole="button" style={styles.addButton}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addButtonContent}
              >
                <MaterialCommunityIcons name="plus-thick" size={22} color={colors.onPrimary} />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 0,
    zIndex: 50,
    elevation: 16,
  },
  surface: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    minHeight: 70,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
    gap: Spacing.sm,
  },
  tabsGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  tabItem: {
    flex: 1,
    borderRadius: Radius.lg,
    minHeight: 52,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  tabContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.lg,
  },
  addSlot: {
    width: 55,
    justifyContent: 'center',
  },
  addButton: {
    width: 50,
    height: 50,
  },
  addButtonContent: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.full,
    elevation: 6,
  },
  tabLabel: {
    opacity: 0.82,
  },
  tabLabelFocused: {
    opacity: 1,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  depthVeil: {
    ...StyleSheet.absoluteFillObject,
  },
});