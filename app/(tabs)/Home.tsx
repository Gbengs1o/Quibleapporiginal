import DeliveryCard from '@/components/DeliveryCard';
import HomeHeader from '@/components/HomeHeader';
import SidePanel from '@/components/SidePanel';
import { ThemedView } from '@/components/themed-view';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

export default function HomeScreen() {
  const [isSidePanelOpen, setSidePanelOpen] = useState(false);

  const toggleSidePanel = () => {
    setSidePanelOpen(!isSidePanelOpen);
  };

  return (
    <ThemedView style={styles.container}>
      <HomeHeader onMenuPress={toggleSidePanel} />
      <DeliveryCard />
      <SidePanel isOpen={isSidePanelOpen} onClose={toggleSidePanel} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
