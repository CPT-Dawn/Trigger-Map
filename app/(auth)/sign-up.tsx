import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { CustomButton } from '../../components/ui/CustomButton';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const colors = useAppColors();

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      setErrorMsg('Please fill in all fields.');
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
      email,
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
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.accentOrbTop, { backgroundColor: colors.secondaryContainer }]} />
      <View style={[styles.accentOrbBottom, { backgroundColor: colors.primaryContainer }]} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.formCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.ghostBorder }]}> 
          <View style={styles.header}>
            <Text style={[styles.title, Typography.header, { color: colors.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, Typography.body, { color: colors.textMuted }]}>Join Trigger-Map to start logging your health context.</Text>
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
              <Text style={[styles.feedbackText, Typography.caption, { color: colors.error }]}>
                {errorMsg}
              </Text>
            ) : null}

            {successMsg ? (
              <Text style={[styles.feedbackText, Typography.caption, { color: colors.primary }]}>
                {successMsg}
              </Text>
            ) : null}

            <CustomButton
              mode="contained"
              onPress={handleSignUp}
              isLoading={loading}
              style={styles.submitButton}
            >
              Sign Up
            </CustomButton>

            <View style={styles.linkContainer}>
              <Text style={[Typography.body, { color: colors.textMuted }]}>Already have an account? </Text>
              <Link href="/(auth)/sign-in" asChild>
                <Text
                  style={StyleSheet.flatten([
                    Typography.body,
                    { color: colors.primary, fontWeight: '700' },
                  ])}
                >
                  Sign In
                </Text>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  accentOrbTop: {
    position: 'absolute',
    top: -80,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: Radius.full,
    opacity: 0.2,
  },
  accentOrbBottom: {
    position: 'absolute',
    bottom: -90,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: Radius.full,
    opacity: 0.16,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  formCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.sm,
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
