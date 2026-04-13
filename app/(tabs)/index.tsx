import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';
import { useAppColors, useThemePreference } from '../../providers/ThemeProvider';

export default function HomeScreen() {
  const colors = useAppColors();
  const { appliedTheme } = useThemePreference();

  return (
    <ScreenWrapper>
      <View style={styles.centeredContent}>
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: colors.text, opacity: appliedTheme === 'dark' ? 0.92 : 1 }]}
        >
          TBD
        </Text>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
});
