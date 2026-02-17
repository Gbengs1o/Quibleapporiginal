import LogoLoader from '@/components/LogoLoader';
import MagmaAnimation from '@/components/MagmaAnimation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { OrderStatus, useOrders } from '@/contexts/order';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const STEPS: { status: OrderStatus; label: string; icon: any }[] = [
  { status: 'received', label: 'Received', icon: 'document-text' },
  { status: 'preparing', label: 'Preparing', icon: 'restaurant' },
  { status: 'ready', label: 'Ready', icon: 'cube' },
  { status: 'with_rider', label: 'On the Way', icon: 'bicycle' },
];

export default function OrdersScreen() {
  const { activeOrders, pastOrders, refreshOrders, loading: loadingOrders } = useOrders();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'food' | 'logistics'>('food');
  const [deliveryRequests, setDeliveryRequests] = useState<any[]>([]);
  const [loadingLogistics, setLoadingLogistics] = useState(false);

  // Theme-aware colors
  const colors = {
    bg: isDark ? '#0A0A0F' : '#F4F5F9',
    cardBg: isDark ? '#1A1A22' : '#FFFFFF',
    cardBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    text: isDark ? '#FFFFFF' : '#1F2050',
    textSecondary: isDark ? '#8E8E93' : '#6B7280',
    textMuted: isDark ? '#636366' : '#9CA3AF',
    divider: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    accent: '#F27C22',
    accentLight: isDark ? 'rgba(242,124,34,0.15)' : 'rgba(242,124,34,0.08)',
    teal: '#26A69A',
    tealLight: isDark ? 'rgba(38,166,154,0.15)' : 'rgba(38,166,154,0.08)',
    tabBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    stepInactive: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
  };

  // Tab animation
  const tabOffset = useSharedValue(0);
  const animatedTabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabOffset.value }],
  }));

  useEffect(() => {
    tabOffset.value = withSpring(activeTab === 'food' ? 0 : (width - 48) / 2, {
      damping: 18,
      stiffness: 150
    });
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'logistics' && user) {
      fetchDeliveryRequests();
    }
  }, [activeTab, user]);

  const fetchDeliveryRequests = async () => {
    setLoadingLogistics(true);
    try {
      const { data, error } = await supabase
        .from('delivery_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeliveryRequests(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingLogistics(false);
    }
  };

  const getStepIndex = (status: OrderStatus) => {
    if (status === 'delivered') return 4;
    if (status === 'out_for_delivery') return 3;
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
                {
                  backgroundColor: isActive ? colors.accent : colors.stepInactive,
                  borderWidth: isCurrent ? 2 : 0,
                  borderColor: isCurrent ? colors.accent : 'transparent',
                },
              ]}>
                <Ionicons
                  name={step.icon as any}
                  size={14}
                  color={isActive ? '#fff' : colors.textMuted}
                />
              </View>
              {index < STEPS.length - 1 && (
                <View style={[
                  styles.stepLine,
                  { backgroundColor: index < currentIndex ? colors.accent : colors.stepInactive }
                ]} />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // UNIQUE FOOD ORDER CARD
  // ─────────────────────────────────────────────────────────────
  const renderOrder = ({ item: order, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/order/${order.id}`)}
        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
      >
        {/* Decorative accent bar */}
        <View style={[styles.cardAccentBar, { backgroundColor: order.status === 'delivered' ? '#22C55E' : colors.accent }]} />

        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.restaurantInfo}>
            <View style={[styles.restaurantImageWrapper, { borderColor: colors.cardBorder }]}>
              {order.restaurant?.image_url ? (
                <Image source={{ uri: order.restaurant.image_url }} style={styles.restaurantImage} />
              ) : (
                <LinearGradient
                  colors={[colors.accent, '#E86A10']}
                  style={styles.restaurantImagePlaceholder}
                >
                  <Ionicons name="restaurant" size={20} color="#fff" />
                </LinearGradient>
              )}
            </View>
            <View style={styles.restaurantDetails}>
              <ThemedText style={[styles.restaurantName, { color: colors.text }]}>
                {order.restaurant?.name || 'Restaurant'}
              </ThemedText>
              <View style={styles.orderMeta}>
                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                <ThemedText style={[styles.orderTime, { color: colors.textSecondary }]}>
                  {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.priceContainer, { backgroundColor: colors.accentLight }]}>
            <ThemedText style={[styles.priceText, { color: colors.accent }]}>
              ₦{order.total_amount?.toLocaleString() || '0'}
            </ThemedText>
          </View>
        </View>

        {/* Items List */}
        <View style={[styles.itemsContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
          {order.items?.slice(0, 3).map((item: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <View style={[styles.itemQuantityBadge, { backgroundColor: colors.accentLight }]}>
                <ThemedText style={[styles.itemQuantity, { color: colors.accent }]}>{item.quantity}x</ThemedText>
              </View>
              <ThemedText numberOfLines={1} style={[styles.itemName, { color: colors.text }]}>
                {item.menu_item?.name || 'Item'}
              </ThemedText>
            </View>
          ))}
          {order.items?.length > 3 && (
            <ThemedText style={[styles.moreItems, { color: colors.textMuted }]}>
              +{order.items.length - 3} more items
            </ThemedText>
          )}
        </View>

        {/* Progress Tracker or Delivered State */}
        {order.status === 'delivered' ? (
          <View style={[styles.deliveredBanner, { backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.06)' }]}>
            <View style={styles.deliveredRow}>
              <View style={[styles.deliveredIcon, { backgroundColor: '#22C55E' }]}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.deliveredTitle, { color: '#22C55E' }]}>
                  Delivered
                </ThemedText>
                <ThemedText style={[styles.deliveredSubtitle, { color: colors.textSecondary }]}>
                  Your order has been completed
                </ThemedText>
              </View>
              <View style={[styles.ratePrompt, { backgroundColor: '#22C55E' }]}>
                <Ionicons name="star" size={14} color="#fff" />
                <ThemedText style={styles.ratePromptText}>Rate</ThemedText>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.trackerSection}>
            <View style={styles.trackerHeader}>
              <View style={styles.trackerLabelRow}>
                <View style={[styles.liveIndicator, { backgroundColor: colors.accent }]} />
                <ThemedText style={[styles.trackerLabel, { color: colors.textSecondary }]}>
                  Live Status
                </ThemedText>
              </View>
              <View style={[styles.statusPill, { backgroundColor: colors.accentLight }]}>
                <ThemedText style={[styles.statusPillText, { color: colors.accent }]}>
                  {order.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                </ThemedText>
              </View>
            </View>
            {renderTracker(order.status)}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );


  // ─────────────────────────────────────────────────────────────
  // UNIQUE DELIVERY REQUEST CARD
  // ─────────────────────────────────────────────────────────────
  const renderDeliveryRequest = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
        activeOpacity={0.85}
        onPress={() => router.push(`/send-package/request/${item.id}`)}
      >
        {/* Decorative accent bar - teal for logistics */}
        <View style={[styles.cardAccentBar, { backgroundColor: colors.teal }]} />

        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.restaurantInfo}>
            <View style={[styles.packageIconWrapper, { backgroundColor: colors.tealLight }]}>
              <Ionicons name="cube" size={22} color={colors.teal} />
            </View>
            <View style={styles.restaurantDetails}>
              <ThemedText style={[styles.restaurantName, { color: colors.text }]}>
                Package Delivery
              </ThemedText>
              <View style={styles.orderMeta}>
                <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                <ThemedText style={[styles.orderTime, { color: colors.textSecondary }]}>
                  {new Date(item.created_at).toLocaleDateString()}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <ThemedText style={[styles.priceText, { color: colors.teal, fontSize: 18 }]}>
              ₦{(item.final_price || item.offered_price)?.toLocaleString() || '0'}
            </ThemedText>
            <View style={[styles.statusPill, { backgroundColor: colors.tealLight, marginTop: 4 }]}>
              <ThemedText style={[styles.statusPillText, { color: colors.teal }]}>
                {item.status?.toUpperCase() || 'PENDING'}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Route Visualization */}
        <View style={[styles.routeContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
          <View style={styles.routeRow}>
            <View style={styles.routeIconCol}>
              <View style={[styles.routeDotStart, { backgroundColor: colors.teal }]} />
              <View style={[styles.routeLine, { backgroundColor: colors.divider }]} />
              <View style={[styles.routeDotEnd, { backgroundColor: colors.accent }]} />
            </View>
            <View style={styles.routeTextCol}>
              <View style={styles.routeAddress}>
                <ThemedText style={[styles.routeLabel, { color: colors.textMuted }]}>PICKUP</ThemedText>
                <ThemedText numberOfLines={1} style={[styles.routeAddressText, { color: colors.text }]}>
                  {item.pickup_address || 'Pickup location'}
                </ThemedText>
              </View>
              <View style={[styles.routeAddress, { marginTop: 12 }]}>
                <ThemedText style={[styles.routeLabel, { color: colors.textMuted }]}>DROP-OFF</ThemedText>
                <ThemedText numberOfLines={1} style={[styles.routeAddressText, { color: colors.text }]}>
                  {item.dropoff_address || 'Delivery location'}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Action Banner */}
        {item.status === 'pending' && (
          <LinearGradient
            colors={isDark ? ['#1F2050', '#0F0F18'] : ['#1F2050', '#2A2A5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionBanner}
          >
            <View style={styles.actionBannerContent}>
              <Ionicons name="flash" size={16} color={colors.accent} />
              <ThemedText style={styles.actionBannerText}>View active bids</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </LinearGradient>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  // ─────────────────────────────────────────────────────────────
  // EMPTY STATE
  // ─────────────────────────────────────────────────────────────
  const renderEmptyState = (type: 'food' | 'logistics') => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyAnimationWrapper}>
        <MagmaAnimation size={140} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
        {type === 'food' ? 'No orders yet' : 'No deliveries yet'}
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {type === 'food'
          ? 'Your food orders will appear here once you place them'
          : 'Request a rider to send your packages anywhere'}
      </ThemedText>
    </View>
  );



  if (loadingOrders && activeOrders.length === 0 && pastOrders.length === 0) {
    return (
      <ThemedView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <LogoLoader size={80} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 100 }]}>
        <View style={styles.headerTextContainer}>
          <ThemedText style={[styles.pageTitle, { color: isDark ? '#FFFFFF' : '#1F2050' }]}>My Orders</ThemedText>
          <ThemedText style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
            Track all your requests
          </ThemedText>
        </View>

        {/* Decorative Magma */}
        <View style={styles.headerMagma}>
          <MagmaAnimation size={120} />
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <View style={[styles.tabBackground, { backgroundColor: colors.tabBg }]}>
          <Animated.View style={[styles.tabIndicator, animatedTabIndicatorStyle]} />
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab('food')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={activeTab === 'food' ? 'fast-food' : 'fast-food-outline'}
              size={18}
              color={activeTab === 'food' ? '#fff' : colors.textSecondary}
            />
            <ThemedText style={[
              styles.tabItemText,
              { color: activeTab === 'food' ? '#fff' : colors.textSecondary }
            ]}>
              Food
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab('logistics')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={activeTab === 'logistics' ? 'cube' : 'cube-outline'}
              size={18}
              color={activeTab === 'logistics' ? '#fff' : colors.textSecondary}
            />
            <ThemedText style={[
              styles.tabItemText,
              { color: activeTab === 'logistics' ? '#fff' : colors.textSecondary }
            ]}>
              Deliveries
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={loadingOrders || loadingLogistics}
            onRefresh={activeTab === 'food' ? refreshOrders : fetchDeliveryRequests}
            tintColor={colors.accent}
          />
        }
      >
        {activeTab === 'food' ? (
          <>
            {activeOrders.length > 0 && (
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                  Active Orders
                </ThemedText>
                {activeOrders.map((order, index) => (
                  <View key={order.id}>{renderOrder({ item: order, index })}</View>
                ))}
              </View>
            )}

            {/* Recently Delivered - prominent section for orders delivered in last 2 hours */}
            {(() => {
              const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
              const recentlyDelivered = pastOrders.filter(
                (o) => o.status === 'delivered' && o.updated_at && o.updated_at > twoHoursAgo
              );
              const olderPastOrders = pastOrders.filter(
                (o) => !(o.status === 'delivered' && o.updated_at && o.updated_at > twoHoursAgo)
              );
              return (
                <>
                  {recentlyDelivered.length > 0 && (
                    <View style={styles.section}>
                      <View style={styles.deliveredSectionHeader}>
                        <View style={[styles.deliveredSectionDot, { backgroundColor: '#22C55E' }]} />
                        <ThemedText style={[styles.sectionTitle, { color: '#22C55E', marginBottom: 0 }]}>
                          Just Delivered
                        </ThemedText>
                      </View>
                      {recentlyDelivered.map((order, index) => (
                        <View key={order.id}>{renderOrder({ item: order, index })}</View>
                      ))}
                    </View>
                  )}
                  {olderPastOrders.length > 0 && (
                    <View style={styles.section}>
                      <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        Past Orders
                      </ThemedText>
                      {olderPastOrders.map((order, index) => (
                        <View key={order.id} style={{ opacity: 0.7 }}>
                          {renderOrder({ item: order, index })}
                        </View>
                      ))}
                    </View>
                  )}
                </>
              );
            })()}

            {activeOrders.length === 0 && pastOrders.length === 0 && renderEmptyState('food')}
          </>
        ) : (
          <>
            {deliveryRequests.length > 0 ? (
              <View style={styles.section}>
                {deliveryRequests.map((req, index) => (
                  <View key={req.id}>{renderDeliveryRequest({ item: req, index })}</View>
                ))}
              </View>
            ) : (
              renderEmptyState('logistics')
            )}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  headerTextContainer: {
    zIndex: 2,
  },
  headerMagma: {
    position: 'absolute',
    right: -30,
    top: 0,
    opacity: 0.15,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    marginTop: 4,
  },

  // Tabs
  tabContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tabBackground: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    width: '50%',
    height: '100%',
    backgroundColor: '#F27C22',
    borderRadius: 12,
    left: 4,
    top: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    zIndex: 2,
  },
  tabItemText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  // Cards
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  restaurantImageWrapper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
  },
  restaurantImage: {
    width: '100%',
    height: '100%',
  },
  restaurantImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  packageIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantDetails: {
    marginLeft: 12,
    flex: 1,
  },
  restaurantName: {
    fontSize: 17,
    fontWeight: '700',
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  orderTime: {
    fontSize: 13,
  },
  priceContainer: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 17,
    fontWeight: '800',
  },

  // Items
  itemsContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemQuantityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  moreItems: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Tracker
  trackerSection: {
    marginTop: 16,
  },
  trackerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  trackerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackerLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trackerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLine: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 4,
  },

  // Route
  routeContainer: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
  },
  routeRow: {
    flexDirection: 'row',
  },
  routeIconCol: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  routeDotStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  routeDotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeTextCol: {
    flex: 1,
  },
  routeAddress: {},
  routeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeAddressText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Action Banner
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
  },
  actionBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyAnimationWrapper: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Delivered Banner
  deliveredBanner: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
  },
  deliveredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deliveredIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveredTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  deliveredSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  ratePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ratePromptText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Delivered Section Header
  deliveredSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  deliveredSectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // Tap Hint for delivered orders
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 12,
    borderRadius: 10,
    gap: 6,
  },
  tapHintText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
