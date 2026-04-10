import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Button, Text, TouchableRipple } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors, useThemePreference } from '../../providers/ThemeProvider';

type BottomNavBarProps = BottomTabBarProps & {
  onAddPress: () => void;
  visible: boolean;
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
  const animatedFocus = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animatedFocus, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      damping: 16,
      stiffness: 180,
      mass: 0.85,
    }).start();
  }, [animatedFocus, focused]);

  const focusScale = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [0.965, 1.04],
  });

  const focusTranslateY = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  const labelOpacity = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1],
  });

  const iconScale = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const isCenterTab = routeName === 'logs';
  const tabColor = focused ? colors.primary : colors.tabIconDefault;

  return (
    <TouchableRipple
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
      borderless={false}
      style={[
        styles.tabItem,
        isCenterTab && styles.centerTabItem,
        {
          backgroundColor: focused ? colors.surfaceContainerHighest : 'transparent',
          borderColor: focused ? colors.ghostBorder : 'transparent',
        },
      ]}
      rippleColor={colors.surfaceContainerHigh}
    >
      <Animated.View
        style={[
          styles.tabContent,
          {
            opacity: labelOpacity,
            transform: [{ scale: focusScale }, { translateY: focusTranslateY }],
          },
          focused && { backgroundColor: colors.surfaceContainerHighest },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          <MaterialCommunityIcons name={focused ? focusedIcon : unfocusedIcon} size={focused ? 26 : 24} color={tabColor} />
        </Animated.View>
        <Text variant="labelSmall" style={[styles.tabLabel, { color: tabColor }, focused && styles.tabLabelFocused]}>
          {label}
        </Text>
        {focused && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
      </Animated.View>
    </TouchableRipple>
  );
}

export function BottomNavBar({ state, navigation, onAddPress, visible }: BottomNavBarProps) {
  const colors = useAppColors();
  const { appliedTheme } = useThemePreference();
  const insets = useSafeAreaInsets();
  const dockProgress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    dockProgress.stopAnimation();

    Animated.timing(dockProgress, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      duration: visible ? 180 : 90,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    }).start();
  }, [dockProgress, visible]);

  const dockTranslateY = dockProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [96, 0],
  });

  const dockScale = dockProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.975, 1],
  });

  const dockOpacity = dockProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.shell,
        {
          bottom: insets.bottom + Spacing.sm,
          shadowColor: colors.shadowAmbient,
          opacity: dockOpacity,
          transform: [{ translateY: dockTranslateY }, { scale: dockScale }],
        },
      ]}
    >
      <View
        style={[
          styles.surface,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.ghostBorder,
          },
        ]}
      >
        <BlurView
          intensity={88}
          tint={appliedTheme === 'dark' ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurView"
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
            <Button
              mode="contained"
              icon="plus-thick"
              onPress={onAddPress}
              buttonColor={colors.primary}
              textColor={colors.onPrimary}
              style={styles.addButton}
              contentStyle={styles.addButtonContent}
              labelStyle={styles.addButtonLabel}
              theme={{
                roundness: Radius.full,
                colors: {
                  primary: colors.primary,
                  onPrimary: colors.onPrimary,
                },
              }}
            >
              Add
            </Button>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 50,
    elevation: 16,
  },
  surface: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    minHeight: 78,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  tabItem: {
    flex: 1,
    borderRadius: Radius.lg,
    minHeight: 60,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  centerTabItem: {
    flex: 1.08,
  },
  tabContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.lg,
  },
  addSlot: {
    flex: 1.55,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  addButton: {
    width: '100%',
    minWidth: 112,
    marginVertical: 0,
    borderRadius: Radius.full,
    elevation: 3,
  },
  addButtonContent: {
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonLabel: {
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 0.15,
  },
  tabLabel: {
    opacity: 0.82,
  },
  tabLabelFocused: {
    opacity: 1,
    fontWeight: '700',
  },
  activeIndicator: {
    width: 16,
    height: 3,
    borderRadius: Radius.full,
    marginTop: 1,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
});