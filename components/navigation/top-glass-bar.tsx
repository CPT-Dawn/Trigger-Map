import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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

export function TopGlassBar({
    title,
    subtitle,
    iconName,
    showLeading = false,
    leadingIconName = 'chevron-back',
    onPressLeading,
}: TopGlassBarProps) {
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
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 10,
    },
    bar: {
        alignItems: 'center',
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: 'row',
        minHeight: 56,
        paddingHorizontal: 10,
        paddingVertical: 8,
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
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