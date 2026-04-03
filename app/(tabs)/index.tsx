import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Text } from 'react-native-paper';
import { resolveColors, Typography, Spacing } from '../../constants/theme';

export default function HomeScreen() {
  const colors = resolveColors(useColorScheme());

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
