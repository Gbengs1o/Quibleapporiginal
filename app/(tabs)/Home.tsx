import DeliveryCard from '@/components/DeliveryCard';
import HomeHeader from '@/components/HomeHeader';
import SidePanel from '@/components/SidePanel';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/utils/supabase';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

export default function HomeScreen() {
  const [isSidePanelOpen, setSidePanelOpen] = useState(false);
  const { user, isReady } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (error) throw error;
          setProfile(data);
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      } else {
        setProfile(null);
      }
    };

    if (isReady) {
      fetchProfile();
    }
  }, [user, isReady]);

  const toggleSidePanel = () => {
    setSidePanelOpen(!isSidePanelOpen);
  };

  return (
    <ThemedView style={styles.container}>
      <HomeHeader onMenuPress={toggleSidePanel} profile={profile} />
      <DeliveryCard />
      <SidePanel isOpen={isSidePanelOpen} onClose={toggleSidePanel} profile={profile} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
