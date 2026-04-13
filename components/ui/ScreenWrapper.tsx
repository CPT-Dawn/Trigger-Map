import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '../../constants/theme';
import { useAppColors, useThemePreference } from '../../providers/ThemeProvider';

export interface ScreenWrapperProps extends ViewProps {
  children: React.ReactNode;
}

export function ScreenWrapper({ children, style, ...props }: ScreenWrapperProps) {
  const colors = useAppColors();
  const { appliedTheme } = useThemePreference();
  const atmosphereVeilOpacity = appliedTheme === 'dark' ? 0.24 : 0.12;
  const surfaceTintOpacity = appliedTheme === 'dark' ? 0.2 : 0.3;
  const accentTintOpacity = appliedTheme === 'dark' ? 0.16 : 0.12;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, style]} {...props}>
      <View pointerEvents="none" style={styles.ambientLayer}>
        <View style={[styles.orb, styles.orbPrimary, { backgroundColor: colors.ambientPrimary }]} />
        <View style={[styles.orb, styles.orbSecondary, { backgroundColor: colors.ambientSecondary }]} />
        <View style={[styles.orb, styles.orbTertiary, { backgroundColor: colors.ambientTertiary }]} />
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.surfaceTint,
          {
            backgroundColor: colors.surfaceOverlayStart,
            opacity: surfaceTintOpacity,
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.accentTint,
          {
            backgroundColor: colors.acrylicTintSoft,
            opacity: accentTintOpacity,
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.atmosphereVeil,
          {
            backgroundColor: colors.surfaceContainerLow,
            opacity: atmosphereVeilOpacity,
          },
        ]}
      />

      <View pointerEvents="none" style={[styles.acrylicSheen, { backgroundColor: colors.acrylicEdge }]} />

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {children}
      </SafeAreaView>
    </View>
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
  acrylicSheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    opacity: 0.52,
  },
  atmosphereVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  surfaceTint: {
    ...StyleSheet.absoluteFillObject,
  },
  accentTint: {
    ...StyleSheet.absoluteFillObject,
  },
});
