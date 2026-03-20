import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useState } from 'react';

import { AuthDivider, AuthField, AuthPrimaryButton, AuthSocialButton } from '@/components/auth/auth-controls';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Colors } from '@/constants/theme';
import { signUpWithEmail } from '@/lib/auth';

export default function SignupScreen() {
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isSubmitting;

  const handleCreateAccount = async () => {
    if (isBusy) return;
    setIsSubmitting(true);

    const result = await signUpWithEmail({
      fullName,
      email,
      password,
      confirmPassword,
    });

    setIsSubmitting(false);

    if (result.error) {
      Alert.alert('Sign Up Failed', result.error);
      return;
    }

    if (!result.data) {
      Alert.alert('Sign Up Failed', 'No response returned from sign-up flow.');
      return;
    }

    if (result.data.needsEmailConfirmation) {
      Alert.alert('Verify Your Email', 'Check your inbox, then return to log in.');
      router.replace('/login');
      return;
    }

    router.replace('/(tabs)');
  };

  const handleGoogleSignup = () => {
    Alert.alert('Coming Soon', 'Google sign-up is coming soon. Please use email sign-up for now.');
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Set up your profile and start tracking with intention."
      bottomContent={
        <View style={styles.bottomRow}>
          <Text style={[styles.bottomText, { color: colors.textMuted }]}>Already have an account?</Text>
          <Pressable disabled={isBusy} onPress={() => router.push('/login')}>
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
        editable={!isBusy}
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
        editable={!isBusy}
        onChangeText={setEmail}
      />
      <AuthField
        autoCapitalize="none"
        autoComplete="password-new"
        label="Password"
        placeholder="Create a password"
        secureTextEntry
        value={password}
        editable={!isBusy}
        onChangeText={setPassword}
      />
      <AuthField
        autoCapitalize="none"
        autoComplete="password-new"
        label="Confirm Password"
        placeholder="Re-enter password"
        secureTextEntry
        value={confirmPassword}
        editable={!isBusy}
        onChangeText={setConfirmPassword}
      />

      <AuthPrimaryButton
        disabled={isBusy}
        loading={isSubmitting}
        title="Create Account"
        onPress={handleCreateAccount}
      />

      <AuthDivider label="or continue with" />

      <View style={styles.socialGrid}>
        <AuthSocialButton
          disabled={isBusy}
          iconName="logo-google"
          label="Google"
          onPress={handleGoogleSignup}
        />
        <AuthSocialButton
          disabled={isBusy}
          iconName="call-outline"
          label="Phone"
          onPress={() =>
            Alert.alert('Coming Soon', 'Phone sign-up is coming soon. Please use email sign-up for now.')
          }
        />
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
