import type { ColorSchemeName } from "react-native";

export const Colors = {
  light: {
    text: "#0F172A", // Deeper, richer black for crisp typography
    textMuted: "#64748B",
    background: "#F8FAFC", // Cleaner, cooler off-white
    surface: "#FFFFFF", // Pure white cards pop better in light mode
    surfaceBright: "#FFFFFF",
    surfaceVariant: "#F1F5F9",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F8FAFC",
    surfaceContainer: "#F1F5F9",
    surfaceContainerHigh: "#E2E8F0",
    surfaceContainerHighest: "#CBD5E1",

    // MEDICINE (Primary - Modern Indigo/Blue)
    primary: "#4338CA",
    onPrimary: "#FFFFFF",
    primaryContainer: "#E0E7FF",
    onPrimaryContainer: "#312E81",

    // FOOD (Secondary - Crisp Emerald)
    secondary: "#059669",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#D1FAE5",
    onSecondaryContainer: "#064E3B",

    // STRESS (Tertiary - Warm Amber/Orange)
    tertiary: "#D97706",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#FEF3C7",
    onTertiaryContainer: "#78350F",

    // PAIN (Error - Smooth Rose/Red)
    error: "#DC2626",
    onError: "#FFFFFF",
    errorContainer: "#FEE2E2",
    onErrorContainer: "#7F1D1D",

    outline: "#94A3B8",
    outlineVariant: "#CBD5E1",
    ghostBorder: "rgba(15, 23, 42, 0.08)", // Softer, more elegant border
    glassSurface: "rgba(255, 255, 255, 0.85)",
    acrylicBase: "rgba(255, 255, 255, 0.6)",
    acrylicElevated: "rgba(255, 255, 255, 0.8)",
    acrylicTintStrong: "rgba(255, 255, 255, 0.9)",
    acrylicTintSoft: "rgba(255, 255, 255, 0.4)",
    acrylicEdge: "rgba(255, 255, 255, 0.96)",
    gradientStart: "#EFF6FF",
    gradientEnd: "#F8FAFC",
    ambientPrimary: "rgba(67, 56, 202, 0.1)",
    ambientSecondary: "rgba(5, 150, 105, 0.1)",
    ambientTertiary: "rgba(217, 119, 6, 0.1)",
    surfaceOverlayStart: "rgba(255, 255, 255, 0.8)",
    surfaceOverlayEnd: "rgba(255, 255, 255, 0.2)",
    inputSurface: "#FFFFFF",
    dangerSoft: "rgba(220, 38, 38, 0.1)",
    chartPositive: "#059669",
    chartTrigger: "#DC2626",
    shadowAmbient: "rgba(15, 23, 42, 0.06)",
    shadowPrimaryAmbient: "rgba(67, 56, 202, 0.15)",
    tint: "#4338CA",
    icon: "#475569",
    tabIconDefault: "#94A3B8",
    tabIconSelected: "#4338CA",
  },
  dark: {
    text: "#F8FAFC", // Crisper white
    textMuted: "#94A3B8",
    background: "#0B1121", // Deep midnight blue, looks incredibly premium
    surface: "#111827",
    surfaceBright: "#1F2937",
    surfaceVariant: "#374151",
    surfaceContainerLowest: "#0B1121",
    surfaceContainerLow: "#111827",
    surfaceContainer: "#1F2937",
    surfaceContainerHigh: "#374151",
    surfaceContainerHighest: "#4B5563",

    // MEDICINE (Primary)
    primary: "#818CF8",
    onPrimary: "#0B1121",
    primaryContainer: "#312E81", // Deep indigo background for "+ Add"
    onPrimaryContainer: "#E0E7FF", // Bright icy text for "+ Add"

    // FOOD (Secondary)
    secondary: "#34D399",
    onSecondary: "#0B1121",
    secondaryContainer: "#064E3B",
    onSecondaryContainer: "#A7F3D0",

    // STRESS (Tertiary)
    tertiary: "#FBBF24",
    onTertiary: "#0B1121",
    tertiaryContainer: "#78350F",
    onTertiaryContainer: "#FDE68A",

    // PAIN (Error)
    error: "#F87171",
    onError: "#0B1121",
    errorContainer: "#7F1D1D",
    onErrorContainer: "#FECACA",

    outline: "#4B5563",
    outlineVariant: "#374151",
    ghostBorder: "rgba(255, 255, 255, 0.08)", // Perfect subtle highlight for dark cards
    glassSurface: "rgba(17, 24, 39, 0.75)", // Deep glass
    acrylicBase: "rgba(17, 24, 39, 0.6)",
    acrylicElevated: "rgba(31, 41, 55, 0.8)",
    acrylicTintStrong: "rgba(255, 255, 255, 0.1)",
    acrylicTintSoft: "rgba(255, 255, 255, 0.03)",
    acrylicEdge: "rgba(255, 255, 255, 0.15)",
    gradientStart: "#0B1121",
    gradientEnd: "#111827",
    ambientPrimary: "rgba(129, 140, 248, 0.15)",
    ambientSecondary: "rgba(52, 211, 153, 0.15)",
    ambientTertiary: "rgba(251, 191, 36, 0.1)",
    surfaceOverlayStart: "rgba(255, 255, 255, 0.05)",
    surfaceOverlayEnd: "rgba(255, 255, 255, 0.01)",
    inputSurface: "#1F2937",
    dangerSoft: "rgba(248, 113, 113, 0.15)",
    chartPositive: "#34D399",
    chartTrigger: "#F87171",
    shadowAmbient: "rgba(0, 0, 0, 0.6)",
    shadowPrimaryAmbient: "rgba(129, 140, 248, 0.25)",
    tint: "#818CF8",
    icon: "#CBD5E1",
    tabIconDefault: "#64748B",
    tabIconSelected: "#818CF8",
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

export function resolveColors(colorScheme: ColorSchemeName) {
  return colorScheme === "dark" ? Colors.dark : Colors.light;
}
