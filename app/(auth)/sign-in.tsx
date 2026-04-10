import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { CustomButton } from '../../components/ui/CustomButton';
import { Radius, Spacing, Typography } from '../../constants/theme';
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
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.accentOrbTop, { backgroundColor: colors.primaryContainer }]} />
      <View style={[styles.accentOrbBottom, { backgroundColor: colors.secondaryContainer }]} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.formCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.ghostBorder }]}> 
          <View style={styles.header}>
            <Text style={[styles.title, Typography.header, { color: colors.text }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, Typography.body, { color: colors.textMuted }]}>Sign in to continue tracking your health context.</Text>
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
              <Text style={[Typography.body, { color: colors.textMuted }]}>Don't have an account? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <Text
                  style={StyleSheet.flatten([
                    Typography.body,
                    { color: colors.primary, fontWeight: '700' },
                  ])}
                >
                  Sign Up
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
    opacity: 0.22,
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
  errorText: {
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
