import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, ProgressBar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Typography, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

export default function HomeScreen() {
  const colors = useAppColors();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}> 
      <View style={[styles.accentOrbTop, { backgroundColor: colors.primaryContainer }]} />
      <View style={[styles.accentOrbBottom, { backgroundColor: colors.secondaryContainer }]} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[Typography.header, { color: colors.text }]}>Daily Snapshot</Text>
          <Text style={[Typography.body, { color: colors.textMuted }]}>A quick view of your patterns today.</Text>
        </View>

        <View style={[styles.heroCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.ghostBorder }]}> 
          <View style={styles.heroTopRow}>
            <View>
              <Text style={[Typography.label, { color: colors.textMuted }]}>Consistency score</Text>
              <Text style={[styles.scoreText, { color: colors.text }]}>78%</Text>
            </View>
            <View style={[styles.heroIconWrap, { backgroundColor: colors.primaryContainer }]}> 
              <MaterialCommunityIcons name="chart-line" size={24} color={colors.onPrimaryContainer} />
            </View>
          </View>
          <ProgressBar progress={0.78} color={colors.primary} style={styles.progress} />
          <Text style={[Typography.caption, { color: colors.textMuted }]}>You are building strong logging momentum this week.</Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.ghostBorder }]}> 
            <Text style={[Typography.caption, { color: colors.textMuted }]}>Logs today</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>6</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.ghostBorder }]}> 
            <Text style={[Typography.caption, { color: colors.textMuted }]}>Avg pain</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>3.2</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.ghostBorder }]}> 
          <Text style={[Typography.title, { color: colors.text }]}>Likely triggers today</Text>
          <View style={styles.chipRow}>
            <Chip compact icon="food-apple" style={[styles.chip, { backgroundColor: colors.surfaceContainer }]}>Food</Chip>
            <Chip compact icon="weather-partly-cloudy" style={[styles.chip, { backgroundColor: colors.surfaceContainer }]}>Weather</Chip>
            <Chip compact icon="brain" style={[styles.chip, { backgroundColor: colors.surfaceContainer }]}>Stress</Chip>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  accentOrbTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: Radius.full,
    top: -80,
    right: -60,
    opacity: 0.2,
  },
  accentOrbBottom: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: Radius.full,
    bottom: -90,
    left: -70,
    opacity: 0.18,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  heroCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    ...Typography.header,
  },
  progress: {
    height: 8,
    borderRadius: Radius.full,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  metricCard: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  metricValue: {
    ...Typography.title,
    fontWeight: '700',
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    borderRadius: Radius.full,
  },
});
