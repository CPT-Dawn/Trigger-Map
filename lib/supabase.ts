import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const env =
	(globalThis as { process?: { env?: Record<string, string | undefined> } })
		.process?.env ?? {};

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error(
		'Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.'
	);
}

const secureStoreAdapter = {
	getItem: (key: string) => SecureStore.getItemAsync(key),
	setItem: (key: string, value: string) =>
		SecureStore.setItemAsync(key, value),
	removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		storage: secureStoreAdapter,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});
