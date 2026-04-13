import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native-paper';
import { Radius } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

export interface ProfileInitialAvatarProps {
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

function getInitials(name?: string | null) {
  const trimmedName = name?.trim() ?? '';

  if (!trimmedName) {
    return 'TM';
  }

  const initials = trimmedName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join('');

  return initials || 'TM';
}

export function ProfileInitialAvatar({ name, size = 60, style }: ProfileInitialAvatarProps) {
  const colors = useAppColors();
  const initials = getInitials(name);
  const labelVariant = size >= 56 ? 'titleLarge' : size >= 44 ? 'titleMedium' : 'titleSmall';

  return (
    <LinearGradient
      accessibilityLabel={`Profile initials ${initials}`}
      accessibilityRole="image"
      colors={[colors.secondary, colors.primary]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderColor: colors.ghostBorder,
          borderWidth: 1,
        },
        style,
      ]}
    >
      <Text variant={labelVariant} style={[styles.label, { color: colors.onPrimary }]}>
        {initials}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  label: {
    fontWeight: '700',
  },
});