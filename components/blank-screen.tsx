import { StyleSheet, View, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export function BlankScreen() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return <View style={[styles.container, { backgroundColor: colors.surface }]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
