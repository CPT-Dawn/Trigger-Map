import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import type { ColorSchemeName } from 'react-native';

/**
 * Semantic color tokens for Trigger Map.
 * `light`: Precision Health Editorial ("Clinical Curator")
 * `dark`: Restorative Sanctuary
 */
export const Colors = {
  light: {
    text: '#191c1e',
    textMuted: '#44474d',
    background: '#f7f9fb',
    surface: '#f7f9fb',
    surfaceBright: '#fafcff',
    surfaceVariant: '#e7ebf0',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#f2f4f6',
    surfaceContainer: '#eceff2',
    surfaceContainerHigh: '#e7eaed',
    surfaceContainerHighest: '#e0e3e5',
    primary: '#031632',
    onPrimary: '#eef4ff',
    primaryContainer: '#1a2b48',
    onPrimaryContainer: '#d8e5ff',
    secondary: '#006876',
    onSecondary: '#f2feff',
    secondaryContainer: '#b8ebf2',
    onSecondaryContainer: '#002027',
    tertiary: '#8f4b36',
    onTertiary: '#fff8f6',
    tertiaryContainer: '#ffdbd1',
    onTertiaryContainer: '#391106',
    error: '#ba1a1a',
    onError: '#fff8f7',
    errorContainer: '#ffdad6',
    onErrorContainer: '#410002',
    outline: '#74777f',
    outlineVariant: '#c5c6ce',
    ghostBorder: 'rgba(197, 198, 206, 0.15)',
    glassSurface: 'rgba(255, 255, 255, 0.8)',
    gradientStart: '#031632',
    gradientEnd: '#1a2b48',
    chartPositive: '#006876',
    chartTrigger: '#8f4b36',
    shadowAmbient: 'rgba(25, 28, 30, 0.04)',
    shadowPrimaryAmbient: 'rgba(3, 22, 50, 0.04)',
    tint: '#006876',
    icon: '#5f636a',
    tabIconDefault: '#7a7d85',
    tabIconSelected: '#006876',
  },
  dark: {
    text: '#e9e7e7',
    textMuted: '#c9c6c6',
    background: '#131313',
    surface: '#131313',
    surfaceBright: '#3a3939',
    surfaceVariant: '#30333c',
    surfaceContainerLowest: '#171717',
    surfaceContainerLow: '#1c1b1b',
    surfaceContainer: '#201f1f',
    surfaceContainerHigh: '#2a2a2a',
    surfaceContainerHighest: '#353534',
    primary: '#bac3ff',
    onPrimary: '#14215a',
    primaryContainer: '#4453a7',
    onPrimaryContainer: '#e2e6ff',
    secondary: '#66d9cc',
    onSecondary: '#003732',
    secondaryContainer: '#224e48',
    onSecondaryContainer: '#b8f5ed',
    tertiary: '#ffb59f',
    onTertiary: '#5a1f10',
    tertiaryContainer: '#743824',
    onTertiaryContainer: '#ffdbd1',
    error: '#ffb4ab',
    onError: '#690005',
    errorContainer: '#93000a',
    onErrorContainer: '#ffdad6',
    outline: '#8e909c',
    outlineVariant: '#454652',
    ghostBorder: 'rgba(69, 70, 82, 0.15)',
    glassSurface: 'rgba(48, 51, 60, 0.6)',
    gradientStart: '#bac3ff',
    gradientEnd: '#4453a7',
    chartPositive: '#66d9cc',
    chartTrigger: '#ffb59f',
    shadowAmbient: 'rgba(186, 195, 255, 0.06)',
    shadowPrimaryAmbient: 'rgba(186, 195, 255, 0.06)',
    tint: '#bac3ff',
    icon: '#adb0b8',
    tabIconDefault: '#8f929a',
    tabIconSelected: '#bac3ff',
  },
} as const;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// Optional but highly recommended for RN Paper / generic Text components
export const Typography = {
  header: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
} as const;

export type ThemeMode = keyof typeof Colors;
export type ColorToken = keyof (typeof Colors)['light'];

export function resolveColors(colorScheme: ColorSchemeName) {
  return colorScheme === 'dark' ? Colors.dark : Colors.light;
}

export const NavigationThemes: Record<ThemeMode, Theme> = {
  light: {
    ...DefaultTheme,
    dark: false,
    colors: {
      ...DefaultTheme.colors,
      primary: Colors.light.primary,
      background: Colors.light.surface,
      card: Colors.light.surfaceContainerLow,
      text: Colors.light.text,
      border: Colors.light.ghostBorder,
      notification: Colors.light.error,
    },
  },
  dark: {
    ...DarkTheme,
    dark: true,
    colors: {
      ...DarkTheme.colors,
      primary: Colors.dark.primary,
      background: Colors.dark.surface,
      card: Colors.dark.surfaceContainerLow,
      text: Colors.dark.text,
      border: Colors.dark.ghostBorder,
      notification: Colors.dark.error,
    },
  },
};