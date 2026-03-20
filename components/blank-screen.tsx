import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/lib/theme';

export function BlankScreen() {
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  return <View style={[styles.container, { backgroundColor: colors.surface }]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
