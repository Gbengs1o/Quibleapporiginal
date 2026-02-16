import LogoLoader from '@/components/LogoLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { OrderStatus } from '@/contexts/order';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const STEPS: { status: OrderStatus; label: string; icon: any }[] = [
    { status: 'received', label: 'Received', icon: 'document-text' },
    { status: 'preparing', label: 'Preparing', icon: 'restaurant' },
    { status: 'ready', label: 'Ready', icon: 'cube' },
    { status: 'with_rider', label: 'On the Way', icon: 'bicycle' },
];

export default function OrderDetailScreen() {
    const { id: orderId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const { user } = useAuth();
    const isDark = theme === 'dark';

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [existingReview, setExistingReview] = useState<any>(null);

    // Map & Tracking State
    const mapRef = useRef<MapView>(null);
    const [userLocation, setUserLocation] = useState<any>(null);
    const [riderLocation, setRiderLocation] = useState<any>(null);
    const [routeCoords, setRouteCoords] = useState<any[]>([]);

    // Rating State
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [restaurantRating, setRestaurantRating] = useState(0);
    const [restaurantComment, setRestaurantComment] = useState('');
    const [itemRatings, setItemRatings] = useState<Record<string, { rating: number; comment: string }>>({});

    // Rider Rating State
    const [riderRating, setRiderRating] = useState(0);
    const [riderComment, setRiderComment] = useState('');
    const [existingRiderReview, setExistingRiderReview] = useState<any>(null);

    const [submittingReview, setSubmittingReview] = useState(false);
    const [showItemRatings, setShowItemRatings] = useState(false);

    // Theme colors
    const colors = {
        bg: isDark ? '#0A0A0F' : '#F4F5F9',
        cardBg: isDark ? '#1A1A22' : '#FFFFFF',
        cardBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
        text: isDark ? '#FFFFFF' : '#1F2050',
        textSecondary: isDark ? '#8E8E93' : '#6B7280',
        textMuted: isDark ? '#636366' : '#9CA3AF',
        accent: '#F27C22',
        accentLight: isDark ? 'rgba(242,124,34,0.15)' : 'rgba(242,124,34,0.08)',
        teal: '#26A69A',
        navy: '#1F2050',
        stepInactive: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    };

    useEffect(() => {
        if (orderId) {
            fetchOrder();
            fetchExistingReview();
        }
    }, [orderId]);

    // Track User Location
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const loc = await Location.getCurrentPositionAsync({});
            setUserLocation(loc.coords);
        })();
    }, []);

    // Track Rider Location (Real-time)
    useEffect(() => {
        if (!order?.rider_id) return;

        // Fetch initial rider location
        const fetchRiderLoc = async () => {
            const { data } = await supabase
                .from('riders')
                .select('current_latitude, current_longitude')
                .eq('user_id', order.rider_id)
                .single();

            if (data?.current_latitude && data?.current_longitude) {
                setRiderLocation({
                    latitude: data.current_latitude,
                    longitude: data.current_longitude
                });
            }
        };
        fetchRiderLoc();

        // Subscribe to rider updates
        const channel = supabase
            .channel(`rider_track_${order.rider_id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'riders',
                    filter: `user_id=eq.${order.rider_id}`
                },
                (payload) => {
                    const newLoc = payload.new;
                    if (newLoc.current_latitude && newLoc.current_longitude) {
                        const loc = {
                            latitude: newLoc.current_latitude,
                            longitude: newLoc.current_longitude
                        };
                        setRiderLocation(loc);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [order?.rider_id]);

    // Update Route & Fit Map
    useEffect(() => {
        if (!mapRef.current || !order?.restaurant) return;

        const points = [];
        // 1. Restaurant (Always there)
        if (order.restaurant.latitude && order.restaurant.longitude) {
            points.push({
                latitude: order.restaurant.latitude,
                longitude: order.restaurant.longitude
            });
        }

        // 2. Rider (If available)
        if (riderLocation) {
            points.push(riderLocation);
        }

        // 3. User (If available)
        if (userLocation) {
            points.push({
                latitude: userLocation.latitude,
                longitude: userLocation.longitude
            });
        }

        // Determine route line (Simple straight line for now)
        // If rider exists: Rider -> User
        // Else: Restaurant -> User
        if (userLocation && order.restaurant.latitude) {
            const start = riderLocation || {
                latitude: order.restaurant.latitude,
                longitude: order.restaurant.longitude
            };
            setRouteCoords([
                start,
                { latitude: userLocation.latitude, longitude: userLocation.longitude }
            ]);
        }

        if (points.length > 1) {
            mapRef.current.fitToCoordinates(points, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
            });
        }
    }, [order?.restaurant, riderLocation, userLocation]);

    const fetchOrder = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*, restaurant:restaurants(*), items:order_items(*, menu_item:menu_items(*))')
                .eq('id', orderId)
                .single();

            if (error) throw error;
            setOrder(data);
        } catch (error) {
            console.error('Error fetching order:', error);
            Alert.alert('Error', 'Failed to load order details');
        } finally {
            setLoading(false);
        }
    };

    const fetchExistingReview = async () => {
        try {
            // Fetch Restaurant Review
            const { data: restReview } = await supabase.rpc('get_order_review', { p_order_id: orderId });
            if (restReview) setExistingReview(restReview);

            // Fetch Rider Review
            if (order?.rider_id) {
                const { data: riderReview } = await supabase
                    .from('rider_reviews')
                    .select('*')
                    .eq('order_id', orderId)
                    .eq('reviewer_id', user?.id)
                    .single();

                if (riderReview) setExistingRiderReview(riderReview);
            }
        } catch (error) {
            console.error('Review fetch error:', error);
        }
    };

    const handleChat = async () => {
        try {
            const { data: chatId, error } = await supabase.rpc('get_or_create_order_chat', {
                p_order_id: orderId
            });

            if (error) throw error;
            router.push(`/order-chat/${chatId}`);
        } catch (error) {
            console.error('Chat error:', error);
            Alert.alert('Error', 'Failed to open chat');
        }
    };

    const handleCall = () => {
        const phone = order?.restaurant?.phone;
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        } else {
            Alert.alert('No Phone', 'Restaurant phone number not available');
        }
    };

    const handleSubmitReview = async () => {
        if (restaurantRating === 0 && riderRating === 0) {
            Alert.alert('Rating Required', 'Please rate the restaurant or the rider');
            return;
        }

        setSubmittingReview(true);
        try {
            const promises = [];

            // 1. Submit Restaurant Review
            if (restaurantRating > 0 && !existingReview) {
                const itemReviews = Object.entries(itemRatings)
                    .filter(([, val]) => val.rating > 0)
                    .map(([itemId, val]) => ({
                        order_item_id: itemId,
                        rating: val.rating,
                        comment: val.comment || null
                    }));

                promises.push(
                    supabase.rpc('submit_order_review', {
                        p_order_id: orderId,
                        p_restaurant_rating: restaurantRating,
                        p_restaurant_comment: restaurantComment || null,
                        p_item_reviews: itemReviews
                    }).then(({ data, error }) => {
                        if (error) throw error;
                        if (!data?.success) throw new Error(data?.message || 'Failed to submit restaurant review');
                        setExistingReview({
                            restaurant_rating: restaurantRating,
                            restaurant_comment: restaurantComment,
                            item_reviews: itemReviews
                        });
                    })
                );
            }

            // 2. Submit Rider Review
            if (riderRating > 0 && !existingRiderReview) {
                promises.push(
                    supabase.rpc('submit_rider_review', {
                        p_order_id: orderId,
                        p_rating: riderRating,
                        p_comment: riderComment || null
                    }).then(({ data, error }) => {
                        if (error) throw error;
                        if (!data?.success) throw new Error(data?.message || 'Failed to submit rider review');
                        setExistingRiderReview({
                            rating: riderRating,
                            comment: riderComment
                        });
                    })
                );
            }

            await Promise.all(promises);

            Alert.alert('Thank You!', 'Your review has been submitted');
            setShowRatingModal(false);

        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to submit review');
        } finally {
            setSubmittingReview(false);
        }
    };

    const getStepIndex = (status: OrderStatus) => {
        if (status === 'delivered') return 4;
        if (status === 'out_for_delivery') return 3;
        return STEPS.findIndex(s => s.status === status);
    };

    const renderTracker = () => {
        const currentIndex = getStepIndex(order?.status || 'received');
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
                            <ThemedText style={[styles.stepLabel, { color: isActive ? colors.text : colors.textMuted }]}>
                                {step.label}
                            </ThemedText>
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

    const renderMap = () => {
        if (!order?.restaurant?.latitude || !order?.restaurant?.longitude) return null;
        if (!userLocation && !riderLocation) return null; // Need at least one other point

        return (
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                        latitude: order.restaurant.latitude,
                        longitude: order.restaurant.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                    showsUserLocation={true} // Show blue dot for user
                    customMapStyle={isDark ? [
                        { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
                        { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
                        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
                        // ... simplified dark style
                    ] : []}
                >
                    {/* Restaurant Marker */}
                    <Marker
                        coordinate={{
                            latitude: order.restaurant.latitude,
                            longitude: order.restaurant.longitude
                        }}
                        title={order.restaurant.name}
                        description="Order Pickup"
                    >
                        <View style={[styles.markerContainer, { backgroundColor: colors.cardBg }]}>
                            <Ionicons name="restaurant" size={16} color={colors.accent} />
                        </View>
                    </Marker>

                    {/* Rider Marker */}
                    {riderLocation && (
                        <Marker
                            coordinate={riderLocation}
                            title="Rider"
                            description="Your order is on the way"
                        >
                            <View style={[styles.markerContainer, { backgroundColor: colors.navy }]}>
                                <Ionicons name="bicycle" size={18} color="#fff" />
                            </View>
                        </Marker>
                    )}

                    {/* Route Line */}
                    {routeCoords.length > 1 && (
                        <Polyline
                            coordinates={routeCoords}
                            strokeWidth={3}
                            strokeColor={colors.accent}
                            lineDashPattern={[5, 5]}
                        />
                    )}
                </MapView>

                {/* Map Overlay Info */}
                {riderLocation && (
                    <View style={[styles.mapOverlay, { backgroundColor: colors.cardBg }]}>
                        <Ionicons name="bicycle" size={20} color={colors.accent} />
                        <ThemedText style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>
                            Rider is active
                        </ThemedText>
                    </View>
                )}
            </View>
        );
    };

    const renderStars = (rating: number, onPress: (r: number) => void, size = 28) => (
        <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => onPress(star)}>
                    <Ionicons
                        name={star <= rating ? 'star' : 'star-outline'}
                        size={size}
                        color={star <= rating ? '#FFB800' : colors.textMuted}
                        style={{ marginHorizontal: 2 }}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );

    if (loading) {
        return (
            <ThemedView style={[styles.container, styles.centerContent]}>
                <LogoLoader size={80} />
            </ThemedView>
        );
    }

    if (!order) {
        return (
            <ThemedView style={[styles.container, styles.centerContent]}>
                <Ionicons name="alert-circle" size={60} color={colors.accent} />
                <ThemedText style={[styles.errorText, { color: colors.text }]}>Order not found</ThemedText>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    const isDelivered = order.status === 'delivered';
    const canReview = isDelivered && !existingReview;

    return (
        <ThemedView style={[styles.container, { backgroundColor: colors.bg }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <Animated.View
                entering={FadeInUp.duration(400)}
                style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.cardBg }]}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <View style={[styles.backBtnBg, { backgroundColor: isDark ? '#ffffff10' : colors.navy + '10' }]}>
                        <Ionicons name="chevron-back" size={22} color={colors.text} />
                    </View>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Order Details</ThemedText>
                    <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                        #{orderId?.slice(0, 8)}
                    </ThemedText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isDelivered ? '#22C55E20' : colors.accentLight }]}>
                    <ThemedText style={[styles.statusText, { color: isDelivered ? '#22C55E' : colors.accent }]}>
                        {order.status?.replace('_', ' ').toUpperCase()}
                    </ThemedText>
                </View>
            </Animated.View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
            >
                {/* Restaurant Card */}
                <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                    <TouchableOpacity
                        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
                        activeOpacity={0.85}
                        onPress={() => router.push(`/restaurant-profile/${order.restaurant?.id}`)}
                    >
                        <View style={styles.restaurantRow}>
                            {order.restaurant?.image_url ? (
                                <Image source={{ uri: order.restaurant.image_url }} style={styles.restaurantImage} />
                            ) : (
                                <LinearGradient colors={[colors.accent, '#E86A10']} style={styles.restaurantImagePlaceholder}>
                                    <Ionicons name="restaurant" size={24} color="#fff" />
                                </LinearGradient>
                            )}
                            <View style={styles.restaurantInfo}>
                                <ThemedText style={[styles.restaurantName, { color: colors.text }]}>
                                    {order.restaurant?.name || 'Restaurant'}
                                </ThemedText>
                                <ThemedText style={[styles.restaurantAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {order.restaurant?.address || 'Location'}
                                </ThemedText>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </View>
                    </TouchableOpacity>
                </Animated.View>

                {/* Status Tracker */}
                {!isDelivered && (
                    <Animated.View
                        entering={FadeInDown.delay(200).duration(400)}
                        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, overflow: 'hidden' }]}
                    >
                        <View style={styles.cardHeader}>
                            <View style={[styles.liveIndicator, { backgroundColor: colors.accent }]} />
                            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Live Status</ThemedText>
                        </View>
                        {renderTracker()}

                        {/* Insert Map if Applicable */}
                        {(order.status === 'preparing' || order.status === 'ready' || order.status === 'with_rider') && renderMap()}
                    </Animated.View>
                )}

                {/* Delivery Code Display */}
                {order.delivery_code && !isDelivered && (
                    <Animated.View
                        entering={FadeInDown.delay(250).duration(400)}
                        style={[styles.card, { backgroundColor: colors.accent, alignItems: 'center', paddingVertical: 24 }]}
                    >
                        <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 10, opacity: 0.9, letterSpacing: 1 }}>
                            SHARE WITH RIDER
                        </ThemedText>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {order.delivery_code.split('').map((digit: string, i: number) => (
                                <View key={i} style={{
                                    width: 52, height: 60, borderRadius: 12,
                                    backgroundColor: 'rgba(255,255,255,0.25)',
                                    justifyContent: 'center', alignItems: 'center',
                                }}>
                                    <Text style={{
                                        color: '#fff', fontSize: 30, fontWeight: '800',
                                        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                                    }}>
                                        {digit}
                                    </Text>
                                </View>
                            ))}
                        </View>
                        <ThemedText style={{ color: '#fff', fontSize: 11, opacity: 0.8, marginTop: 10 }}>
                            Only share upon delivery arrival
                        </ThemedText>
                    </Animated.View>
                )}

                {/* Order Items */}
                <Animated.View
                    entering={FadeInDown.delay(300).duration(400)}
                    style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
                >
                    <ThemedText style={[styles.cardTitle, { color: colors.text, marginBottom: 12 }]}>
                        Order Items
                    </ThemedText>
                    {order.items?.map((item: any, idx: number) => (
                        <View key={item.id} style={[styles.itemRow, idx < order.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.cardBorder }]}>
                            <View style={[styles.quantityBadge, { backgroundColor: colors.accentLight }]}>
                                <ThemedText style={[styles.quantityText, { color: colors.accent }]}>{item.quantity}x</ThemedText>
                            </View>
                            <View style={styles.itemInfo}>
                                <ThemedText style={[styles.itemName, { color: colors.text }]}>
                                    {item.menu_item?.name || 'Item'}
                                </ThemedText>
                                <ThemedText style={[styles.itemPrice, { color: colors.textSecondary }]}>
                                    ₦{(item.price_at_time * item.quantity).toLocaleString()}
                                </ThemedText>
                            </View>
                        </View>
                    ))}
                    <View style={[styles.totalRow, { borderTopColor: colors.cardBorder }]}>
                        <ThemedText style={[styles.totalLabel, { color: colors.text }]}>Total</ThemedText>
                        <ThemedText style={[styles.totalValue, { color: colors.accent }]}>
                            ₦{order.total_amount?.toLocaleString()}
                        </ThemedText>
                    </View>
                </Animated.View>

                {/* Communication Buttons */}
                <Animated.View
                    entering={FadeInDown.delay(400).duration(400)}
                    style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
                >
                    <ThemedText style={[styles.cardTitle, { color: colors.text, marginBottom: 12 }]}>
                        Need Help?
                    </ThemedText>
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accentLight }]} onPress={handleChat}>
                            <Ionicons name="chatbubbles" size={22} color={colors.accent} />
                            <ThemedText style={[styles.actionBtnText, { color: colors.accent }]}>Chat</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#22C55E20' }]} onPress={handleCall}>
                            <Ionicons name="call" size={22} color="#22C55E" />
                            <ThemedText style={[styles.actionBtnText, { color: '#22C55E' }]}>Call</ThemedText>
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Rating Section (After Delivery) */}
                {isDelivered && (
                    <Animated.View
                        entering={FadeInDown.delay(500).duration(400)}
                        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
                    >
                        <ThemedText style={[styles.cardTitle, { color: colors.text, marginBottom: 12 }]}>
                            {existingReview || existingRiderReview ? 'Your Reviews' : 'Rate Your Experience'}
                        </ThemedText>

                        {existingReview ? (
                            <View>
                                <ThemedText style={[styles.ratingSectionTitle, { color: colors.text, fontSize: 13, marginTop: 4 }]}>Restaurant</ThemedText>
                                {renderStars(existingReview.restaurant_rating, () => { }, 20)}
                                {existingReview.restaurant_comment && (
                                    <ThemedText style={[styles.reviewComment, { color: colors.textSecondary }]}>
                                        "{existingReview.restaurant_comment}"
                                    </ThemedText>
                                )}
                            </View>
                        ) : null}

                        {existingRiderReview ? (
                            <View style={{ marginTop: existingReview ? 12 : 0 }}>
                                <ThemedText style={[styles.ratingSectionTitle, { color: colors.text, fontSize: 13, marginTop: 4 }]}>Rider</ThemedText>
                                {renderStars(existingRiderReview.rating, () => { }, 20)}
                                {existingRiderReview.comment && (
                                    <ThemedText style={[styles.reviewComment, { color: colors.textSecondary }]}>
                                        "{existingRiderReview.comment}"
                                    </ThemedText>
                                )}
                            </View>
                        ) : null}

                        {(!existingReview || (order.rider_id && !existingRiderReview)) && (
                            <TouchableOpacity
                                style={[styles.rateBtn, { backgroundColor: colors.accent, marginTop: 12 }]}
                                onPress={() => setShowRatingModal(true)}
                            >
                                <Ionicons name="star" size={20} color="#fff" />
                                <ThemedText style={styles.rateBtnText}>Rate Experience</ThemedText>
                            </TouchableOpacity>
                        )}

                        {(existingReview && (!order.rider_id || existingRiderReview)) && (
                            <ThemedText style={[styles.reviewedLabel, { color: colors.teal }]}>
                                ✓ Thank you for your feedback!
                            </ThemedText>
                        )}
                    </Animated.View>
                )}
            </ScrollView>

            {/* Rating Modal */}
            <Modal
                visible={showRatingModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowRatingModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Rate Your Order</ThemedText>
                            <TouchableOpacity onPress={() => setShowRatingModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Restaurant Rating */}
                            {!existingReview && (
                                <View style={styles.ratingSection}>
                                    <ThemedText style={[styles.ratingSectionTitle, { color: colors.text }]}>Restaurant</ThemedText>
                                    {renderStars(restaurantRating, setRestaurantRating, 36)}
                                    <TextInput
                                        style={[styles.commentInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.cardBorder }]}
                                        placeholder="Share your experience..."
                                        placeholderTextColor={colors.textMuted}
                                        value={restaurantComment}
                                        onChangeText={setRestaurantComment}
                                        multiline
                                    />
                                </View>
                            )}

                            {/* Rider Rating */}
                            {!existingRiderReview && order.rider_id && (
                                <View style={styles.ratingSection}>
                                    <View style={{ height: 1, backgroundColor: colors.cardBorder, marginVertical: 16 }} />
                                    <ThemedText style={[styles.ratingSectionTitle, { color: colors.text }]}>Delivery Rider</ThemedText>
                                    {renderStars(riderRating, setRiderRating, 36)}
                                    <TextInput
                                        style={[styles.commentInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.cardBorder }]}
                                        placeholder="How was the delivery?"
                                        placeholderTextColor={colors.textMuted}
                                        value={riderComment}
                                        onChangeText={setRiderComment}
                                        multiline
                                    />
                                </View>
                            )}

                            {/* Food Items Toggle */}
                            <TouchableOpacity
                                style={[styles.toggleItemsBtn, { borderColor: colors.cardBorder }]}
                                onPress={() => setShowItemRatings(!showItemRatings)}
                            >
                                <ThemedText style={[styles.toggleItemsText, { color: colors.accent }]}>
                                    {showItemRatings ? 'Hide' : 'Rate'} Individual Items
                                </ThemedText>
                                <Ionicons name={showItemRatings ? 'chevron-up' : 'chevron-down'} size={20} color={colors.accent} />
                            </TouchableOpacity>

                            {/* Individual Item Ratings */}
                            {showItemRatings && order.items?.map((item: any) => (
                                <View key={item.id} style={[styles.itemRatingCard, { backgroundColor: colors.bg }]}>
                                    <ThemedText style={[styles.itemRatingName, { color: colors.text }]}>
                                        {item.menu_item?.name}
                                    </ThemedText>
                                    {renderStars(
                                        itemRatings[item.id]?.rating || 0,
                                        (r) => setItemRatings(prev => ({ ...prev, [item.id]: { ...prev[item.id], rating: r } })),
                                        24
                                    )}
                                    <TextInput
                                        style={[styles.itemComment, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.cardBorder }]}
                                        placeholder="Comment on this item..."
                                        placeholderTextColor={colors.textMuted}
                                        value={itemRatings[item.id]?.comment || ''}
                                        onChangeText={(t) => setItemRatings(prev => ({ ...prev, [item.id]: { ...prev[item.id], comment: t } }))}
                                    />
                                </View>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: submittingReview ? 0.6 : 1 }]}
                            onPress={handleSubmitReview}
                            disabled={submittingReview}
                        >
                            <ThemedText style={styles.submitBtnText}>
                                {submittingReview ? 'Submitting...' : 'Submit Review'}
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    errorText: { fontSize: 16, marginTop: 16, marginBottom: 24 },
    backButton: { padding: 12 },
    backButtonText: { fontSize: 16, fontWeight: '600', color: '#F27C22' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
    backBtn: { marginRight: 12 },
    backBtnBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 12 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    statusText: { fontSize: 12, fontWeight: '700' },
    card: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, borderWidth: 1 },
    restaurantRow: { flexDirection: 'row', alignItems: 'center' },
    restaurantImage: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
    restaurantImagePlaceholder: { width: 48, height: 48, borderRadius: 24, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
    restaurantInfo: { flex: 1 },
    restaurantName: { fontSize: 16, fontWeight: 'bold' },
    restaurantAddress: { fontSize: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    liveIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    cardTitle: { fontSize: 16, fontWeight: '600' },
    trackerContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    stepWrapper: { alignItems: 'center', flex: 1 },
    stepIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8, zIndex: 1 },
    stepLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
    stepLine: { position: 'absolute', top: 15, left: '50%', right: '-50%', height: 2, zIndex: 0 },
    mapContainer: { marginTop: 16, height: 200, borderRadius: 12, overflow: 'hidden' },
    map: { flex: 1 },
    markerContainer: { padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
    mapOverlay: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, gap: 6 },
    itemRow: { flexDirection: 'row', paddingVertical: 12, alignItems: 'flex-start' },
    quantityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 12, marginTop: 2 },
    quantityText: { fontSize: 12, fontWeight: '700' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
    itemPrice: { fontSize: 12 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1 },
    totalLabel: { fontSize: 16, fontWeight: '700' },
    totalValue: { fontSize: 18, fontWeight: '800' },
    actionRow: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 12, gap: 8 },
    actionBtnText: { fontSize: 14, fontWeight: '600' },
    starsRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 8 },
    reviewComment: { fontSize: 14, fontStyle: 'italic', marginTop: 8, textAlign: 'center' },
    rateBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 12, gap: 8 },
    rateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    reviewedLabel: { textAlign: 'center', fontSize: 14, fontWeight: '600', marginTop: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    ratingSection: { marginBottom: 24 },
    ratingSectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
    commentInput: { borderWidth: 1, borderRadius: 12, padding: 12, height: 100, textAlignVertical: 'top', marginTop: 12 },
    toggleItemsBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 12, gap: 8, marginBottom: 16 },
    toggleItemsText: { fontSize: 14, fontWeight: '600' },
    itemRatingCard: { padding: 16, borderRadius: 12, marginBottom: 12 },
    itemRatingName: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
    itemComment: { borderWidth: 1, borderRadius: 8, padding: 8, height: 60, marginTop: 8 },
    submitBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});


