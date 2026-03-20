import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { AuthDivider, AuthField, AuthPrimaryButton, AuthSocialButton } from '@/components/auth/auth-controls';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Colors } from '@/constants/theme';
import { sendPasswordResetEmail, signInWithEmail } from '@/lib/auth';
import { useAppTheme } from '@/lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  const isBusy = isSubmitting || isResetLoading;

  const handleEmailLogin = async () => {
    if (isBusy) return;
    setIsSubmitting(true);

    const result = await signInWithEmail(email, password);

    setIsSubmitting(false);

    if (result.error) {
      Alert.alert('Log In Failed', result.error);
      return;
    }

    router.replace('/(tabs)');
  };

  const handleGoogleLogin = () => {
    Alert.alert('Coming Soon', 'Google sign-in is coming soon. Please use email login for now.');
  };

  const handlePhoneLogin = () => {
    Alert.alert('Coming Soon', 'Phone sign-in is coming soon. Please use email login for now.');
  };

  const handleForgotPassword = async () => {
    if (isBusy) return;
    setIsResetLoading(true);

    const result = await sendPasswordResetEmail(email);

    setIsResetLoading(false);

    if (result.error) {
      Alert.alert('Reset Failed', result.error);
      return;
    }

    Alert.alert('Check Your Email', 'Password reset instructions have been sent.');
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Log in to continue your restorative journey."
      bottomContent={
        <View style={styles.bottomRow}>
          <Text style={[styles.bottomText, { color: colors.textMuted }]}>Don&apos;t have an account?</Text>
          <Pressable disabled={isBusy} onPress={() => router.push('/signup')}>
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
        editable={!isBusy}
        onChangeText={setEmail}
      />

      <View style={styles.passwordHeader}>
        <Text style={[styles.passwordLabel, { color: colors.textMuted }]}>Password</Text>
        <Pressable disabled={isBusy} onPress={handleForgotPassword}>
          <Text style={[styles.forgotText, { color: colors.primary }]}>
            {isResetLoading ? 'Sending...' : 'Forgot Password?'}
          </Text>
        </Pressable>
      </View>

      <AuthField
        autoCapitalize="none"
        autoComplete="password"
        label=""
        placeholder="Enter your password"
        secureTextEntry
        value={password}
        editable={!isBusy}
        onChangeText={setPassword}
      />

      <AuthPrimaryButton disabled={isBusy} loading={isSubmitting} title="Log In" onPress={handleEmailLogin} />

      <AuthDivider label="or continue with" />

      <View style={styles.socialGrid}>
        <AuthSocialButton
          disabled={isBusy}
          iconName="logo-google"
          label="Google"
          onPress={handleGoogleLogin}
        />
        <AuthSocialButton disabled={isBusy} iconName="call-outline" label="Phone" onPress={handlePhoneLogin} />
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
