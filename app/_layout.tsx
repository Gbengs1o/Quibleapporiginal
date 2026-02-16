import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';
import CallOverlay from '@/components/CallOverlay';
import PhoneVerificationModal from '@/components/PhoneVerificationModal';
import { AuthProvider, useAuth } from '@/contexts/auth';
import { CallProvider } from '@/contexts/call-context';
import { CartProvider } from '@/contexts/cart';
import { OrderProvider } from '@/contexts/order';
import { WalletProvider } from '@/contexts/wallet';
import { ThemeProvider } from '@/hooks/use-theme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/utils/supabase';
import { Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { OpenSans_400Regular, OpenSans_600SemiBold, OpenSans_700Bold, useFonts } from '@expo-google-fonts/open-sans';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { SplashScreen, Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function InitialLayout() {
  const { isReady, session } = useAuth();
  const router = useRouter();
  const { expoPushToken } = usePushNotifications();

  // Sync Push Token
  useEffect(() => {
    if (session?.user?.id && expoPushToken) {
      supabase
        .from('profiles')
        .update({ expo_push_token: expoPushToken })
        .eq('id', session.user.id)
        .then(({ error }) => {
          if (error) console.error('Error syncing push token:', error);
        });
    }
  }, [session, expoPushToken]);

  const [fontsLoaded] = useFonts({
    OpenSans_400Regular,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  // Handle Splash Screen
  const [isSlashAnimationFinished, setIsSplashAnimationFinished] = useState(false);

  useEffect(() => {
    // Listen for user tapping a notification
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      // Navigate to notifications page if no specific link, or detailed page if ID exists
      // Assuming payload has { id: '...' } or just go to index
      router.push('/notifications');
    });

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);



  // Handle Deep Links (Password Reset)
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;

      // Check if it's a reset password link (contains access_token & type=recovery not always present but hash parameters are)
      if (url.includes('access_token') && url.includes('refresh_token')) {
        console.log('Deep link detected with tokens');

        // Extract query parameters from the hash fragment
        const extractParams = (urlStr: string) => {
          const params: { [key: string]: string } = {};
          const hashIndex = urlStr.indexOf('#');
          if (hashIndex !== -1) {
            const hash = urlStr.substring(hashIndex + 1);
            const pairs = hash.split('&');
            for (const pair of pairs) {
              const [key, value] = pair.split('=');
              if (key && value) {
                params[key] = decodeURIComponent(value);
              }
            }
          }
          return params;
        };

        const params = extractParams(url);

        if (params.access_token && params.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });

          if (error) {
            Alert.alert('Error', 'Failed to set session: ' + error.message);
          } else {
            // Do not force redirect to reset-password here.
            // The onAuthStateChange listener will handle PASSWORD_RECOVERY events.
            // For OAuth (Google), we just want to set the session and let the app state update.
          }
        }
      }
    };

    // Check initial URL
    Linking.getInitialURL().then(handleUrl);

    // Listen for new URLs
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      subscription.remove();
    };
  }, [router]);

  // Handle Auth State Changes (Supabase Internal)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // While waiting, show the animated splash screen
  if (!isReady || !fontsLoaded || !isSlashAnimationFinished) {
    return (
      <AnimatedSplashScreen
        onAnimationComplete={() => setIsSplashAnimationFinished(true)}
      />
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="orders" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="restaurant" options={{ headerShown: false }} />
      <Stack.Screen name="rider" options={{ headerShown: false }} />
      <Stack.Screen name="send-package" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

// 2. Main Layout (Provider Wrapper)
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <CartProvider>
          <WalletProvider>
            <ThemeProvider>
              <OrderProvider>
                <CallProvider>
                  <InitialLayout />
                  <CallOverlay />
                  <PhoneVerificationModal />
                </CallProvider>
              </OrderProvider>
            </ThemeProvider>
          </WalletProvider>
        </CartProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}