import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useState } from 'react';

import { AuthDivider, AuthField, AuthPrimaryButton, AuthSocialButton } from '@/components/auth/auth-controls';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Colors } from '@/constants/theme';

export default function SignupScreen() {
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleCreateAccount = () => {
    // TODO: replace with supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
    if (!fullName || !email || !password) {
      Alert.alert('Missing info', 'Fill all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    Alert.alert('Account Created', 'Hook this action to Supabase sign up.');
    router.replace('/(tabs)');
  };

  const handleGoogleSignup = () => {
    // TODO: replace with supabase.auth.signInWithOAuth({ provider: 'google' })
    Alert.alert('Google Auth', 'Connect this action to Supabase Google OAuth.');
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Set up your profile and start tracking with intention."
      bottomContent={
        <View style={styles.bottomRow}>
          <Text style={[styles.bottomText, { color: colors.textMuted }]}>Already have an account?</Text>
          <Pressable onPress={() => router.push('/login')}>
            <Text style={[styles.bottomAction, { color: colors.primary }]}>Log In</Text>
          </Pressable>
        </View>
      }>
      <AuthField
        autoCapitalize="words"
        autoComplete="name"
        label="Full Name"
        placeholder="Enter your full name"
        returnKeyType="next"
        value={fullName}
        onChangeText={setFullName}
      />
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
      <AuthField
        autoCapitalize="none"
        autoComplete="password-new"
        label="Password"
        placeholder="Create a password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <AuthField
        autoCapitalize="none"
        autoComplete="password-new"
        label="Confirm Password"
        placeholder="Re-enter password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <AuthPrimaryButton title="Create Account" onPress={handleCreateAccount} />

      <AuthDivider label="or continue with" />

      <View style={styles.socialGrid}>
        <AuthSocialButton iconName="logo-google" label="Google" onPress={handleGoogleSignup} />
        <AuthSocialButton iconName="call-outline" label="Phone" onPress={() => router.push('/phone-auth')} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
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
