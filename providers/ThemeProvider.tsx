import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { resolveColors } from '../constants/theme';

export type ThemePreference = 'auto' | 'light' | 'dark';

interface ThemeContextValue {
  themePreference: ThemePreference;
  appliedTheme: 'light' | 'dark';
  setThemePreference: (nextPreference: ThemePreference) => Promise<void>;
}

const THEME_PREFERENCE_KEY = 'theme_preference';

const ThemeContext = createContext<ThemeContextValue>({
  themePreference: 'auto',
  appliedTheme: 'light',
  setThemePreference: async () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme = useColorScheme();
  const normalizedDeviceTheme: 'light' | 'dark' = deviceScheme === 'dark' ? 'dark' : 'light';
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('auto');

  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const storedValue = await SecureStore.getItemAsync(THEME_PREFERENCE_KEY);

        if (storedValue === 'auto' || storedValue === 'light' || storedValue === 'dark') {
          setThemePreferenceState(storedValue);
        }
      } catch {
        // Keep auto mode if persisted preference cannot be read.
      }
    };

    loadThemePreference();
  }, []);

  const appliedTheme = themePreference === 'auto' ? normalizedDeviceTheme : themePreference;

  const setThemePreference = async (nextPreference: ThemePreference) => {
    setThemePreferenceState(nextPreference);

    try {
      await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, nextPreference);
    } catch {
      // UI state still updates even if persistence fails.
    }
  };

  const value = useMemo(
    () => ({
      themePreference,
      appliedTheme,
      setThemePreference,
    }),
    [themePreference, appliedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  return useContext(ThemeContext);
}

export function useAppColors() {
  const { appliedTheme } = useThemePreference();
  return resolveColors(appliedTheme);
}
