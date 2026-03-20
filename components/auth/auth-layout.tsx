import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  bottomContent?: ReactNode;
}>;

export function AuthLayout({ title, subtitle, bottomContent, children }: AuthLayoutProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <View style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.glowPrimary,
            {
              backgroundColor: theme === 'dark' ? 'rgba(186, 195, 255, 0.08)' : 'rgba(3, 22, 50, 0.05)',
            },
          ]}
        />
        <View
          style={[
            styles.glowSecondary,
            {
              backgroundColor: theme === 'dark' ? 'rgba(102, 217, 204, 0.07)' : 'rgba(0, 104, 118, 0.06)',
            },
          ]}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: Math.max(insets.bottom, 20) + 20,
            },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <Text style={[styles.brand, { color: colors.primary }]}>Trigger Map</Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.ghostBorder,
                shadowColor: colors.primary,
              },
            ]}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>

            <View style={styles.formWrap}>{children}</View>
          </View>

          {bottomContent ? <View style={styles.bottomWrap}>{bottomContent}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  brandWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  card: {
    borderRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
    elevation: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  formWrap: {
    gap: 14,
  },
  bottomWrap: {
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 12,
  },
  glowPrimary: {
    borderRadius: 999,
    height: 220,
    position: 'absolute',
    left: -80,
    top: -60,
    width: 220,
  },
  glowSecondary: {
    borderRadius: 999,
    height: 260,
    position: 'absolute',
    right: -120,
    bottom: -100,
    width: 260,
  },
});
