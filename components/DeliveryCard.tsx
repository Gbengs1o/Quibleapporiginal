import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

const DeliveryCard = () => {
  const router = useRouter();
  const navy = '#1F2050';

  return (
    <TouchableOpacity
      style={[styles.quickSendCard, { backgroundColor: navy }]}
      onPress={() => router.push('/send-package')}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={['#1F2050', '#2A2D54']}
        style={styles.quickSendGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.quickSendContent}>
          <View style={styles.quickSendTextContent}>
            <ThemedText style={styles.quickSendTitle}>Send a Package</ThemedText>
            <ThemedText style={styles.quickSendSubtitle}>Find the nearest rider automatically</ThemedText>
            <View style={styles.quickSendBadge}>
              <ThemedText style={styles.quickSendBadgeText}>Fast Delivery</ThemedText>
            </View>
          </View>
          <View style={styles.quickSendImageContainer}>
            <Image
              source={require('@/assets/images/bike.png')}
              style={styles.quickSendImage}
            />
          </View>
        </View>
      </LinearGradient>
      <View style={styles.quickSendArrow}>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  quickSendCard: {
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  quickSendGradient: { padding: 20 },
  quickSendContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quickSendTextContent: { flex: 1, gap: 4 },
  quickSendTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  quickSendSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  quickSendBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(242, 124, 34, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
  quickSendBadgeText: { color: '#F27C22', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  quickSendImageContainer: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  quickSendImage: { width: 100, height: 100, resizeMode: 'contain' },
  quickSendArrow: { position: 'absolute', bottom: 16, right: 16, backgroundColor: 'rgba(255,255,255,0.1)', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
});

export default DeliveryCard;