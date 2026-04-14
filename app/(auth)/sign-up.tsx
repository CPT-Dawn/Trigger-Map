import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { AppCard } from '../../components/ui/AppCard';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { CustomButton } from '../../components/ui/CustomButton';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const colors = useAppColors();

  const handleSignUp = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password || !confirmPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const { error, data } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
    } else if (data.session == null) {
      setSuccessMsg('Account created! Please check your email to verify your account.');
    }
    
    setLoading(false);
  };

  return (
    <ScreenWrapper style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <AppCard style={styles.formCard} animated delay={90}>
            <View style={styles.header}>
              <View style={[styles.headerIconWrap, { backgroundColor: colors.secondaryContainer }]}> 
                <MaterialCommunityIcons name="account-plus-outline" size={22} color={colors.onSecondaryContainer} />
              </View>
              <Text variant="headlineMedium" style={[styles.title, { color: colors.text }]}>Create Account</Text>
              <Text variant="bodyLarge" style={[styles.subtitle, { color: colors.textMuted }]}>Join Trigger-Map to start tracking your health.</Text>
            </View>

            <View style={styles.formContainer}>
              <CustomTextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />

              <CustomTextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <CustomTextInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              {errorMsg ? (
                <Text variant="bodySmall" style={[styles.feedbackText, { color: colors.error }]}>
                  {errorMsg}
                </Text>
              ) : null}

              {successMsg ? (
                <Text variant="bodySmall" style={[styles.feedbackText, { color: colors.primary }]}>
                  {successMsg}
                </Text>
              ) : null}

              <CustomButton
                mode="contained"
                icon="account-plus"
                onPress={handleSignUp}
                isLoading={loading}
                buttonColor={colors.primary}
                textColor={colors.onPrimary}
                style={styles.submitButton}
              >
                Sign Up
              </CustomButton>

              <View style={styles.linkContainer}>
                <Text variant="bodyLarge" style={{ color: colors.textMuted }}>Already have an account? </Text>
                <Link href="/(auth)/sign-in" asChild>
                  <Text
                    variant="bodyLarge"
                    style={{ color: colors.primary, fontWeight: '700' }}
                  >
                    Sign In
                  </Text>
                </Link>
              </View>
            </View>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  formCard: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '800',
  },
  subtitle: {
    opacity: 0.9,
  },
  formContainer: {
    width: '100%',
  },
  feedbackText: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    textAlign: 'left',
  },
  submitButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
