import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useState } from 'react';

import { AuthField, AuthPrimaryButton } from '@/components/auth/auth-controls';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Colors } from '@/constants/theme';
import { sendPhoneOtp } from '@/lib/auth';

export default function PhoneAuthScreen() {
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendCode = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const result = await sendPhoneOtp(phone);

    setIsSubmitting(false);

    if (result.error) {
      Alert.alert('Could Not Send Code', result.error);
      return;
    }

    if (!result.data) {
      Alert.alert('Could Not Send Code', 'No response returned from OTP flow.');
      return;
    }

    router.push({
      pathname: '/phone-verify',
      params: { phone: result.data.normalizedPhone },
    });
  };

  return (
    <AuthLayout
      title="Phone Sign In"
      subtitle="Use OTP verification for quick and secure access."
      bottomContent={
        <View style={styles.bottomRow}>
          <Text style={[styles.bottomText, { color: colors.textMuted }]}>Prefer email login?</Text>
          <Pressable disabled={isSubmitting} onPress={() => router.push('/login')}>
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
        editable={!isSubmitting}
        onChangeText={setPhone}
      />

      <AuthPrimaryButton
        disabled={isSubmitting}
        loading={isSubmitting}
        title="Send Verification Code"
        onPress={handleSendCode}
      />
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
