import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopGlassBar } from '@/components/navigation/top-glass-bar';
import { Colors } from '@/constants/theme';
import { getCurrentUser, signOutCurrentUser, updateCurrentUserProfile } from '@/lib/auth';
import { type ThemePreference, useAppTheme } from '@/lib/theme';

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  helper: string;
}[] = [
    { value: 'auto', label: 'Auto', helper: 'Uses your device setting' },
    { value: 'light', label: 'Light', helper: 'Clinical Curator mode' },
    { value: 'dark', label: 'Dark', helper: 'Restorative Sanctuary mode' },
  ];

function extractFullName(raw: unknown) {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

function toInitials(name: string, email: string) {
  const fallback = email.split('@')[0]?.trim() ?? '';
  const source = name || fallback || 'Trigger Map';
  const parts = source
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return 'TM';
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function toAccountChip(userId: string) {
  if (!userId) return 'No account id';
  if (userId.length <= 14) return userId;
  return `${userId.slice(0, 8)}...${userId.slice(-6)}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { preference, resolvedTheme, setPreference } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];
  const isMountedRef = useRef(true);

  const [fullName, setFullName] = useState('');
  const [draftFullName, setDraftFullName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isThemeSaving, setIsThemeSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const activeSegmentColor = theme === 'dark' ? 'rgba(186, 195, 255, 0.22)' : 'rgba(3, 22, 50, 0.08)';
  const focusBorderColor = theme === 'dark' ? 'rgba(186, 195, 255, 0.42)' : 'rgba(3, 22, 50, 0.26)';

  const initials = useMemo(() => toInitials(fullName, email), [email, fullName]);
  const hasNameChanges = draftFullName.trim() !== fullName.trim();
  const isBusy = isSavingProfile || isThemeSaving || isLoggingOut;
  const canSaveProfile = hasNameChanges && !isProfileLoading && !isBusy;
  const selectedThemeHelper = THEME_OPTIONS.find((option) => option.value === preference)?.helper ?? '';

  const loadProfile = useCallback(async () => {
    if (!isMountedRef.current) return;
    setIsProfileLoading(true);
    setProfileError(null);

    const result = await getCurrentUser();
    if (!isMountedRef.current) return;

    if (result.error) {
      setProfileError(result.error);
      setIsProfileLoading(false);
      return;
    }

    const user = result.data;
    if (!user) {
      setFullName('');
      setDraftFullName('');
      setEmail('');
      setUserId('');
      setProfileError('No authenticated session found. Please sign in again.');
      setIsProfileLoading(false);
      return;
    }

    const nextFullName = extractFullName(user.user_metadata?.full_name);

    setFullName(nextFullName);
    setDraftFullName(nextFullName);
    setEmail(user.email ?? '');
    setUserId(user.id);
    setIsProfileLoading(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadProfile();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadProfile]);

  const handleSaveProfile = async () => {
    if (!canSaveProfile) return;
    setIsSavingProfile(true);

    const result = await updateCurrentUserProfile(draftFullName);
    if (!isMountedRef.current) return;

    setIsSavingProfile(false);

    if (result.error) {
      Alert.alert('Unable To Save Profile', result.error);
      return;
    }
    if (!result.data) {
      Alert.alert('Unable To Save Profile', 'Profile update did not return user data.');
      return;
    }

    const updatedName = extractFullName(result.data.user_metadata?.full_name) || draftFullName.trim();
    setFullName(updatedName);
    setDraftFullName(updatedName);
    Alert.alert('Profile Updated', 'Your display name has been saved.');
  };

  const handleSelectTheme = async (nextTheme: ThemePreference) => {
    if (nextTheme === preference || isThemeSaving || isLoggingOut) return;
    setIsThemeSaving(true);

    try {
      await setPreference(nextTheme);
    } finally {
      if (!isMountedRef.current) return;
      setIsThemeSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (isLoggingOut || isThemeSaving) return;
    setIsLoggingOut(true);

    const result = await signOutCurrentUser();
    if (!isMountedRef.current) return;
    setIsLoggingOut(false);

    if (result.error) {
      Alert.alert('Log Out Failed', result.error);
      return;
    }

    router.replace('/login');
  };

  const confirmSignOut = () => {
    if (isLoggingOut || isThemeSaving) return;

    Alert.alert('Log Out', 'Do you want to end your current session?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          void handleSignOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <View style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.glowTop,
            {
              backgroundColor: theme === 'dark' ? 'rgba(186, 195, 255, 0.08)' : 'rgba(3, 22, 50, 0.06)',
            },
          ]}
        />
        <View
          style={[
            styles.glowBottom,
            {
              backgroundColor: theme === 'dark' ? 'rgba(102, 217, 204, 0.08)' : 'rgba(0, 104, 118, 0.07)',
            },
          ]}
        />
      </View>

      <TopGlassBar
        iconName="settings-outline"
        subtitle="Profile, visual mode, and account controls"
        title="Settings"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.ghostBorder,
            },
          ]}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>
            {profileError ? (
              <Pressable disabled={isProfileLoading || isBusy} onPress={() => void loadProfile()}>
                <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.profileSummaryRow}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.avatar}>
              <Text style={[styles.avatarText, { color: colors.onPrimary }]}>{initials}</Text>
            </LinearGradient>

            <View style={styles.profileTextWrap}>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {fullName || 'Personal Profile'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
                {email || 'No email found for current session'}
              </Text>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Display name</Text>
          <TextInput
            editable={!isProfileLoading && !isBusy}
            onBlur={() => setIsNameFocused(false)}
            onChangeText={setDraftFullName}
            onFocus={() => setIsNameFocused(true)}
            placeholder="Enter your full name"
            placeholderTextColor={colors.outline}
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceContainerHighest,
                borderColor: isNameFocused ? focusBorderColor : 'transparent',
                color: colors.text,
              },
            ]}
            value={draftFullName}
          />

          <View style={styles.accountIdRow}>
            <Ionicons color={colors.textMuted} name="finger-print-outline" size={15} />
            <Text style={[styles.accountIdText, { color: colors.textMuted }]}>
              Account: {toAccountChip(userId)}
            </Text>
          </View>

          {profileError ? (
            <Text style={[styles.profileErrorText, { color: colors.error }]}>{profileError}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canSaveProfile}
            onPress={handleSaveProfile}
            style={[
              styles.saveButton,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.ghostBorder,
              },
              !canSaveProfile && styles.buttonDisabled,
            ]}>
            {isSavingProfile ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <>
                <Ionicons color={colors.text} name="save-outline" size={17} />
                <Text style={[styles.saveButtonText, { color: colors.text }]}>Save Profile</Text>
              </>
            )}
          </Pressable>
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.ghostBorder,
            },
          ]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Theme</Text>
          <Text style={[styles.themeDescription, { color: colors.textMuted }]}>
            Choose how Trigger Map should feel across iOS and Android.
          </Text>

          <View style={[styles.segmentedTrack, { backgroundColor: colors.surfaceContainerHigh }]}>
            {THEME_OPTIONS.map((option) => {
              const active = option.value === preference;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  disabled={isThemeSaving || isLoggingOut}
                  onPress={() => void handleSelectTheme(option.value)}
                  style={[
                    styles.segmentButton,
                    active && {
                      backgroundColor: activeSegmentColor,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: active ? colors.primary : colors.textMuted,
                      },
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.themeHelper, { color: colors.textMuted }]}>
            {isThemeSaving ? 'Applying theme...' : selectedThemeHelper}
          </Text>
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.ghostBorder,
            },
          ]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <Text style={[styles.themeDescription, { color: colors.textMuted }]}>
            Manage your session securely.
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={isLoggingOut || isThemeSaving}
            onPress={confirmSignOut}
            style={[
              styles.logoutButton,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.ghostBorder,
              },
              (isLoggingOut || isThemeSaving) && styles.buttonDisabled,
            ]}>
            {isLoggingOut ? (
              <ActivityIndicator color={colors.error} size="small" />
            ) : (
              <>
                <Ionicons color={colors.error} name="log-out-outline" size={18} />
                <Text style={[styles.logoutText, { color: colors.error }]}>Log Out</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 130,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  profileSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    marginBottom: 14,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  profileTextWrap: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 13,
    fontWeight: '500',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 1,
  },
  input: {
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  accountIdRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  accountIdText: {
    fontSize: 12,
    fontWeight: '500',
  },
  profileErrorText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 10,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  themeDescription: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 6,
  },
  segmentedTrack: {
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    padding: 6,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 8,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  themeHelper: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
  logoutButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  glowTop: {
    borderRadius: 999,
    height: 280,
    left: -120,
    position: 'absolute',
    top: -80,
    width: 280,
  },
  glowBottom: {
    borderRadius: 999,
    bottom: -120,
    height: 340,
    position: 'absolute',
    right: -160,
    width: 340,
  },
});
