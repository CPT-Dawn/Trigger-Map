import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Button, Text, TouchableRipple } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

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

export function BottomNavBar({ state, navigation, onAddPress }: BottomNavBarProps) {
  const colors = useAppColors();

  const renderTab = (routeName: TabName, routeKey: string, routeIndex: number) => {
    const config = TAB_CONFIG[routeName];
    const focused = state.index === routeIndex;
    const isCenterTab = routeName === 'logs';
    const color = focused ? colors.primary : colors.tabIconDefault;

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
            elevation: focused ? 2 : 0,
          },
        ]}
        rippleColor={colors.surfaceContainerHigh}
      >
        <View style={[styles.tabContent, focused && { backgroundColor: colors.surfaceContainerHighest }]}> 
          <MaterialCommunityIcons
            name={focused ? config.focusedIcon : config.unfocusedIcon}
            size={focused ? 26 : 24}
            color={color}
          />
          <Text variant="labelSmall" style={[styles.tabLabel, { color }, focused && styles.tabLabelFocused]}>
            {config.label}
          </Text>
          {focused && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
        </View>
      </TouchableRipple>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.shell,
        {
          bottom: Spacing.md,
          shadowColor: colors.shadowAmbient,
        },
      ]}
    >
      <View
        style={[
          styles.surface,
          {
            backgroundColor: colors.glassSurface,
            borderColor: colors.ghostBorder,
          },
        ]}
      >
        <View style={styles.row}>
          {renderTab('index', state.routes[0]?.key ?? 'index', 0)}
          {renderTab('logs', state.routes[1]?.key ?? 'logs', 1)}
          {renderTab('settings', state.routes[2]?.key ?? 'settings', 2)}

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
            >
              Add
            </Button>
          </View>
        </View>
      </View>
    </View>
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
    flex: 1.45,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  addButton: {
    width: '100%',
    minWidth: 100,
    marginVertical: 0,
    borderRadius: Radius.full,
    elevation: 3,
  },
  addButtonContent: {
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonLabel: {
    fontWeight: '700',
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
});