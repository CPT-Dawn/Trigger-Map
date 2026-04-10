import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Avatar, Text, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppColors } from '../../providers/ThemeProvider';
import { Radius, Spacing } from '../../constants/theme';
import { useAuth } from '../../providers/AuthProvider';

export default function TabLayout() {
  const colors = useAppColors();
  const { user } = useAuth();
  const router = useRouter();

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
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.tabIconSelected,
          tabBarInactiveTintColor: colors.tabIconDefault,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: colors.glassSurface,
            borderTopColor: colors.ghostBorder,
            borderTopWidth: 1,
            borderTopLeftRadius: Radius.xl,
            borderTopRightRadius: Radius.xl,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderLeftColor: colors.ghostBorder,
            borderRightColor: colors.ghostBorder,
            height: Platform.OS === 'ios' ? 88 : 68,
            elevation: 0,
            paddingBottom: Platform.OS === 'ios' ? 20 : 0,
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
            tabBarIcon: ({ color, focused }) => (
              <MaterialCommunityIcons name={focused ? 'home-variant' : 'home-variant-outline'} size={28} color={color} />
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
              <MaterialCommunityIcons name="format-list-bulleted" size={28} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerTitle: () => createHeaderTitle('cog', 'Settings'),
            headerRight: () => headerAvatar,
            tabBarIcon: ({ color, focused }) => (
              <MaterialCommunityIcons name={focused ? 'cog' : 'cog-outline'} size={28} color={color} />
            ),
          }}
        />
      </Tabs>
      
      {/* Floating Action Button */}
      <View style={styles.fabContainer} pointerEvents="box-none">
        <FAB
          icon="plus-thick"
          color={colors.onPrimary}
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/add-log')}
          mode="elevated"
          customSize={64}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 70 : 50,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  fab: {
    borderRadius: 32,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
