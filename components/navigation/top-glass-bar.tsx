import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type TopGlassBarProps = {
    title: string;
    subtitle?: string;
    iconName?: IconName;
    showLeading?: boolean;
    leadingIconName?: IconName;
    onPressLeading?: () => void;
};

const TOP_BAR_HEIGHT = 56;
const TOP_BAR_SPACING = 18;

export function useTopGlassBarOffset() {
    const insets = useSafeAreaInsets();
    return insets.top + TOP_BAR_HEIGHT + TOP_BAR_SPACING;
}

export function TopGlassBar({
    title,
    subtitle,
    iconName,
    showLeading = false,
    leadingIconName = 'chevron-back',
    onPressLeading,
}: TopGlassBarProps) {
    const insets = useSafeAreaInsets();
    const { resolvedTheme } = useAppTheme();
    const theme = resolvedTheme;
    const colors = Colors[theme];

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
                    {subtitle ? (
                        <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textMuted }]}>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>

                <View style={styles.trailingPlaceholder} />
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
        paddingHorizontal: 16,
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
        width: 34,
    },
    centerCopy: {
        flex: 1,
        paddingHorizontal: 10,
    },
    titleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    subtitle: {
        fontSize: 11.5,
        fontWeight: '600',
        marginTop: 2,
        textAlign: 'center',
    },
    trailingPlaceholder: {
        width: 34,
    },
});