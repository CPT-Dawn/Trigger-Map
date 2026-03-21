import { Tabs } from 'expo-router';
import React from 'react';

import { PolishedTabBar } from '@/components/navigation/polished-tab-bar';
import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/lib/theme';

export default function TabsLayout() {
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
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
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}
