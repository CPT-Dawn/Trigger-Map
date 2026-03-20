import { Tabs } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'react-native';

import { PolishedTabBar } from '@/components/navigation/polished-tab-bar';
import { Colors } from '@/constants/theme';

export default function TabsLayout() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.surface },
      }}
      tabBar={(props) => <PolishedTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: 'Logs',
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}
