import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useState } from 'react';

import { AuthField, AuthPrimaryButton } from '@/components/auth/auth-controls';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Colors } from '@/constants/theme';

export default function PhoneAuthScreen() {
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [phone, setPhone] = useState('');

  const handleSendCode = () => {
    if (!phone) {
      Alert.alert('Missing phone number', 'Enter your phone number to continue.');
      return;
    }
    // TODO: replace with supabase.auth.signInWithOtp({ phone })
    router.push({
      pathname: '/phone-verify',
      params: { phone },
    });
  };

  return (
    <AuthLayout
      title="Phone Sign In"
      subtitle="Use OTP verification for quick and secure access."
      bottomContent={
        <View style={styles.bottomRow}>
          <Text style={[styles.bottomText, { color: colors.textMuted }]}>Prefer email login?</Text>
          <Pressable onPress={() => router.push('/login')}>
            <Text style={[styles.bottomAction, { color: colors.primary }]}>Back to Login</Text>
          </Pressable>
        </View>
      }>
      <AuthField
        autoComplete="tel"
        keyboardType="phone-pad"
        label="Phone Number"
        placeholder="+1 555 123 4567"
        value={phone}
        onChangeText={setPhone}
      />

      <AuthPrimaryButton title="Send Verification Code" onPress={handleSendCode} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
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
