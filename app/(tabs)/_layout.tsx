import React, { useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurTargetView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useAppColors } from '../../providers/ThemeProvider';
import { Radius, Spacing } from '../../constants/theme';
import { useAuth } from '../../providers/AuthProvider';
import { BottomNavBar } from '../../components/ui/BottomNavBar';
import { ProfileInitialAvatar } from '../../components/ui/ProfileInitialAvatar';

export default function TabLayout() {
  const colors = useAppColors();
  const { user } = useAuth();
  const router = useRouter();
  const blurTargetRef = useRef<View | null>(null);

  const profileName =
    (user?.user_metadata?.display_name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    '';

  const headerAvatar = (
    <ProfileInitialAvatar name={profileName} size={40} style={{ marginRight: 0 }} />
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
      <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
        <Tabs
          tabBar={(props) => (
            <BottomNavBar
              {...props}
              blurTarget={blurTargetRef}
              onAddPress={() => router.push('/add-log')}
            />
          )}
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
            animation: 'none',
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
      </BlurTargetView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blurTarget: {
    flex: 1,
  },
});
