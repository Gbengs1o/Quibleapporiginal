
import { Stack } from 'expo-router';
import 'react-native-reanimated';
import { ThemeProvider, useTheme } from '@/hooks/use-theme';
import { getHeaderTitle } from '@/utils/getHeaderTitle';
import { StatusBar } from 'expo-status-bar';

export const unstable_settings = {
  initialRouteName: 'onboarding',
};

function RootLayoutNav() {
  const { theme } = useTheme();

  return (
    <Stack>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen
        name="(tabs)"
        options={({ route }) => ({
          headerShown: false,
          headerTitle: getHeaderTitle(route),
          headerStyle: {
            backgroundColor: theme === 'dark' ? '#1c1c1e' : '#ffffff',
          },
          headerTintColor: theme === 'dark' ? '#ffffff' : '#000000',
        })}
      />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutNav />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
