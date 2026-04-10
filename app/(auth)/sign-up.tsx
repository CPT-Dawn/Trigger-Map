import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { CustomButton } from '../../components/ui/CustomButton';
import { Spacing, Typography } from '../../constants/theme';
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
      style={[{ backgroundColor: colors.background }, styles.container]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, Typography.header, { color: colors.primary }]}>
            Create Account
          </Text>
          <Text style={[styles.subtitle, Typography.body, { color: colors.textMuted }]}>
            Join Trigger-Map to start logging your health context.
          </Text>
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
            <Text style={[Typography.body, { color: colors.textMuted }]}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Text
                style={StyleSheet.flatten([
                  Typography.body,
                  { color: colors.primary, fontWeight: '600' },
                ])}
              >
                Sign In
              </Text>
            </Link>
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
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    marginBottom: Spacing.xxl,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    opacity: 0.8,
  },
  formContainer: {
    width: '100%',
  },
  feedbackText: {
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
