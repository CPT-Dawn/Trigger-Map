import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { resolveColors, Spacing } from '../../constants/theme';
import { AppCard } from '../../components/ui/AppCard';
import { CustomButton } from '../../components/ui/CustomButton';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { ProfileInitialAvatar } from '../../components/ui/ProfileInitialAvatar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { ThemePreference, useAppColors, useThemePreference } from '../../providers/ThemeProvider';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';

export default function SettingsScreen() {
  const colors = useAppColors();
  const { themePreference, setThemePreference } = useThemePreference();
  const { user } = useAuth();

  const initialDisplayName = useMemo(
    () =>
      (user?.user_metadata?.display_name as string | undefined) ??
      (user?.user_metadata?.full_name as string | undefined) ??
      user?.email?.split('@')[0] ??
      '',
    [user],
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

  return (
    <ScreenWrapper>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <AppCard style={styles.card} animated delay={60}>
            <View style={styles.sectionHeaderRow}>
              <Text variant="headlineSmall" style={styles.sectionTitle}>
                Profile
              </Text>
            </View>

            <View style={styles.profileRow}>
              <ProfileInitialAvatar name={displayName} size={64} />
              <View style={styles.profileMeta}>
                <Text variant="headlineSmall" style={styles.profileName} numberOfLines={1}>
                  {trimmedDisplayName || 'Set your name'}
                </Text>
                <Text variant="bodyLarge" style={styles.profileEmail} numberOfLines={1}>
                  {userEmail}
                </Text>
              </View>
            </View>

            <Text variant="titleMedium" style={styles.inputLabel}>
              Display name
            </Text>

            <CustomTextInput
              mode="outlined"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your display name"
              autoCapitalize="words"
              style={styles.input}
            />

            <CustomButton
              mode="contained"
              icon="content-save-outline"
              onPress={handleSaveProfile}
              isLoading={isSavingProfile}
              disabled={!canSaveProfile}
              buttonColor={colors.surfaceContainerHigh}
              textColor={colors.text}
              style={styles.saveButton}
            >
              Save Profile
            </CustomButton>
        </AppCard>

        <AppCard style={styles.card} animated delay={120}>
            <Text variant="headlineSmall" style={styles.sectionTitle}>
              Theme
            </Text>
            <Text variant="bodyLarge" style={styles.sectionBody}>
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
        </AppCard>

        <AppCard style={styles.card} animated delay={180}>
            <Text variant="headlineSmall" style={styles.sectionTitle}>
              Account
            </Text>
            <Text variant="bodyLarge" style={styles.sectionBody}>
              Log out to switch your account.
            </Text>

            <CustomButton
              mode="contained"
              icon="logout"
              onPress={handleSignOut}
              isLoading={isSigningOut}
              buttonColor={colors.dangerSoft}
              textColor={colors.error}
              style={styles.logoutButton}
            >
              Log Out
            </CustomButton>
        </AppCard>
      </ScrollView>

      <AppSnackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </AppSnackbar>
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
      paddingTop: Spacing.xs,
      paddingBottom: 100,
      gap: Spacing.lg,
    },
    card: {
      gap: Spacing.md,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontWeight: '700',
    },
    sectionBody: {
      color: colors.textMuted,
      marginTop: -Spacing.xs,
      marginBottom: Spacing.sm,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },
    profileMeta: {
      flex: 1,
      gap: Spacing.xxs,
    },
    profileName: {
      color: colors.text,
      fontWeight: '700',
    },
    profileEmail: {
      color: colors.textMuted,
    },
    inputLabel: {
      color: colors.text,
      marginBottom: -Spacing.xs,
      fontWeight: '600',
    },
    input: {
      marginBottom: Spacing.xs,
    },
    saveButton: {
      marginTop: 0,
    },
    segmentedRoot: {
      marginBottom: Spacing.xs,
    },
    segmentedButton: {
      borderColor: colors.ghostBorder,
      minHeight: 46,
    },
    themeHint: {
      color: colors.textMuted,
    },
    logoutButton: {
      marginTop: Spacing.xs,
    },
  });