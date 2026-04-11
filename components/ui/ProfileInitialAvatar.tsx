import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
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
    <View
      accessibilityLabel={`Profile initials ${initials}`}
      accessibilityRole="image"
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          backgroundColor: colors.primaryContainer,
        },
        style,
      ]}
    >
      <Text variant={labelVariant} style={[styles.label, { color: colors.onPrimaryContainer }]}>
        {initials}
      </Text>
    </View>
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