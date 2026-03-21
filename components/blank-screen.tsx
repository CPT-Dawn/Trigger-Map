import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopGlassBar } from '@/components/navigation/top-glass-bar';
import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type BlankScreenProps = {
  title: string;
  subtitle: string;
  iconName: IconName;
};

export function BlankScreen({ title, subtitle, iconName }: BlankScreenProps) {
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <TopGlassBar iconName={iconName} subtitle={subtitle} title={title} />
      <View style={styles.placeholderWrap}>
        <Text style={[styles.placeholderTitle, { color: colors.text }]}>Coming Soon</Text>
        <Text style={[styles.placeholderSubtitle, { color: colors.textMuted }]}>
          This space is ready for your next polished feature.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  placeholderWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  placeholderSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
});
