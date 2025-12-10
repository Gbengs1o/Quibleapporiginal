import { AuthProvider, useAuth } from '@/contexts/auth';
import { CartProvider } from '@/contexts/cart';
import { OrderProvider } from '@/contexts/order';
import { WalletProvider } from '@/contexts/wallet';
import { ThemeProvider } from '@/hooks/use-theme';
import { supabase } from '@/utils/supabase';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { OpenSans_400Regular, OpenSans_600SemiBold, OpenSans_700Bold, useFonts } from '@expo-google-fonts/open-sans';
import { SplashScreen, Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import 'react-native-reanimated';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// 1. Create a child component to handle logic (Logic Component)
function InitialLayout() {
  const { isReady } = useAuth(); // This now works because it's INSIDE the provider
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    OpenSans_400Regular,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    Montserrat_700Bold,
  });

  // Handle Splash Screen
  useEffect(() => {
    console.log('Splash check - isReady:', isReady, 'fontsLoaded:', fontsLoaded);
    if (isReady && fontsLoaded) {
      console.log('Hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [isReady, fontsLoaded]);

  // Handle Auth State Changes
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

  // While waiting, return null (Splash screen is still visible via native layer)
  if (!isReady || !fontsLoaded) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="orders" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

// 2. Main Layout (Provider Wrapper)
export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <WalletProvider>
          <ThemeProvider>
            <OrderProvider>
              <InitialLayout />
            </OrderProvider>
          </ThemeProvider>
        </WalletProvider>
      </CartProvider>
    </AuthProvider>
  );
}