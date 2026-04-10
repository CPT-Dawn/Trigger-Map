import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppColors } from '../../providers/ThemeProvider';
import { Radius, Spacing } from '../../constants/theme';
import { useAuth } from '../../providers/AuthProvider';

export default function TabLayout() {
  const colors = useAppColors();
  const { user } = useAuth();

  const initials =
    (user?.user_metadata?.display_name as string | undefined)?.trim().slice(0, 2).toUpperCase() ||
    (user?.email?.[0]?.toUpperCase() ?? 'TM');

  const headerAvatar = (
    <Avatar.Text
      size={38}
      label={initials}
      color={colors.onPrimaryContainer}
      style={{ backgroundColor: colors.surfaceContainerHigh }}
      labelStyle={{ fontSize: 14, fontWeight: '700' }}
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
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 }}>
        {title}
      </Text>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontWeight: '600',
          marginBottom: Spacing.xs,
        },
        tabBarItemStyle: {
          paddingVertical: Spacing.xs,
          borderRadius: Radius.lg,
        },
        tabBarStyle: {
          backgroundColor: colors.surfaceContainerLow,
          borderTopColor: colors.ghostBorder,
          borderTopWidth: 1,
          height: 76,
          paddingTop: Spacing.xs,
          paddingBottom: Spacing.xs,
          elevation: 0,
        },
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
          fontSize: 22,
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: () => createHeaderTitle('home-variant', 'Home'),
          headerRight: () => headerAvatar,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home-variant" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: 'Logs',
          headerTitle: () => createHeaderTitle('format-list-bulleted', 'Logs'),
          headerRight: () => headerAvatar,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="format-list-bulleted" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: () => createHeaderTitle('cog', 'Settings'),
          headerRight: () => headerAvatar,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="cog" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
