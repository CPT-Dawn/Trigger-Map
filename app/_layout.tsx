import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
} from '@expo-google-fonts/sora';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { Colors } from '../constants/theme';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { ThemeProvider, useThemePreference } from '../providers/ThemeProvider';

function RootLayoutNav() {
  const { session, isInitialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { appliedTheme } = useThemePreference();

  const baseTheme = appliedTheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const resolvedColors = appliedTheme === 'dark' ? Colors.dark : Colors.light;

  const paperTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      ...resolvedColors,
    },
    fonts: {
      ...baseTheme.fonts,
      displayLarge: { ...baseTheme.fonts.displayLarge, fontFamily: 'Sora_700Bold' },
      displayMedium: { ...baseTheme.fonts.displayMedium, fontFamily: 'Sora_700Bold' },
      displaySmall: { ...baseTheme.fonts.displaySmall, fontFamily: 'Sora_600SemiBold' },
      headlineLarge: { ...baseTheme.fonts.headlineLarge, fontFamily: 'Sora_700Bold' },
      headlineMedium: { ...baseTheme.fonts.headlineMedium, fontFamily: 'Sora_600SemiBold' },
      headlineSmall: { ...baseTheme.fonts.headlineSmall, fontFamily: 'Sora_600SemiBold' },
      titleLarge: { ...baseTheme.fonts.titleLarge, fontFamily: 'Sora_600SemiBold' },
      titleMedium: { ...baseTheme.fonts.titleMedium, fontFamily: 'Sora_600SemiBold' },
      titleSmall: { ...baseTheme.fonts.titleSmall, fontFamily: 'Sora_500Medium' },
      labelLarge: { ...baseTheme.fonts.labelLarge, fontFamily: 'Manrope_700Bold' },
      labelMedium: { ...baseTheme.fonts.labelMedium, fontFamily: 'Manrope_600SemiBold' },
      labelSmall: { ...baseTheme.fonts.labelSmall, fontFamily: 'Manrope_600SemiBold' },
      bodyLarge: { ...baseTheme.fonts.bodyLarge, fontFamily: 'Manrope_500Medium' },
      bodyMedium: { ...baseTheme.fonts.bodyMedium, fontFamily: 'Manrope_400Regular' },
      bodySmall: { ...baseTheme.fonts.bodySmall, fontFamily: 'Manrope_400Regular' },
      default: { ...baseTheme.fonts.default, fontFamily: 'Manrope_500Medium' },
    },
  };

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Redirect unauthenticated users to the sign-in page
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      // Redirect authenticated users to the main tabs if they are on an auth screen
      router.replace('/(tabs)');
    }
  }, [session, isInitialized, segments]);

  return (
    <PaperProvider theme={paperTheme}>
      <BottomSheetModalProvider>
        <View style={styles.root}>
          <StatusBar style={appliedTheme === 'dark' ? 'light' : 'dark'} backgroundColor="transparent" translucent />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </View>
      </BottomSheetModalProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={styles.root}>
        <ThemeProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
