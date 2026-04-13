import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

  const gradientColors: [string, string] =
    variant === 'glass'
      ? [colors.glassSurface, colors.surfaceOverlayEnd]
      : variant === 'subtle'
        ? [colors.surfaceContainerLow, colors.surfaceContainerLowest]
        : [colors.surfaceContainer, colors.surfaceContainerHigh];

  const cardNode = (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.card,
        {
          borderColor: colors.ghostBorder,
          shadowColor: colors.shadowAmbient,
        },
        style,
      ]}
      {...props}
    >
      <View style={contentStyle}>{children}</View>
    </LinearGradient>
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
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 3,
  },
  pressed: {
    opacity: 0.95,
  },
});
