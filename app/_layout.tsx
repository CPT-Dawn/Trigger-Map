import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { Colors, NavigationThemes } from '@/constants/theme';

export default function RootLayout() {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <ThemeProvider value={NavigationThemes[theme]}>
      <Stack initialRouteName="login">
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen
          name="signup"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen
          name="phone-auth"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen
          name="phone-verify"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen
          name="add-edit"
          options={{
            title: 'Add/Edit',
            presentation: 'modal',
            headerStyle: {
              backgroundColor: colors.surfaceContainerHigh,
            },
            headerShadowVisible: false,
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
