import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { CustomButton } from '../../components/ui/CustomButton';
import { Spacing, Typography } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const colors = useAppColors();

  const handleSignIn = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
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
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, Typography.body, { color: colors.textMuted }]}>
            Sign in to continue tracking your health context.
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

          {errorMsg ? (
            <Text style={[styles.errorText, Typography.caption, { color: colors.error }]}>
              {errorMsg}
            </Text>
          ) : null}

          <CustomButton 
            mode="contained" 
            onPress={handleSignIn} 
            isLoading={loading}
            style={styles.submitButton}
          >
            Sign In
          </CustomButton>

          <View style={styles.linkContainer}>
            <Text style={[Typography.body, { color: colors.textMuted }]}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/sign-up" asChild>
              <Text
                style={StyleSheet.flatten([
                  Typography.body,
                  { color: colors.primary, fontWeight: '600' },
                ])}
              >
                Sign Up
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
  errorText: {
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
