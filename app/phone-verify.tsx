import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useState } from 'react';

import { AuthField, AuthPrimaryButton } from '@/components/auth/auth-controls';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Colors } from '@/constants/theme';

export default function PhoneVerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [otp, setOtp] = useState('');

  const handleVerify = () => {
    if (otp.length < 4) {
      Alert.alert('Invalid code', 'Enter the OTP code sent to your phone.');
      return;
    }
    // TODO: replace with supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })
    router.replace('/(tabs)');
  };

  return (
    <AuthLayout
      title="Verify Code"
      subtitle={`Enter the one-time code sent to ${phone ?? 'your phone number'}.`}
      bottomContent={
        <View style={styles.bottomWrap}>
          <Pressable onPress={() => Alert.alert('Resend Code', 'Connect this to Supabase OTP resend.')}>
            <Text style={[styles.bottomAction, { color: colors.primary }]}>Resend Code</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/phone-auth')}>
            <Text style={[styles.bottomSecondary, { color: colors.textMuted }]}>Change Number</Text>
          </Pressable>
        </View>
      }>
      <AuthField
        keyboardType="number-pad"
        label="Verification Code"
        maxLength={6}
        placeholder="Enter 6-digit code"
        value={otp}
        onChangeText={setOtp}
      />

      <AuthPrimaryButton title="Verify and Continue" onPress={handleVerify} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  bottomWrap: {
    alignItems: 'center',
    gap: 8,
  },
  bottomAction: {
    fontSize: 14,
    fontWeight: '800',
  },
  bottomSecondary: {
    fontSize: 13,
    fontWeight: '600',
  },
});
