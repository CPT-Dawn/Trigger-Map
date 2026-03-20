import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';

import { AuthField, AuthPrimaryButton } from '@/components/auth/auth-controls';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Colors } from '@/constants/theme';
import { resendPhoneOtp, verifyPhoneOtp } from '@/lib/auth';

export default function PhoneVerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(30);

  useEffect(() => {
    if (!phone) {
      router.replace('/phone-auth');
    }
  }, [phone, router]);

  useEffect(() => {
    if (resendCountdown <= 0) return;

    const interval = setInterval(() => {
      setResendCountdown((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCountdown]);

  const handleVerify = async () => {
    if (isVerifying || isResending) return;
    if (!phone) {
      Alert.alert('Phone Missing', 'Phone number is missing. Start verification again.');
      return;
    }

    setIsVerifying(true);
    const result = await verifyPhoneOtp(phone, otp);
    setIsVerifying(false);

    if (result.error) {
      Alert.alert('Verification Failed', result.error);
      return;
    }

    router.replace('/(tabs)');
  };

  const handleResend = async () => {
    if (isVerifying || isResending || resendCountdown > 0) return;
    if (!phone) {
      Alert.alert('Phone Missing', 'Phone number is missing. Start verification again.');
      return;
    }

    setIsResending(true);
    const result = await resendPhoneOtp(phone);
    setIsResending(false);

    if (result.error) {
      Alert.alert('Resend Failed', result.error);
      return;
    }

    setResendCountdown(30);
    Alert.alert('Code Sent', 'A new verification code has been sent.');
  };

  return (
    <AuthLayout
      title="Verify Code"
      subtitle={`Enter the one-time code sent to ${phone ?? 'your phone number'}.`}
      bottomContent={
        <View style={styles.bottomWrap}>
          <Pressable
            disabled={isVerifying || isResending || resendCountdown > 0}
            onPress={handleResend}>
            <Text style={[styles.bottomAction, { color: colors.primary }]}>
              {isResending
                ? 'Resending...'
                : resendCountdown > 0
                  ? `Resend Code in ${resendCountdown}s`
                  : 'Resend Code'}
            </Text>
          </Pressable>
          <Pressable disabled={isVerifying || isResending} onPress={() => router.push('/phone-auth')}>
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
        editable={!isVerifying && !isResending}
        onChangeText={setOtp}
      />

      <AuthPrimaryButton
        disabled={isVerifying || isResending}
        loading={isVerifying}
        title="Verify and Continue"
        onPress={handleVerify}
      />
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
