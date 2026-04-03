import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Text } from 'react-native-paper';
import { resolveColors, Typography, Spacing } from '../../constants/theme';
import { CustomButton } from '../../components/ui/CustomButton';
import { supabase } from '../../lib/supabase';

export default function SettingsScreen() {
  const colors = resolveColors(useColorScheme());

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[{ color: colors.text }, Typography.header]}>
        Settings
      </Text>
      
      <CustomButton 
        onPress={handleSignOut} 
        mode="outlined" 
        style={styles.signOutBtn}
        textColor={colors.error}
      >
        Sign Out
      </CustomButton>
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
  signOutBtn: {
    marginTop: Spacing.xxl,
    minWidth: 200,
  }
});
