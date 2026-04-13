import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

export interface ScreenWrapperProps extends ViewProps {
  children: React.ReactNode;
}

export function ScreenWrapper({ children, style, ...props }: ScreenWrapperProps) {
  const colors = useAppColors();

  return (
    <LinearGradient
      colors={[colors.background, colors.gradientStart, colors.gradientEnd]}
      locations={[0, 0.38, 1]}
      style={[styles.container, style]}
      {...props}
    >
      <View pointerEvents="none" style={styles.ambientLayer}>
        <View style={[styles.orb, styles.orbPrimary, { backgroundColor: colors.ambientPrimary }]} />
        <View style={[styles.orb, styles.orbSecondary, { backgroundColor: colors.ambientSecondary }]} />
        <View style={[styles.orb, styles.orbTertiary, { backgroundColor: colors.ambientTertiary }]} />
      </View>

      <LinearGradient
        pointerEvents="none"
        colors={[colors.surfaceOverlayStart, colors.surfaceOverlayEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbPrimary: {
    width: 320,
    height: 320,
    top: -92,
    right: -108,
    opacity: 0.7,
  },
  orbSecondary: {
    width: 280,
    height: 280,
    bottom: 88,
    left: -120,
    opacity: 0.5,
  },
  orbTertiary: {
    width: 240,
    height: 240,
    bottom: -72,
    right: 26,
    opacity: 0.35,
  },
  safeArea: {
    flex: 1,
    paddingTop: Spacing.sm,
  },
});
