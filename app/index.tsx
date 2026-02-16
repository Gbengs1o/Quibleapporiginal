import LogoLoader from '@/components/LogoLoader';
import { useAuth } from '@/contexts/auth';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function Index() {
  const { isReady } = useAuth();

  if (!isReady) {
    return (
      <View style={styles.container}>
        <LogoLoader size={80} />
      </View>
    );
  }

  // Always redirect to Home/Tabs. The Layout/Screens will handle protection.
  return <Redirect href="/(tabs)/Home" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
