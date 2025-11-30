
import { AuthProvider, useAuth } from '@/contexts/auth';
import { ThemeProvider } from '@/hooks/use-theme';
import { SplashScreen, Stack } from 'expo-router';
import { useFonts, OpenSans_400Regular, OpenSans_600SemiBold, OpenSans_700Bold } from '@expo-google-fonts/open-sans';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';
import 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const { isReady } = useAuth();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    OpenSans_400Regular,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    if (isReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isReady, fontsLoaded]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (session?.access_token) {
          router.replace('/reset-password');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  if (!isReady || !fontsLoaded) {
    return null;
  }

  return (
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
  );
}

export default function Layout() {
    return (
      <AuthProvider>
        <ThemeProvider>
          <RootLayout />
        </ThemeProvider>
      </AuthProvider>
    )
}
