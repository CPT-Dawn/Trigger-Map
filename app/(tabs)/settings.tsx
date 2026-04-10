import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SegmentedButtons, Snackbar, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, resolveColors, Spacing, Typography } from '../../constants/theme';
import { CustomButton } from '../../components/ui/CustomButton';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { ThemePreference, useAppColors, useThemePreference } from '../../providers/ThemeProvider';

export default function SettingsScreen() {
  const colors = useAppColors();
  const { themePreference, appliedTheme, setThemePreference } = useThemePreference();
  const { user } = useAuth();

  const initialDisplayName = useMemo(
    () =>
      ((user?.user_metadata?.display_name as string | undefined) ??
      (user?.user_metadata?.full_name as string | undefined) ??
      user?.email?.split('@')[0] ??
      ''),
    [user]
  );

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const styles = useMemo(() => createStyles(colors), [colors]);

  const userEmail = user?.email ?? 'No email found';
  const trimmedDisplayName = displayName.trim();
  const canSaveProfile =
    trimmedDisplayName.length > 0 && trimmedDisplayName !== initialDisplayName && !isSavingProfile;

  const openSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!canSaveProfile) return;

    try {
      setIsSavingProfile(true);

      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: trimmedDisplayName,
        },
      });

      if (error) {
        openSnackbar(error.message || 'Unable to save profile right now.');
        return;
      }

      openSnackbar('Profile updated successfully.');
    } catch {
      openSnackbar('Something went wrong while updating your profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        openSnackbar(error.message || 'Unable to log out right now.');
      }
    } catch {
      openSnackbar('Something went wrong while logging out.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const themeHelperText =
    themePreference === 'auto'
      ? 'Match your device appearance settings.'
      : themePreference === 'light'
        ? 'Always use the light appearance.'
        : 'Always use the dark appearance.';

  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: 'auto', label: 'Auto' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  const activeTheme = appliedTheme;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundAccentTop} />
      <View style={styles.backgroundAccentBottom} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={[Typography.header, styles.sectionTitle]}>Profile</Text>

          <View style={styles.profileRow}>
            <View style={[styles.profileAvatar, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.profileAvatarLabel, { color: colors.onPrimaryContainer }]}>TM</Text>
            </View>
            <View style={styles.profileMeta}>
              <Text style={[Typography.title, styles.profileName]} numberOfLines={1}>
                {trimmedDisplayName || 'Set your name'}
              </Text>
              <Text style={[Typography.body, styles.profileEmail]} numberOfLines={1}>
                {userEmail}
              </Text>
            </View>
          </View>

          <Text style={[Typography.label, styles.inputLabel]}>Display name</Text>
          <CustomTextInput
            mode="outlined"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            autoCapitalize="words"
            style={styles.input}
          />

          <CustomButton
            mode="outlined"
            icon="content-save-outline"
            onPress={handleSaveProfile}
            isLoading={isSavingProfile}
            disabled={!canSaveProfile}
            style={styles.saveButton}
            textColor={colors.text}
          >
            Save Profile
          </CustomButton>
        </View>

        <View style={styles.card}>
          <Text style={[Typography.header, styles.sectionTitle]}>Theme</Text>
          <Text style={[Typography.body, styles.sectionBody]}>
            Choose how Trigger Map appears across your devices.
          </Text>

          <SegmentedButtons
            value={themePreference}
            onValueChange={(value) => {
              if (value === 'auto' || value === 'light' || value === 'dark') {
                void setThemePreference(value);
              }
            }}
            density="small"
            style={styles.segmentedRoot}
            buttons={themeOptions.map((option) => ({
              value: option.value,
              label: option.label,
              showSelectedCheck: false,
              style: styles.segmentedButton,
            }))}
            theme={{
              colors: {
                secondaryContainer: colors.primaryContainer,
                onSecondaryContainer: colors.onPrimaryContainer,
                outline: colors.ghostBorder,
              },
            }}
          />

          <Text style={[Typography.caption, styles.themeHint]}>
            {themeHelperText} Current preview: {activeTheme} mode.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={[Typography.header, styles.sectionTitle]}>Account</Text>
          <Text style={[Typography.body, styles.sectionBody]}>
            Log out to switch your account.
          </Text>

          <CustomButton
            mode="outlined"
            icon="logout"
            onPress={handleSignOut}
            isLoading={isSigningOut}
            style={styles.logoutButton}
            textColor={colors.error}
          >
            Log Out
          </CustomButton>
        </View>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3200}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof resolveColors>) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  backgroundAccentTop: {
    position: 'absolute',
    top: -Spacing.xxl,
    left: -Spacing.xxl,
    width: 220,
    height: 220,
    borderRadius: Radius.full,
    backgroundColor: colors.primaryContainer,
    opacity: 0.18,
  },
  backgroundAccentBottom: {
    position: 'absolute',
    bottom: -Spacing.xxl,
    right: -Spacing.xxl,
    width: 260,
    height: 260,
    borderRadius: Radius.full,
    backgroundColor: colors.secondaryContainer,
    opacity: 0.14,
  },
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.ghostBorder,
    shadowColor: colors.shadowAmbient,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 2,
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
  },
  sectionBody: {
    color: colors.textMuted,
    marginBottom: Spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarLabel: {
    fontWeight: '700',
    fontSize: Typography.title.fontSize,
  },
  profileMeta: {
    marginLeft: Spacing.md,
    flex: 1,
    gap: Spacing.xs,
  },
  profileName: {
    color: colors.text,
  },
  profileEmail: {
    color: colors.textMuted,
  },
  inputLabel: {
    color: colors.text,
    marginBottom: Spacing.xs,
  },
  input: {
    marginBottom: 0,
  },
  saveButton: {
    marginTop: Spacing.xs,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
  },
  segmentedRoot: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: Radius.xl,
  },
  segmentedButton: {
    minHeight: 48,
  },
  themeHint: {
    color: colors.textMuted,
    marginTop: Spacing.sm,
  },
  logoutButton: {
    marginTop: Spacing.sm,
    borderColor: colors.error,
    backgroundColor: colors.surfaceContainer,
  },
  snackbar: {
    backgroundColor: colors.surfaceContainerHigh,
  }
});
