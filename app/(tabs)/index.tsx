import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Typography, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

export default function HomeScreen() {
  const colors = useAppColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[{ color: colors.text }, Typography.header]}>
        Home
      </Text>
      <Text style={[{ color: colors.textMuted, marginTop: Spacing.sm }, Typography.body]}>
        Your daily health context at a glance.
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
