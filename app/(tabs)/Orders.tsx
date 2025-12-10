import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OrderStatus, useOrders } from '@/contexts/order';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

const STEPS: { status: OrderStatus; label: string; icon: any }[] = [
  { status: 'received', label: 'Order Received', icon: 'document-text-outline' },
  { status: 'preparing', label: 'Being Prepared', icon: 'restaurant-outline' },
  { status: 'ready', label: 'Packaged / Ready', icon: 'cube-outline' },
  { status: 'with_rider', label: 'On the Way', icon: 'bicycle-outline' },
];

export default function OrdersScreen() {
  const { activeOrders, pastOrders, refreshOrders, loading } = useOrders();
  const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
  const secondaryText = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
  const accentColor = '#f27c22';

  const getStepIndex = (status: OrderStatus) => {
    if (status === 'delivered') return 4;
    return STEPS.findIndex(s => s.status === status);
  };

  const renderTracker = (status: OrderStatus) => {
    const currentIndex = getStepIndex(status);

    return (
      <View style={styles.trackerContainer}>
        {STEPS.map((step, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <View key={step.status} style={styles.stepWrapper}>
              <View style={[
                styles.stepIcon,
                { backgroundColor: isActive ? accentColor : 'rgba(0,0,0,0.1)' },
                isCurrent && styles.pulsingStep
              ]}>
                <Ionicons name={step.icon} size={16} color={isActive ? '#fff' : '#888'} />
              </View>
              {index < STEPS.length - 1 && (
                <View style={[styles.stepLine, { backgroundColor: index < currentIndex ? accentColor : 'rgba(0,0,0,0.1)' }]} />
              )}
              {isCurrent && (
                <ThemedText style={styles.stepLabel}>{step.label}</ThemedText>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderOrder = ({ item: order }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {order.restaurant?.image_url && (
            <Image source={{ uri: order.restaurant.image_url }} style={styles.restImage} />
          )}
          <View style={{ marginLeft: 10 }}>
            <ThemedText style={{ fontWeight: 'bold' }}>{order.restaurant?.name || 'Restaurant'}</ThemedText>
            <ThemedText style={{ fontSize: 12, color: secondaryText }}>
              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
          </View>
        </View>
        <ThemedText style={{ fontWeight: 'bold' }}>₦{order.total_amount.toLocaleString()}</ThemedText>
      </View>

      <View style={styles.divider} />

      <View style={styles.itemsList}>
        {order.items?.map((item: any, idx: number) => (
          <ThemedText key={idx} style={{ fontSize: 14, color: secondaryText }}>
            {item.quantity}x {item.menu_item?.name}
          </ThemedText>
        ))}
      </View>

      <View style={styles.divider} />

      {/* Live Tracker */}
      <ThemedText style={styles.trackerTitle}>Live Status</ThemedText>
      {renderTracker(order.status)}

    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.pageTitle}>My Orders</ThemedText>

      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshOrders} />}>
        {activeOrders.length > 0 ? (
          <View>
            <ThemedText style={styles.sectionTitle}>Active Orders</ThemedText>
            {activeOrders.map(order => <View key={order.id}>{renderOrder({ item: order })}</View>)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="fast-food-outline" size={64} color={secondaryText} />
            <ThemedText style={{ marginTop: 10, color: secondaryText }}>No active orders right now.</ThemedText>
          </View>
        )}

        {pastOrders.length > 0 && (
          <View style={{ marginTop: 30, opacity: 0.8 }}>
            <ThemedText style={styles.sectionTitle}>Past Orders</ThemedText>
            {pastOrders.map(order => (
              <View key={order.id}>
                {renderOrder({ item: order })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  pageTitle: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { paddingHorizontal: 20, marginBottom: 10, fontSize: 18, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },

  card: { marginHorizontal: 20, marginBottom: 20, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  restImage: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 12 },
  itemsList: { marginBottom: 4 },

  trackerTitle: { fontSize: 12, fontWeight: 'bold', color: '#888', marginBottom: 12, textTransform: 'uppercase' },
  trackerContainer: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  stepWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  stepLine: { flex: 1, height: 2, marginHorizontal: -4 }, // Negative margin to connect icons
  stepLabel: { position: 'absolute', top: 36, left: -20, width: 80, textAlign: 'center', fontSize: 10, fontWeight: 'bold' },

  pulsingStep: { borderWidth: 2, borderColor: '#f27c22' }
});
