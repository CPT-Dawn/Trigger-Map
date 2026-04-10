import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, ProgressBar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';

export default function HomeScreen() {
  const colors = useAppColors();

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={{ color: colors.text }}>Daily Snapshot</Text>
          <Text variant="bodyMedium" style={{ color: colors.textMuted }}>A quick view of your patterns today.</Text>
        </View>

        <View style={[styles.heroCard, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
          <View style={styles.heroTopRow}>
            <View>
              <Text variant="labelLarge" style={{ color: colors.textMuted }}>Consistency score</Text>
              <Text variant="displaySmall" style={[styles.scoreText, { color: colors.text }]}>78%</Text>
            </View>
            <View style={[styles.heroIconWrap, { backgroundColor: colors.primaryContainer }]}> 
              <MaterialCommunityIcons name="chart-line" size={24} color={colors.onPrimaryContainer} />
            </View>
          </View>
          <ProgressBar progress={0.78} color={colors.primary} style={styles.progress} />
          <Text variant="bodySmall" style={{ color: colors.textMuted }}>You are building strong logging momentum this week.</Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
            <Text variant="bodySmall" style={{ color: colors.textMuted }}>Logs today</Text>
            <Text variant="headlineMedium" style={[styles.metricValue, { color: colors.text }]}>6</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
            <Text variant="bodySmall" style={{ color: colors.textMuted }}>Avg pain</Text>
            <Text variant="headlineMedium" style={[styles.metricValue, { color: colors.text }]}>3.2</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
          <Text variant="titleMedium" style={{ color: colors.text }}>Likely triggers today</Text>
          <View style={styles.chipRow}>
            <Chip compact icon="food-apple" style={[styles.chip, { backgroundColor: colors.surfaceContainer }]}>Food</Chip>
            <Chip compact icon="weather-partly-cloudy" style={[styles.chip, { backgroundColor: colors.surfaceContainer }]}>Weather</Chip>
            <Chip compact icon="brain" style={[styles.chip, { backgroundColor: colors.surfaceContainer }]}>Stress</Chip>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: '700',
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
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  metricValue: {
    marginTop: Spacing.xs,
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
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: Radius.full,
  },
});
