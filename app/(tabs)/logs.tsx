import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';

export default function LogsScreen() {
  const colors = useAppColors();

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={[{ color: colors.text }]}>Recent Logs</Text>
          <Text variant="bodyMedium" style={[{ color: colors.textMuted }]}>Track what happened and when.</Text>
        </View>

        <View style={[styles.timelineCard, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}> 
          <View style={styles.timelineRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primaryContainer }]}> 
              <MaterialCommunityIcons name="pill" size={20} color={colors.onPrimaryContainer} />
            </View>
            <View style={styles.timelineMeta}>
              <Text variant="titleMedium" style={[{ color: colors.text }]}>Medicine logged</Text>
              <Text variant="bodySmall" style={[{ color: colors.textMuted }]}>Ibuprofen 200mg at 08:15 AM</Text>
            </View>
          </View>

          <View style={styles.timelineRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.secondaryContainer }]}> 
              <MaterialCommunityIcons name="food-apple" size={20} color={colors.onSecondaryContainer} />
            </View>
            <View style={styles.timelineMeta}>
              <Text variant="titleMedium" style={[{ color: colors.text }]}>Food logged</Text>
              <Text variant="bodySmall" style={[{ color: colors.textMuted }]}>Oatmeal with berries at 09:00 AM</Text>
            </View>
          </View>

          <View style={styles.timelineRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.tertiaryContainer }]}> 
              <MaterialCommunityIcons name="thermometer-lines" size={20} color={colors.onTertiaryContainer} />
            </View>
            <View style={styles.timelineMeta}>
              <Text variant="titleMedium" style={[{ color: colors.text }]}>Pain logged</Text>
              <Text variant="bodySmall" style={[{ color: colors.textMuted }]}>Pain level 4 at 11:40 AM</Text>
            </View>
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
  timelineCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineMeta: {
    flex: 1,
    gap: Spacing.xxs,
  },
});
