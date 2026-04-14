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

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const colors = useAppColors();

  const handleSignIn = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
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
          <AppCard style={styles.formCard} animated delay={70}>
            <View style={styles.header}>
              <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryContainer }]}> 
                <MaterialCommunityIcons name="account-heart-outline" size={22} color={colors.onPrimaryContainer} />
              </View>
              <Text variant="headlineMedium" style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
              <Text variant="bodyLarge" style={[styles.subtitle, { color: colors.textMuted }]}>Sign in to continue tracking your health.</Text>
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
                <Text variant="bodySmall" style={[styles.errorText, { color: colors.error }]}>
                  {errorMsg}
                </Text>
              ) : null}

              <CustomButton
                mode="contained"
                icon="login"
                onPress={handleSignIn}
                isLoading={loading}
                buttonColor={colors.primary}
                textColor={colors.onPrimary}
                style={styles.submitButton}
              >
                Sign In
              </CustomButton>

              <View style={styles.linkContainer}>
                <Text variant="bodyLarge" style={{ color: colors.textMuted }}>Don't have an account? </Text>
                <Link href="/(auth)/sign-up" asChild>
                  <Text
                    variant="bodyLarge"
                    style={{ color: colors.primary, fontWeight: '700' }}
                  >
                    Sign Up
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
