import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Snackbar, Text, TouchableRipple } from 'react-native-paper';
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
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase())
      .join('') || 'TM';
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

  const getThemeOptionStyle = (value: ThemePreference) => {
    const isSelected = value === themePreference;

    return [
      styles.themeOption,
      {
        backgroundColor: isSelected ? colors.primaryContainer : 'transparent',
      },
    ];
  };

  const getThemeOptionTextStyle = (value: ThemePreference) => {
    const isSelected = value === themePreference;

    return [
      Typography.label,
      {
        color: isSelected ? colors.onPrimaryContainer : colors.textMuted,
      },
    ];
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundAccentTop} />
      <View style={styles.backgroundAccentBottom} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTitleRow}>
            <MaterialCommunityIcons name="cog-outline" size={20} color={colors.textMuted} />
            <Text style={[Typography.header, styles.headerTitle]}>Settings</Text>
          </View>
          <Avatar.Text
            size={44}
            label={initials}
            color={colors.onPrimaryContainer}
            style={styles.headerAvatar}
            labelStyle={styles.avatarLabel}
          />
        </View>

        <View style={styles.card}>
          <Text style={[Typography.header, styles.sectionTitle]}>Profile</Text>

          <View style={styles.profileRow}>
            <Avatar.Text
              size={64}
              label={initials}
              color={colors.onPrimaryContainer}
              style={styles.profileAvatar}
              labelStyle={styles.profileAvatarLabel}
            />
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

          <View style={styles.themeSelector}>
            {themeOptions.map((option) => (
                <TouchableRipple
                key={option.value}
                borderless={false}
                rippleColor={colors.ghostBorder}
                  onPress={() => void setThemePreference(option.value)}
                style={getThemeOptionStyle(option.value)}
              >
                <View style={styles.themeOptionInner}>
                  <Text style={getThemeOptionTextStyle(option.value)}>{option.label}</Text>
                </View>
              </TouchableRipple>
            ))}
          </View>

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
  headerRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    color: colors.text,
  },
  headerAvatar: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  avatarLabel: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
    fontSize: Typography.title.fontSize,
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
    backgroundColor: colors.primaryContainer,
  },
  profileAvatarLabel: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
    fontSize: Typography.header.fontSize,
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
  themeSelector: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.ghostBorder,
    flexDirection: 'row',
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  themeOption: {
    flex: 1,
    borderRadius: Radius.lg,
  },
  themeOptionInner: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
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
