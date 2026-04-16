import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, resolveColors, Spacing } from '../../constants/theme';
import { AppCard } from '../../components/ui/AppCard';
import { CustomButton } from '../../components/ui/CustomButton';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { ProfileInitialAvatar } from '../../components/ui/ProfileInitialAvatar';
import { addToSyncQueue, db, getLocalDisplayName, getPendingSyncCount, upsertLocalDisplayName } from '../../lib/localDb';
import { runSync } from '../../lib/syncEngine';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { ThemePreference, useAppColors, useThemePreference } from '../../providers/ThemeProvider';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';

type SettingsSectionCardStyles = ReturnType<typeof createStyles>;

type SettingsSectionCardProps = {
  delay: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  accentColor: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useAppColors>;
  styles: SettingsSectionCardStyles;
};

function SettingsSectionCard({
  delay,
  icon,
  title,
  subtitle,
  accentColor,
  children,
  colors,
  styles,
}: SettingsSectionCardProps) {
  return (
    <AppCard style={styles.card} contentStyle={styles.cardContent} animated delay={delay}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.sectionIconShell, { backgroundColor: colors.surfaceContainerLow }]}>
            <MaterialCommunityIcons name={icon} size={20} color={accentColor} />
          </View>
          <View style={styles.cardTitleBlock}>
            <Text variant="titleMedium" style={[styles.cardTitle, { color: colors.text }]}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="bodySmall" style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.cardBody}>{children}</View>
    </AppCard>
  );
}

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
  const [savedDisplayName, setSavedDisplayName] = useState(initialDisplayName);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    const fallbackDisplayName = initialDisplayName.trim();

    if (!user?.id) {
      setDisplayName(fallbackDisplayName);
      setSavedDisplayName(fallbackDisplayName);
      return;
    }

    try {
      const localDisplayName = getLocalDisplayName(user.id)?.trim() ?? '';
      const resolvedDisplayName = localDisplayName.length > 0 ? localDisplayName : fallbackDisplayName;

      setDisplayName(resolvedDisplayName);
      setSavedDisplayName(resolvedDisplayName);

      if (localDisplayName.length === 0 && fallbackDisplayName.length > 0) {
        upsertLocalDisplayName(user.id, fallbackDisplayName);
      }
    } catch {
      setDisplayName(fallbackDisplayName);
      setSavedDisplayName(fallbackDisplayName);
    }
  }, [initialDisplayName, user?.id]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const userEmail = user?.email ?? 'No email found';
  const trimmedDisplayName = displayName.trim();
  const canSaveProfile =
    trimmedDisplayName.length > 0 && trimmedDisplayName !== savedDisplayName && !isSavingProfile;

  const openSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!canSaveProfile || !user) return;

    try {
      setIsSavingProfile(true);

      db.execSync('BEGIN TRANSACTION;');

      try {
        upsertLocalDisplayName(user.id, trimmedDisplayName);
        db.runSync('DELETE FROM sync_queue WHERE table_name = ? AND operation = ? AND user_id = ?;', ['auth_profile', 'UPDATE', user.id]);
        addToSyncQueue('auth_profile', 'UPDATE', {
          user_id: user.id,
          display_name: trimmedDisplayName,
        }, { userId: user.id });
        db.execSync('COMMIT;');
      } catch (error) {
        db.execSync('ROLLBACK;');
        throw error;
      }

      setSavedDisplayName(trimmedDisplayName);
      openSnackbar('Profile updated successfully.');
      void runSync();
    } catch (error: any) {
      openSnackbar(error?.message || 'Something went wrong while saving your profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const performSignOut = async () => {
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

  const handleSignOut = () => {
    if (!user?.id) {
      void performSignOut();
      return;
    }

    let pendingCount = 0;

    try {
      pendingCount = getPendingSyncCount(user.id);
    } catch {
      pendingCount = 0;
    }

    if (pendingCount <= 0) {
      void performSignOut();
      return;
    }

    const entryLabel = pendingCount === 1 ? 'entry is' : 'entries are';

    Alert.alert(
      'Unsynced logs pending',
      `${pendingCount} ${entryLabel} still waiting to sync. Signing out now can delay sync until you sign in again on this device.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out Anyway',
          style: 'destructive',
          onPress: () => {
            void performSignOut();
          },
        },
      ],
    );
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
        keyboardShouldPersistTaps="handled"
      >
        <SettingsSectionCard
          delay={60}
          icon="account-circle-outline"
          title="Profile"
          accentColor={colors.primary}
          colors={colors}
          styles={styles}
        >
          <View style={styles.profileRow}>
            <ProfileInitialAvatar name={displayName} size={56} />
            <View style={styles.profileMeta}>
              <Text variant="titleMedium" style={styles.profileName} numberOfLines={1}>
                {trimmedDisplayName || 'Set your name'}
              </Text>
              <Text variant="bodyMedium" style={styles.profileEmail} numberOfLines={1}>
                {userEmail}
              </Text>
            </View>
          </View>

          <CustomTextInput
            mode="outlined"
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            style={styles.input}
          />

          <CustomButton
            mode="contained"
            icon="content-save-outline"
            onPress={handleSaveProfile}
            isLoading={isSavingProfile}
            disabled={!canSaveProfile}
            buttonColor={colors.primary}
            textColor={colors.onPrimary}
            style={styles.primaryButton}
          >
            Save Profile
          </CustomButton>
        </SettingsSectionCard>

        <SettingsSectionCard
          delay={120}
          icon="palette-outline"
          title="Appearance"
          subtitle="Choose how Trigger Map looks."
          accentColor={colors.secondary}
          colors={colors}
          styles={styles}
        >
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
              labelStyle: styles.segmentedButtonLabel,
            }))}
            theme={{
              colors: {
                secondaryContainer: colors.primaryContainer,
                onSecondaryContainer: colors.onPrimaryContainer,
                outline: colors.ghostBorder,
              },
            }}
          />
        </SettingsSectionCard>

        <SettingsSectionCard
          delay={180}
          icon="logout"
          title="Account"
          subtitle="Sign out from this device when you’re done."
          accentColor={colors.error}
          colors={colors}
          styles={styles}
        >
          <CustomButton
            mode="contained"
            icon="logout"
            onPress={handleSignOut}
            isLoading={isSigningOut}
            buttonColor={colors.errorContainer}
            textColor={colors.error}
            style={styles.dangerButton}
          >
            Log Out
          </CustomButton>
        </SettingsSectionCard>
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
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xxxl + Spacing.xxxl,
      gap: Spacing.lg,
    },
    card: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.lg,
    },
    cardContent: {
      gap: Spacing.md,
      alignItems: 'stretch',
      paddingBottom: Spacing.sm,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      flex: 1,
    },
    sectionIconShell: {
      width: 40,
      height: 40,
      borderRadius: Radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitleBlock: {
      flex: 1,
      gap: Spacing.xxs,
    },
    cardTitle: {
      fontWeight: '700',
    },
    cardSubtitle: {
      lineHeight: 18,
    },
    cardBody: {
      gap: Spacing.md,
      alignItems: 'stretch',
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      marginBottom: 0,
    },
    profileMeta: {
      flex: 1,
      gap: Spacing.xxs,
    },
    profileName: {
      color: colors.text,
      fontWeight: '600',
    },
    profileEmail: {
      color: colors.textMuted,
      lineHeight: 20,
    },
    input: {
      marginBottom: 0,
    },
    primaryButton: {
      marginTop: 0,
    },
    segmentedRoot: {
      marginTop: 0,
    },
    segmentedButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderColor: colors.ghostBorder,
      minHeight: 44,
    },
    segmentedButtonLabel: {
      textAlign: 'center',
      width: '100%',
    },
    dangerButton: {
      marginTop: Spacing.xs,
    },
  });