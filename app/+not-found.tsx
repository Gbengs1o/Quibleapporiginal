import LiquidLogo from '@/components/LiquidLogo'; // Our new animation
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const colors = {
    bg: isDark ? '#111111' : '#FFFFFF', // Matching the requested #111 dark mode
    text: isDark ? '#FFFFFF' : '#1F2050',
    textSec: isDark ? '#8E8E93' : '#6B7280',
    buttonBg: '#F27C22', // Quible Orange
    buttonText: '#FFFFFF',
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.bg }]}>

        {/* The Liquid Animation */}
        <View style={styles.animationContainer}>
          <LiquidLogo isDark={isDark} />
        </View>

        <View style={styles.content}>
          <ThemedText style={[styles.title, { color: colors.text }]}>Oops!</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSec }]}>
            This screen doesn't exist.
          </ThemedText>

          <Link href="/" style={[styles.link, { backgroundColor: colors.buttonBg }]}>
            <ThemedText style={[styles.linkText, { color: colors.buttonText }]}>Go to Home</ThemedText>
          </Link>
        </View>

      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  animationContainer: {
    marginBottom: 40,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    lineHeight: 60, // Added to prevent vertical clipping on Android
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 32,
    textAlign: 'center',
  },
  link: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    overflow: 'hidden',
  },
  linkText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
