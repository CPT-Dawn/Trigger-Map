import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useState } from 'react';

import { AuthDivider, AuthField, AuthPrimaryButton, AuthSocialButton } from '@/components/auth/auth-controls';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Colors } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailLogin = () => {
    // TODO: replace with supabase.auth.signInWithPassword({ email, password })
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter both email and password.');
      return;
    }
    router.replace('/(tabs)');
  };

  const handleGoogleLogin = () => {
    // TODO: replace with supabase.auth.signInWithOAuth({ provider: 'google' })
    Alert.alert('Google Auth', 'Connect this action to Supabase Google OAuth.');
  };

  const handlePhoneLogin = () => {
    router.push('/phone-auth');
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Log in to continue your restorative journey."
      bottomContent={
        <View style={styles.bottomRow}>
          <Text style={[styles.bottomText, { color: colors.textMuted }]}>Don&apos;t have an account?</Text>
          <Pressable onPress={() => router.push('/signup')}>
            <Text style={[styles.bottomAction, { color: colors.primary }]}>Sign Up</Text>
          </Pressable>
        </View>
      }>
      <AuthField
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        label="Email Address"
        placeholder="name@example.com"
        returnKeyType="next"
        value={email}
        onChangeText={setEmail}
      />

      <View style={styles.passwordHeader}>
        <Text style={[styles.passwordLabel, { color: colors.textMuted }]}>Password</Text>
        <Pressable onPress={() => Alert.alert('Forgot Password', 'Add Supabase reset flow here.')}>
          <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot Password?</Text>
        </Pressable>
      </View>

      <AuthField
        autoCapitalize="none"
        autoComplete="password"
        label=""
        placeholder="Enter your password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <AuthPrimaryButton title="Log In" onPress={handleEmailLogin} />

      <AuthDivider label="or continue with" />

      <View style={styles.socialGrid}>
        <AuthSocialButton iconName="logo-google" label="Google" onPress={handleGoogleLogin} />
        <AuthSocialButton iconName="call-outline" label="Phone" onPress={handlePhoneLogin} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  passwordHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: -6,
    paddingHorizontal: 2,
  },
  passwordLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '700',
  },
  socialGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  bottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  bottomText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomAction: {
    fontSize: 14,
    fontWeight: '800',
  },
});
