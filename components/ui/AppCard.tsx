import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

type CardVariant = 'glass' | 'subtle' | 'solid';

export interface AppCardProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  variant?: CardVariant;
  animated?: boolean;
  delay?: number;
  onPress?: () => void;
  disabled?: boolean;
}

export function AppCard({
  children,
  style,
  contentStyle,
  variant = 'glass',
  animated = false,
  delay = 0,
  onPress,
  disabled = false,
  ...props
}: AppCardProps) {
  const colors = useAppColors();

  const tintOverlayColors: [string, string] =
    variant === 'glass'
      ? [colors.acrylicTintStrong, colors.acrylicTintSoft]
      : variant === 'subtle'
        ? [colors.surfaceOverlayStart, colors.surfaceOverlayEnd]
        : [colors.surfaceOverlayStart, colors.surfaceOverlayEnd];

  const baseBackgroundColor =
    variant === 'glass'
      ? colors.surfaceContainerLowest
      : variant === 'subtle'
        ? colors.surfaceContainerLow
        : colors.surfaceContainer;

  const depthVeilOpacity = variant === 'glass' ? 0.16 : variant === 'subtle' ? 0.12 : 0.08;

  const cardNode = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: baseBackgroundColor,
          borderColor: colors.ghostBorder,
          shadowColor: colors.shadowAmbient,
        },
        style,
      ]}
      {...props}
    >
      <View
        pointerEvents="none"
        style={[
          styles.depthVeil,
          {
            backgroundColor: colors.surfaceContainerLow,
            opacity: depthVeilOpacity,
          },
        ]}
      />
      <View pointerEvents="none" style={[styles.topSheen, { backgroundColor: colors.acrylicEdge }]} />
      <View style={contentStyle}>{children}</View>
    </View>
  );

  const wrappedNode = onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {cardNode}
    </Pressable>
  ) : (
    cardNode
  );

  if (!animated) {
    return wrappedNode;
  }

  return <Animated.View entering={FadeInDown.delay(delay).duration(340)}>{wrappedNode}</Animated.View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    overflow: 'hidden',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 2,
  },
  depthVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  topSheen: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 0,
    height: 1,
  },
  pressed: {
    opacity: 0.95,
  },
});
