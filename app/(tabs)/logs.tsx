import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Typography, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

export default function LogsScreen() {
  const colors = useAppColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[{ color: colors.text }, Typography.header]}>
        Logs
      </Text>
      <Text style={[{ color: colors.textMuted, marginTop: Spacing.sm }, Typography.body]}>
        View and manage your health entries.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
});
