import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SegmentedButtons, Snackbar, Text } from 'react-native-paper';
import { Radius, resolveColors, Spacing } from '../../constants/theme';
import { CustomButton } from '../../components/ui/CustomButton';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { ProfileInitialAvatar } from '../../components/ui/ProfileInitialAvatar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { ThemePreference, useAppColors, useThemePreference } from '../../providers/ThemeProvider';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';

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

  useEffect(() => {
    setDisplayName(initialDisplayName);
  }, [initialDisplayName]);

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

  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: 'auto', label: 'Auto' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  const activeTheme = appliedTheme;

  return (
    <ScreenWrapper>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text variant="headlineSmall" style={styles.sectionTitle}>Profile</Text>

          <View style={styles.profileRow}>
            <ProfileInitialAvatar name={displayName} size={60} />
            <View style={styles.profileMeta}>
              <Text variant="titleMedium" style={styles.profileName} numberOfLines={1}>
                {trimmedDisplayName || 'Set your name'}
              </Text>
              <Text variant="bodyMedium" style={styles.profileEmail} numberOfLines={1}>
                {userEmail}
              </Text>
            </View>
          </View>

          <Text variant="labelLarge" style={styles.inputLabel}>Display name</Text>
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
          <Text variant="headlineSmall" style={styles.sectionTitle}>Theme</Text>
          <Text variant="bodyMedium" style={styles.sectionBody}>
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
        </View>

        <View style={styles.card}>
          <Text variant="headlineSmall" style={styles.sectionTitle}>Account</Text>
          <Text variant="bodyMedium" style={styles.sectionBody}>
            Log out to switch your account.
          </Text>

          <CustomButton
            mode="contained"
            icon="logout"
            onPress={handleSignOut}
            isLoading={isSigningOut}
            buttonColor={colors.errorContainer}
            textColor={colors.onErrorContainer}
            style={styles.logoutButton}
          >
            Log Out
          </CustomButton>
        </View>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ backgroundColor: colors.surfaceContainerHighest }}
        theme={{ colors: { onSurface: colors.text } }}
      >
        {snackbarMessage}
      </Snackbar>
    </ScreenWrapper>
  );
}

const createStyles = (colors: ReturnType<typeof resolveColors>) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxxl * 2 + Spacing.lg,
      gap: Spacing.xl,
    },
    card: {
      backgroundColor: colors.glassSurface,
      borderColor: colors.ghostBorder,
      borderWidth: 1,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
    },
    sectionTitle: {
      color: colors.text,
      marginBottom: Spacing.md,
      fontWeight: '700',
    },
    sectionBody: {
      color: colors.textMuted,
      marginBottom: Spacing.lg,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    profileMeta: {
      flex: 1,
      gap: Spacing.xs,
    },
    profileName: {
      fontWeight: '700',
      color: colors.text,
    },
    profileEmail: {
      color: colors.textMuted,
    },
    inputLabel: {
      color: colors.textMuted,
      marginBottom: Spacing.xs,
      marginLeft: Spacing.xs,
    },
    input: {
      marginBottom: Spacing.lg,
      backgroundColor: 'transparent',
    },
    saveButton: {
      marginTop: Spacing.md,
    },
    segmentedRoot: {
      marginBottom: Spacing.lg,
    },
    segmentedButton: {
      borderColor: colors.ghostBorder,
    },
    themeHint: {
      color: colors.textMuted,
      textAlign: 'center',
    },
    logoutButton: {
      marginTop: Spacing.sm,
    },
  });
