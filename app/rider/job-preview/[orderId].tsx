import LottieLoader from '@/components/LottieLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const { width } = Dimensions.get('window');

interface OrderDetails {
    id: string;
    total_amount: number;
    delivery_fee: number;
    pickup_code: string;
    pickup_latitude: number;
    pickup_longitude: number;
    dropoff_latitude: number;
    dropoff_longitude: number;
    restaurant: {
        name: string;
        address: string;
        latitude?: number;
        longitude?: number;
    };
}

// Calculate distance between two points (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Estimate time based on distance (assuming 25 km/h average city speed)
const estimateTime = (distanceKm: number): number => {
    const avgSpeedKmH = 25;
    return Math.ceil((distanceKm / avgSpeedKmH) * 60); // Returns minutes
};

export default function JobPreviewScreen() {
    const { orderId, amount } = useLocalSearchParams<{ orderId: string; amount: string }>();
    const router = useRouter();
    const { session } = useAuth();

    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#121212' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1E1E1E' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const subtleColor = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
    const [riderLocation, setRiderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [distances, setDistances] = useState({
        riderToRestaurant: 0,
        restaurantToCustomer: 0,
        total: 0,
    });
    const [etaMinutes, setEtaMinutes] = useState({
        toRestaurant: 0,
        toCustomer: 0,
        total: 0,
    });
    const [inviteCountdown, setInviteCountdown] = useState<number | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        fetchData();
    }, [orderId]);

    const fetchData = async () => {
        try {
            // Get rider's current location
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({});
                setRiderLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
            }

            // Fetch order details using RPC (bypasses RLS)
            const { data, error } = await supabase
                .rpc('get_order_job_details', {
                    p_order_id: orderId,
                    p_rider_id: session?.user?.id
                });

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('Order not found or you do not have access');
            }

            // Transform RPC result to expected format
            const orderData = data[0];
            const formattedOrder = {
                id: orderData.the_order_id,
                total_amount: orderData.the_total_amount,
                delivery_fee: orderData.the_delivery_fee,
                pickup_code: orderData.the_pickup_code,
                pickup_latitude: orderData.the_pickup_latitude || orderData.the_restaurant_latitude,
                pickup_longitude: orderData.the_pickup_longitude || orderData.the_restaurant_longitude,
                dropoff_latitude: orderData.the_dropoff_latitude,
                dropoff_longitude: orderData.the_dropoff_longitude,
                restaurant: {
                    name: orderData.the_restaurant_name,
                    address: orderData.the_restaurant_address,
                    latitude: orderData.the_restaurant_latitude,
                    longitude: orderData.the_restaurant_longitude,
                }
            };
            setOrderDetails(formattedOrder as OrderDetails);

            // Check invite expiry
            const { data: bidData } = await supabase
                .from('order_rider_bids')
                .select('id, status, expired_at')
                .eq('order_id', orderId)
                .eq('rider_id', session?.user?.id)
                .in('status', ['invited', 'expired'])
                .maybeSingle();

            if (bidData) {
                if (bidData.status === 'expired') {
                    // Silently go back — rider is notified via the notifications page
                    router.back();
                    return;
                }
                if (bidData.expired_at) {
                    const remaining = Math.max(0, Math.floor((new Date(bidData.expired_at).getTime() - Date.now()) / 1000));
                    setInviteCountdown(remaining);
                }
            }

            // Calculate distances and ETAs
            if (riderLocation && formattedOrder.pickup_latitude && formattedOrder.dropoff_latitude) {
                const restLat = formattedOrder.pickup_latitude || formattedOrder.restaurant?.latitude;
                const restLng = formattedOrder.pickup_longitude || formattedOrder.restaurant?.longitude;
                const custLat = formattedOrder.dropoff_latitude;
                const custLng = formattedOrder.dropoff_longitude;

                if (restLat && restLng && custLat && custLng) {
                    const d1 = calculateDistance(riderLocation.latitude, riderLocation.longitude, restLat, restLng);
                    const d2 = calculateDistance(restLat, restLng, custLat, custLng);

                    setDistances({
                        riderToRestaurant: d1,
                        restaurantToCustomer: d2,
                        total: d1 + d2,
                    });

                    setEtaMinutes({
                        toRestaurant: estimateTime(d1),
                        toCustomer: estimateTime(d2),
                        total: estimateTime(d1 + d2),
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching order:', error);
            Alert.alert('Error', 'Could not load order details');
        } finally {
            setLoading(false);
        }
    };

    // Recalculate when rider location updates
    useEffect(() => {
        if (riderLocation && orderDetails) {
            const restLat = orderDetails.pickup_latitude;
            const restLng = orderDetails.pickup_longitude;
            const custLat = orderDetails.dropoff_latitude;
            const custLng = orderDetails.dropoff_longitude;

            if (restLat && restLng && custLat && custLng) {
                const d1 = calculateDistance(riderLocation.latitude, riderLocation.longitude, restLat, restLng);
                const d2 = calculateDistance(restLat, restLng, custLat, custLng);

                setDistances({
                    riderToRestaurant: d1,
                    restaurantToCustomer: d2,
                    total: d1 + d2,
                });

                setEtaMinutes({
                    toRestaurant: estimateTime(d1),
                    toCustomer: estimateTime(d2),
                    total: estimateTime(d1 + d2),
                });
            }
        }
    }, [riderLocation, orderDetails]);

    // Countdown interval
    useEffect(() => {
        if (inviteCountdown === null || inviteCountdown <= 0) return;
        if (countdownRef.current) clearInterval(countdownRef.current);

        countdownRef.current = setInterval(() => {
            setInviteCountdown(prev => {
                if (prev === null) return null;
                const next = prev - 1;
                if (next <= 0) {
                    if (countdownRef.current) clearInterval(countdownRef.current);
                    // Silently go back — rider is notified via the notifications page
                    router.back();
                    return 0;
                }
                return next;
            });
        }, 1000);

        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [inviteCountdown !== null && inviteCountdown > 0]);

    const handleResponse = async (response: 'accepted' | 'rejected') => {
        if (!session?.user?.id || !orderId) return;

        setProcessing(true);
        try {
            const { data, error } = await supabase.rpc('rider_respond_to_invite', {
                p_order_id: orderId,
                p_rider_id: session.user.id,
                p_response: response,
            });

            if (error) throw error;
            if (!data?.success) {
                Alert.alert('Error', data?.message || 'Failed to respond');
                return;
            }

            Alert.alert(
                'Success',
                response === 'accepted' ? 'Order accepted! Navigate to pickup.' : 'Order declined.',
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <ThemedView style={[styles.container, { backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }]}>
                <LottieLoader size={120} />
            </ThemedView>
        );
    }

    const restLat = orderDetails?.pickup_latitude || 0;
    const restLng = orderDetails?.pickup_longitude || 0;
    const custLat = orderDetails?.dropoff_latitude || 0;
    const custLng = orderDetails?.dropoff_longitude || 0;

    const mapRegion = {
        latitude: riderLocation?.latitude || restLat,
        longitude: riderLocation?.longitude || restLng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    };

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>
                <ThemedText style={styles.headerTitle}>Job Details</ThemedText>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
                {/* Map */}
                <View style={styles.mapContainer}>
                    <MapView
                        style={styles.map}
                        provider={PROVIDER_GOOGLE}
                        region={mapRegion}
                        showsUserLocation={false}
                    >
                        {riderLocation && (
                            <Marker coordinate={riderLocation}>
                                <View style={[styles.markerContainer, { backgroundColor: '#3B82F6' }]}>
                                    <Ionicons name="bicycle" size={20} color="#fff" />
                                </View>
                            </Marker>
                        )}

                        {restLat !== 0 && restLng !== 0 && (
                            <Marker coordinate={{ latitude: restLat, longitude: restLng }}>
                                <View style={[styles.markerContainer, { backgroundColor: '#F27C22' }]}>
                                    <Ionicons name="restaurant" size={20} color="#fff" />
                                </View>
                            </Marker>
                        )}

                        {custLat !== 0 && custLng !== 0 && (
                            <Marker coordinate={{ latitude: custLat, longitude: custLng }}>
                                <View style={[styles.markerContainer, { backgroundColor: '#22C55E' }]}>
                                    <Ionicons name="person" size={20} color="#fff" />
                                </View>
                            </Marker>
                        )}

                        {riderLocation && restLat !== 0 && (
                            <Polyline
                                coordinates={[
                                    riderLocation,
                                    { latitude: restLat, longitude: restLng },
                                ]}
                                strokeColor="#3B82F6"
                                strokeWidth={3}
                                lineDashPattern={[10, 5]}
                            />
                        )}
                        {restLat !== 0 && custLat !== 0 && (
                            <Polyline
                                coordinates={[
                                    { latitude: restLat, longitude: restLng },
                                    { latitude: custLat, longitude: custLng },
                                ]}
                                strokeColor="#22C55E"
                                strokeWidth={3}
                            />
                        )}
                    </MapView>
                </View>

                {/* Order Info Card */}
                <View style={[styles.infoCard, { backgroundColor: cardBg }]}>
                    <View style={styles.priceRow}>
                        <ThemedText style={styles.restaurantName}>
                            {orderDetails?.restaurant?.name || 'Restaurant'}
                        </ThemedText>
                        <ThemedText style={styles.priceTag}>₦{amount || orderDetails?.delivery_fee || 0}</ThemedText>
                    </View>
                    <ThemedText style={[styles.addressText, { color: subtleColor }]}>
                        {orderDetails?.restaurant?.address || 'Pickup Address'}
                    </ThemedText>
                </View>

                {/* Distance & ETA Cards */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                        <View style={[styles.iconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                            <Ionicons name="bicycle" size={20} color="#3B82F6" />
                        </View>
                        <ThemedText style={[styles.statLabel, { color: subtleColor }]}>To Restaurant</ThemedText>
                        <ThemedText style={styles.statValue}>{distances.riderToRestaurant.toFixed(1)} km</ThemedText>
                        <ThemedText style={[styles.statEta, { color: subtleColor }]}>~{etaMinutes.toRestaurant} min</ThemedText>
                    </View>

                    <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                        <View style={[styles.iconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                            <Ionicons name="navigate" size={20} color="#22C55E" />
                        </View>
                        <ThemedText style={[styles.statLabel, { color: subtleColor }]}>To Customer</ThemedText>
                        <ThemedText style={styles.statValue}>{distances.restaurantToCustomer.toFixed(1)} km</ThemedText>
                        <ThemedText style={[styles.statEta, { color: subtleColor }]}>~{etaMinutes.toCustomer} min</ThemedText>
                    </View>
                </View>

                {/* Total Estimate */}
                <View style={[styles.totalCard, { backgroundColor: cardBg }]}>
                    <View style={styles.totalRow}>
                        <View>
                            <ThemedText style={[styles.totalLabel, { color: subtleColor }]}>Total Distance</ThemedText>
                            <ThemedText style={styles.totalValue}>{distances.total.toFixed(1)} km</ThemedText>
                        </View>
                        <View style={styles.dividerVertical} />
                        <View>
                            <ThemedText style={[styles.totalLabel, { color: subtleColor }]}>Estimated Time</ThemedText>
                            <ThemedText style={styles.totalValue}>{etaMinutes.total} min</ThemedText>
                        </View>
                        <View style={styles.dividerVertical} />
                        <View>
                            <ThemedText style={[styles.totalLabel, { color: subtleColor }]}>Earnings</ThemedText>
                            <ThemedText style={[styles.totalValue, { color: '#22C55E' }]}>
                                ₦{amount || orderDetails?.delivery_fee || 0}
                            </ThemedText>
                        </View>
                    </View>
                </View>

                {/* Legend */}
                <View style={[styles.legendCard, { backgroundColor: cardBg }]}>
                    <ThemedText style={styles.legendTitle}>Map Legend</ThemedText>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                        <ThemedText style={[styles.legendText, { color: subtleColor }]}>Your Location</ThemedText>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#F27C22' }]} />
                        <ThemedText style={[styles.legendText, { color: subtleColor }]}>Restaurant (Pickup)</ThemedText>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
                        <ThemedText style={[styles.legendText, { color: subtleColor }]}>Customer (Dropoff)</ThemedText>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View style={[styles.bottomActions, { backgroundColor: cardBg }]}>
                {inviteCountdown !== null && inviteCountdown > 0 && (
                    <View style={{ position: 'absolute', top: -30, left: 0, right: 0, alignItems: 'center' }}>
                        <View style={{ backgroundColor: inviteCountdown <= 5 ? '#FEE2E2' : '#FEF3C7', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 }}>
                            <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: inviteCountdown <= 5 ? '#EF4444' : '#D97706' }}>
                                ⏱ Respond within {inviteCountdown}s
                            </ThemedText>
                        </View>
                    </View>
                )}
                <TouchableOpacity
                    style={[styles.actionBtn, styles.declineBtn]}
                    onPress={() => handleResponse('rejected')}
                    disabled={processing}
                >
                    <ThemedText style={styles.declineBtnText}>Decline</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn]}
                    onPress={() => handleResponse('accepted')}
                    disabled={processing}
                >
                    {processing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <ThemedText style={styles.acceptBtnText}>Accept Order</ThemedText>
                    )}
                </TouchableOpacity>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    mapContainer: {
        height: 250,
        marginHorizontal: 16,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
    },
    map: { flex: 1 },
    markerContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    infoCard: {
        marginHorizontal: 16,
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    restaurantName: { fontSize: 18, fontWeight: 'bold' },
    priceTag: { fontSize: 20, fontWeight: 'bold', color: '#F27C22' },
    addressText: { fontSize: 14 },
    statsRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        gap: 12,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statLabel: { fontSize: 12, marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: 'bold' },
    statEta: { fontSize: 12, marginTop: 2 },
    totalCard: {
        marginHorizontal: 16,
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    dividerVertical: {
        width: 1,
        height: 40,
        backgroundColor: '#E5E7EB',
    },
    totalLabel: { fontSize: 12, textAlign: 'center', marginBottom: 4 },
    totalValue: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
    legendCard: {
        marginHorizontal: 16,
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
    },
    legendTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
    legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
    legendText: { fontSize: 13 },
    bottomActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    actionBtn: {
        flex: 1,
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    declineBtn: {
        backgroundColor: '#FEE2E2',
    },
    acceptBtn: {
        backgroundColor: '#22C55E',
    },
    declineBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16 },
    acceptBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
