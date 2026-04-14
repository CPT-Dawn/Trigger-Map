import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, type SnackbarProps } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

export interface AppSnackbarProps extends Omit<SnackbarProps, 'style' | 'theme'> {
  style?: StyleProp<ViewStyle>;
  surfaceColor?: string;
  textColor?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  theme?: SnackbarProps['theme'];
}

const TOAST_DOCK_OFFSET = 82;

function getToastMessage(children: React.ReactNode) {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }

  return '';
}

function resolveToastIcon(
  message: string,
  explicitIcon?: keyof typeof MaterialCommunityIcons.glyphMap,
): keyof typeof MaterialCommunityIcons.glyphMap {
  if (explicitIcon) {
    return explicitIcon;
  }

  const normalized = message.toLowerCase();

  if (normalized.includes('delete') || normalized.includes('removed')) {
    return 'trash-can-outline';
  }

  if (normalized.includes('edit') || normalized.includes('updated') || normalized.includes('saved') || normalized.includes('added')) {
    return 'check-circle-outline';
  }

  if (normalized.includes('error') || normalized.includes('unable') || normalized.includes('failed')) {
    return 'alert-circle-outline';
  }

  return 'information-outline';
}

export function AppSnackbar({
  visible,
  style,
  icon,
  action,
  duration = 3000,
  onDismiss,
  surfaceColor,
  textColor,
  theme,
  children,
}: AppSnackbarProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(visible ? 1 : 0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const message = useMemo(() => getToastMessage(children), [children]);
  const displayMessage = message.length > 0 ? message : 'Notification';
  const resolvedIcon = useMemo(() => resolveToastIcon(displayMessage, icon), [displayMessage, icon]);
  const resolvedSurfaceColor = surfaceColor ?? theme?.colors?.surface ?? colors.surfaceContainerHighest;
  const resolvedTextColor = textColor ?? theme?.colors?.onSurface ?? colors.text;
  const resolvedActionColor = action?.textColor ?? theme?.colors?.primary ?? colors.primary;

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!visible || duration <= 0 || duration === Number.POSITIVE_INFINITY) {
      return;
    }

    hideTimerRef.current = setTimeout(() => {
      onDismiss?.();
    }, duration);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [duration, onDismiss, visible]);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 240 : 180,
      easing: Easing.bezier(0.2, 0, 0, 1),
    });
  }, [visible, progress]);

  const toastContainerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 22 }, { scale: 0.985 + progress.value * 0.015 }] as const,
  }));

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.portal,
        {
          bottom: insets.bottom + TOAST_DOCK_OFFSET,
        },
        toastContainerAnimatedStyle,
      ]}
    >
      <View
        style={[
          styles.toastSurface,
          {
            backgroundColor: resolvedSurfaceColor,
            borderColor: colors.ghostBorder,
            shadowColor: colors.shadowAmbient,
          },
          style,
        ]}
      >
        <View style={styles.contentRow}>
          <View style={[styles.iconWrap, { backgroundColor: colors.surfaceContainerHigh }]}> 
            <MaterialCommunityIcons name={resolvedIcon} size={16} color={resolvedTextColor} />
          </View>

          <Text
            variant="bodyMedium"
            numberOfLines={1}
            style={[styles.messageText, { color: resolvedTextColor }]}
          >
            {displayMessage}
          </Text>

          {action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={(event) => {
                action.onPress?.(event);
                onDismiss?.();
              }}
              style={({ pressed }) => [
                styles.actionButton,
                {
                  borderColor: colors.ghostBorder,
                  backgroundColor: colors.surfaceContainerLow,
                },
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Text variant="labelMedium" numberOfLines={1} style={[styles.actionText, { color: resolvedActionColor }]}> 
                {action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  portal: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 80,
  },
  toastSurface: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    minHeight: 52,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    flex: 1,
    fontWeight: '600',
  },
  actionButton: {
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  actionText: {
    fontWeight: '700',
  },
});
