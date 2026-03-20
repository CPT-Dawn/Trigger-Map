import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type AppTheme = 'light' | 'dark';

type ThemeContextValue = {
  isLoaded: boolean;
  preference: ThemePreference;
  resolvedTheme: AppTheme;
  setPreference: (next: ThemePreference) => Promise<void>;
};

const STORAGE_KEY = 'trigger-map:theme-preference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const deviceTheme = useColorScheme() ?? 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('auto');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPreference = async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (isMounted && isThemePreference(stored)) {
          setPreferenceState(stored);
        }
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    };

    loadPreference();

    return () => {
      isMounted = false;
    };
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, next);
    } catch {
      // Keep app responsive even if persistence fails.
    }
  }, []);

  const resolvedTheme: AppTheme = preference === 'auto' ? deviceTheme : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      isLoaded,
      preference,
      resolvedTheme,
      setPreference,
    }),
    [isLoaded, preference, resolvedTheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemePreferenceProvider');
  }
  return context;
}
