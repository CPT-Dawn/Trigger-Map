import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Typography, Spacing } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

export default function LogsScreen() {
  const colors = useAppColors();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}> 
      <View style={[styles.accentOrbTop, { backgroundColor: colors.tertiaryContainer }]} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[Typography.header, { color: colors.text }]}>Recent Logs</Text>
          <Text style={[Typography.body, { color: colors.textMuted }]}>Track what happened and when.</Text>
        </View>

        <View style={[styles.timelineCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.ghostBorder }]}> 
          <View style={styles.timelineRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primaryContainer }]}> 
              <MaterialCommunityIcons name="pill" size={20} color={colors.onPrimaryContainer} />
            </View>
            <View style={styles.timelineMeta}>
              <Text style={[Typography.title, { color: colors.text }]}>Medicine logged</Text>
              <Text style={[Typography.caption, { color: colors.textMuted }]}>Ibuprofen 200mg at 08:15 AM</Text>
            </View>
          </View>

          <View style={styles.timelineRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.secondaryContainer }]}> 
              <MaterialCommunityIcons name="food-apple" size={20} color={colors.onSecondaryContainer} />
            </View>
            <View style={styles.timelineMeta}>
              <Text style={[Typography.title, { color: colors.text }]}>Food logged</Text>
              <Text style={[Typography.caption, { color: colors.textMuted }]}>Oatmeal with berries at 09:00 AM</Text>
            </View>
          </View>

          <View style={styles.timelineRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.tertiaryContainer }]}> 
              <MaterialCommunityIcons name="thermometer-lines" size={20} color={colors.onTertiaryContainer} />
            </View>
            <View style={styles.timelineMeta}>
              <Text style={[Typography.title, { color: colors.text }]}>Pain logged</Text>
              <Text style={[Typography.caption, { color: colors.textMuted }]}>Pain level 4 at 11:40 AM</Text>
            </View>
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
    width: 200,
    height: 200,
    borderRadius: Radius.full,
    top: -70,
    right: -60,
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
