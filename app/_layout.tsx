import { ThemeProvider } from '@react-navigation/native';
import type { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import { Colors, NavigationThemes } from '@/constants/theme';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { ThemePreferenceProvider, useAppTheme } from '@/lib/theme';

const AUTH_ROUTES = new Set(['login', 'signup']);

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <RootLayoutNavigator />
    </ThemePreferenceProvider>
  );
}

function RootLayoutNavigator() {
  const { isLoaded, resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      if (!isSupabaseConfigured) {
        if (isMounted) {
          setSession(null);
          setIsAuthReady(true);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(data.session ?? null);
      setIsAuthReady(true);
    };

    loadSession();

    if (!isSupabaseConfigured) {
      return () => {
        isMounted = false;
      };
    }

    const { data: authStateSubscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      authStateSubscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    const currentRoot = segments[0];
    const inAuthRoute = AUTH_ROUTES.has(currentRoot ?? '');
    const inTabs = currentRoot === '(tabs)';
    const isProtected = inTabs || currentRoot === 'add-edit';

    if (session && inAuthRoute) {
      router.replace('/(tabs)');
      return;
    }

    if (!session && isProtected) {
      router.replace('/login');
    }
  }, [isAuthReady, router, segments, session]);

  if (!isLoaded || !isAuthReady) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  }

  return (
    <ThemeProvider value={NavigationThemes[theme]}>
      <Stack initialRouteName="login">
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen
          name="signup"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen
          name="add-edit"
          options={{
            headerShown: false,
            presentation: 'modal',
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
