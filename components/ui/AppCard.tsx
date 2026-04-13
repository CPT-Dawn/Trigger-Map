import React from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors, useThemePreference } from '../../providers/ThemeProvider';

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
  const { appliedTheme } = useThemePreference();

  const tintOverlayColors: [string, string] =
    variant === 'glass'
      ? [colors.acrylicTintStrong, colors.acrylicTintSoft]
      : variant === 'subtle'
        ? [colors.surfaceOverlayStart, colors.acrylicTintSoft]
        : [colors.surfaceOverlayStart, colors.surfaceOverlayEnd];

  const baseBackgroundColor =
    variant === 'glass'
      ? colors.acrylicBase
      : variant === 'subtle'
        ? colors.acrylicElevated
        : colors.surfaceContainerLow;

  const blurIntensity =
    variant === 'glass'
      ? appliedTheme === 'dark' ? 74 : 84
      : variant === 'subtle'
        ? appliedTheme === 'dark' ? 62 : 70
        : appliedTheme === 'dark' ? 50 : 58;

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
      <BlurView
        intensity={blurIntensity}
        tint={appliedTheme === 'dark' ? 'dark' : 'light'}
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={tintOverlayColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
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
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 4,
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
