import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors, useThemePreference } from '../../providers/ThemeProvider';

type BottomNavBarProps = BottomTabBarProps & {
  onAddPress: () => void;
  blurTarget: React.RefObject<View | null>;
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

  const isCenterTab = routeName === 'logs';
  const tabColor = focused ? colors.primary : colors.tabIconDefault;

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
        isCenterTab && styles.centerTabItem,
        {
          backgroundColor: focused ? colors.surfaceContainerHigh : 'transparent',
          borderColor: focused ? colors.ghostBorder : 'transparent',
        },
      ]}
    >
      <View style={styles.tabContent}>
        <MaterialCommunityIcons name={focused ? focusedIcon : unfocusedIcon} size={focused ? 26 : 24} color={tabColor} />
        <Text variant="labelSmall" style={[styles.tabLabel, { color: tabColor }, focused && styles.tabLabelFocused]}>
          {label}
        </Text>
        {focused && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
      </View>
    </Pressable>
  );
}

export function BottomNavBar({ state, navigation, onAddPress, blurTarget }: BottomNavBarProps) {
  const colors = useAppColors();
  const { appliedTheme } = useThemePreference();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.shell, { shadowColor: colors.shadowAmbient, bottom: -insets.bottom }]}
    >
      <View
        style={[
          styles.surface,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.ghostBorder,
            paddingBottom: Spacing.xs,
          },
        ]}
      >
        <BlurView
          intensity={88}
          tint={appliedTheme === 'dark' ? 'dark' : 'light'}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[
            colors.surfaceBright,
            colors.glassSurface,
            colors.surfaceContainerLow,
          ]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.topSheen, { backgroundColor: colors.onPrimary, opacity: 0.08 }]} />
        <View style={styles.row}>
          <NavTabButton
            routeName="index"
            routeKey={state.routes[0]?.key ?? 'index'}
            focused={state.index === 0}
            navigation={navigation}
            label={TAB_CONFIG.index.label}
            focusedIcon={TAB_CONFIG.index.focusedIcon}
            unfocusedIcon={TAB_CONFIG.index.unfocusedIcon}
          />
          <NavTabButton
            routeName="logs"
            routeKey={state.routes[1]?.key ?? 'logs'}
            focused={state.index === 1}
            navigation={navigation}
            label={TAB_CONFIG.logs.label}
            focusedIcon={TAB_CONFIG.logs.focusedIcon}
            unfocusedIcon={TAB_CONFIG.logs.unfocusedIcon}
          />
          <NavTabButton
            routeName="settings"
            routeKey={state.routes[2]?.key ?? 'settings'}
            focused={state.index === 2}
            navigation={navigation}
            label={TAB_CONFIG.settings.label}
            focusedIcon={TAB_CONFIG.settings.focusedIcon}
            unfocusedIcon={TAB_CONFIG.settings.unfocusedIcon}
          />

          <View style={styles.addSlot}>
            <Pressable onPress={onAddPress} accessibilityRole="button" style={styles.addButton}>
              <View style={[styles.addButtonContent, { backgroundColor: colors.primary }]}> 
                <MaterialCommunityIcons name="plus-thick" size={18} color={colors.onPrimary} />
                <Text variant="labelMedium" numberOfLines={1} style={[styles.addButtonLabel, { color: colors.onPrimary }]}> 
                  Add
                </Text>
              </View>
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
    left: -1,
    right: -1,
    bottom: 0,
    zIndex: 50,
    elevation: 16,
  },
  surface: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    minHeight: 84,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 20,
    gap: 1,
  },
  tabItem: {
    flex: 0.98,
    borderRadius: Radius.lg,
    minHeight: 56,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  centerTabItem: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.lg,
  },
  addSlot: {
    flex: 1.5,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  addButton: {
    width: '100%',
    minWidth: 120,
  },
  addButtonContent: {
    flexDirection: 'row',
    gap: Spacing.xs,
    width: '100%',
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.full,
    elevation: 3,
  },
  addButtonLabel: {
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  tabLabel: {
    opacity: 0.74,
  },
  tabLabelFocused: {
    opacity: 1,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  activeIndicator: {
    width: 20,
    height: 3,
    borderRadius: Radius.full,
    marginTop: Spacing.xxs,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
});