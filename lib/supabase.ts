import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseConfigError =
  'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';

if (!isSupabaseConfigured) {
  // Keep development feedback explicit; auth calls still guard against this.
  console.warn(supabaseConfigError);
}

/**
 * Supabase session payloads can exceed SecureStore limits (~2KB),
 * so we persist sessions in AsyncStorage.
 * We still read legacy SecureStore entries once and migrate them.
 */
const authStorage = {
  getItem: async (key: string) => {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      return value;
    }

    try {
      const legacyValue = await SecureStore.getItemAsync(key);
      if (legacyValue !== null) {
        await AsyncStorage.setItem(key, legacyValue);
        await SecureStore.deleteItemAsync(key);
      }
      return legacyValue;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore legacy cleanup failures.
    }
  },
};

export const supabase = createClient(supabaseUrl ?? 'https://invalid.local', supabaseAnonKey ?? 'invalid-key', {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
