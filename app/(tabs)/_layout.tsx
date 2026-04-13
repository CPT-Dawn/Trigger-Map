import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAppColors, useThemePreference } from '../../providers/ThemeProvider';
import { Radius, Spacing } from '../../constants/theme';
import { useAuth } from '../../providers/AuthProvider';
import { BottomNavBar } from '../../components/ui/BottomNavBar';
import { ProfileInitialAvatar } from '../../components/ui/ProfileInitialAvatar';

export default function TabLayout() {
  const colors = useAppColors();
  const { appliedTheme } = useThemePreference();
  const { user } = useAuth();
  const router = useRouter();
  const headerChromeBase = appliedTheme === 'dark' ? colors.surfaceContainerLow : colors.surfaceContainerLowest;
  const headerVeilOpacity = appliedTheme === 'dark' ? 0.28 : 0.14;
  const headerSheenOpacity = appliedTheme === 'dark' ? 0.24 : 0.46;

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
      <Tabs
        tabBar={(props) => (
          <BottomNavBar
            {...props}
            onAddPress={() => router.push('/add-log')}
          />
        )}
        screenOptions={{
          headerStyle: {
            backgroundColor: 'transparent',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: colors.ghostBorder,
          },
          headerBackground: () => (
            <View style={StyleSheet.absoluteFill}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: headerChromeBase }]} />
              <LinearGradient
                colors={[colors.surfaceOverlayStart, colors.surfaceOverlayEnd]}
                locations={[0, 0.58, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: colors.surfaceContainerHighest,
                    opacity: headerVeilOpacity,
                  },
                ]}
              />
              <View
                style={[
                  styles.headerSheen,
                  {
                    backgroundColor: colors.acrylicEdge,
                    opacity: headerSheenOpacity,
                  },
                ]}
              />
            </View>
          ),
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
          name="add-log"
          options={{
            title: 'Add Log',
            href: null,
            headerTitle: () => createHeaderTitle('plus-circle-outline', 'Add Log'),
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
  headerSheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
  },
});
