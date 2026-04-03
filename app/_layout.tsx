import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';
import { AuthProvider, useAuth } from '../providers/AuthProvider';

function RootLayoutNav() {
  const { session, isInitialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const paperTheme =
    colorScheme === 'dark'
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
