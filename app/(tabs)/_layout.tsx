import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppColors } from '../../providers/ThemeProvider';
import { Radius, Spacing } from '../../constants/theme';
import { useAuth } from '../../providers/AuthProvider';
import { BottomNavBar } from '../../components/ui/BottomNavBar';
import { BottomNavVisibilityProvider, useBottomNavVisibility } from '../../providers/BottomNavVisibilityProvider';

export default function TabLayout() {
  return (
    <BottomNavVisibilityProvider>
      <TabLayoutContent />
    </BottomNavVisibilityProvider>
  );
}

function TabLayoutContent() {
  const colors = useAppColors();
  const { user } = useAuth();
  const router = useRouter();
  const { visible } = useBottomNavVisibility();

  const initials =
    (user?.user_metadata?.display_name as string | undefined)?.trim().slice(0, 2).toUpperCase() ||
    (user?.email?.[0]?.toUpperCase() ?? 'TM');

  const headerAvatar = (
    <Avatar.Text
      size={40}
      label={initials}
      color={colors.onPrimaryContainer}
      style={{ backgroundColor: colors.surfaceContainerHigh }}
    />
  );

  const createHeaderTitle = (iconName: keyof typeof MaterialCommunityIcons.glyphMap, title: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: Radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceContainerHigh,
        }}
      >
        <MaterialCommunityIcons name={iconName} size={16} color={colors.textMuted} />
      </View>
      <Text variant="titleLarge" style={{ color: colors.text, fontWeight: '700' }}>
        {title}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Tabs
        tabBar={(props) => <BottomNavBar {...props} visible={visible} onAddPress={() => router.push('/add-log')} />}
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surfaceContainerLow,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: colors.ghostBorder,
          },
          headerTitleAlign: 'left',
          headerTitleStyle: {
            fontWeight: '700',
            letterSpacing: -0.3,
          },
          headerLeftContainerStyle: {
            paddingLeft: Spacing.sm,
          },
          headerRightContainerStyle: {
            paddingRight: Spacing.lg,
          },
          headerTintColor: colors.text,
          animation: 'fade',
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerTitle: () => createHeaderTitle('home-variant', 'Home'),
            headerRight: () => headerAvatar,
          }}
        />
        <Tabs.Screen
          name="logs"
          options={{
            title: 'Logs',
            headerTitle: () => createHeaderTitle('format-list-bulleted', 'Logs'),
            headerRight: () => headerAvatar,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerTitle: () => createHeaderTitle('cog', 'Settings'),
            headerRight: () => headerAvatar,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
