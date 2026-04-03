import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type TopGlassBarProps = {
    title: string;
    iconName?: IconName;
    showLeading?: boolean;
    leadingIconName?: IconName;
    onPressLeading?: () => void;
};

const TOP_BAR_HEIGHT = 56;
const TOP_BAR_SPACING = 18;

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

function extractFullName(raw: unknown) {
    if (typeof raw !== 'string') return '';
    return raw.trim();
}

export function useTopGlassBarOffset() {
    const insets = useSafeAreaInsets();
    return insets.top + TOP_BAR_HEIGHT + TOP_BAR_SPACING;
}

export function TopGlassBar({
    title,
    iconName,
    showLeading = false,
    leadingIconName = 'chevron-back',
    onPressLeading,
}: TopGlassBarProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { resolvedTheme } = useAppTheme();
    const theme = resolvedTheme;
    const colors = Colors[theme];
    const [profileName, setProfileName] = useState('');
    const [profileEmail, setProfileEmail] = useState('');

    const profileInitials = useMemo(() => toInitials(profileName, profileEmail), [profileEmail, profileName]);

    useEffect(() => {
        let isMounted = true;

        const loadProfile = async () => {
            const result = await getCurrentUser();
            if (!isMounted || result.error || !result.data) {
                if (isMounted) {
                    setProfileName('');
                    setProfileEmail('');
                }
                return;
            }

            setProfileName(extractFullName(result.data.user_metadata?.full_name));
            setProfileEmail(result.data.email ?? '');
        };

        void loadProfile();

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return;

            const user = session?.user;
            setProfileName(extractFullName(user?.user_metadata?.full_name));
            setProfileEmail(user?.email ?? '');
        });

        return () => {
            isMounted = false;
            data.subscription.unsubscribe();
        };
    }, []);

    const handlePressProfile = () => {
        if (title === 'Settings') return;
        router.push('/(tabs)/settings');
    };

    return (
        <View style={styles.wrap}>
            <BlurView
                experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
                intensity={theme === 'dark' ? 38 : 52}
                tint={theme === 'dark' ? 'dark' : 'light'}
                style={[
                    styles.bar,
                    {
                        paddingTop: insets.top + 6,
                    },
                    {
                        backgroundColor: colors.glassSurface,
                        borderColor: colors.ghostBorder,
                        shadowColor: colors.primary,
                    },
                ]}>
                {showLeading ? (
                    <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={onPressLeading}
                        style={[styles.leadingButton, { backgroundColor: colors.surfaceContainerLow }]}
                    >
                        <Ionicons color={colors.text} name={leadingIconName} size={18} />
                    </Pressable>
                ) : (
                    <View style={styles.leadingPlaceholder} />
                )}

                <View style={styles.centerCopy}>
                    <View style={styles.titleRow}>
                        {iconName ? <Ionicons color={colors.textMuted} name={iconName} size={14} /> : null}
                        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
                            {title}
                        </Text>
                    </View>
                </View>

                <Pressable
                    accessibilityLabel="Open profile settings"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={handlePressProfile}
                    style={[styles.profileButton, { backgroundColor: colors.surfaceContainerLow }]}
                >
                    <Text style={[styles.profileInitials, { color: colors.text }]}>{profileInitials}</Text>
                </Pressable>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 30,
    },
    bar: {
        alignItems: 'center',
        borderBottomWidth: 1,
        flexDirection: 'row',
        minHeight: TOP_BAR_HEIGHT,
        paddingHorizontal: 12,
        paddingBottom: 10,
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.1,
        shadowRadius: 18,
        elevation: 6,
    },
    leadingButton: {
        alignItems: 'center',
        borderRadius: 12,
        height: 34,
        justifyContent: 'center',
        width: 34,
    },
    leadingPlaceholder: {
        width: 12,
    },
    centerCopy: {
        flex: 1,
        paddingHorizontal: 8,
        justifyContent: 'center',
    },
    titleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'flex-start',
    },
    title: {
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    profileButton: {
        alignItems: 'center',
        borderRadius: 12,
        height: 34,
        justifyContent: 'center',
        width: 34,
    },
    profileInitials: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
});