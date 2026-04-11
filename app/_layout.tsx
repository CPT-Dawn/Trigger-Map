import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { ThemeProvider, useThemePreference } from '../providers/ThemeProvider';

function RootLayoutNav() {
  const { session, isInitialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { appliedTheme } = useThemePreference();

  const paperTheme =
    appliedTheme === 'dark'
      ? { ...MD3DarkTheme, colors: { ...MD3DarkTheme.colors, ...Colors.dark } }
      : { ...MD3LightTheme, colors: { ...MD3LightTheme.colors, ...Colors.light } };

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
      <View style={styles.root}>
        <StatusBar style={appliedTheme === 'dark' ? 'light' : 'dark'} backgroundColor="transparent" translucent />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </View>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
