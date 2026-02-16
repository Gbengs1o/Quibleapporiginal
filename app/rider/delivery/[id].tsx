import RiderLoader from '@/components/RiderLoader';
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
    Animated,
    Dimensions,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View
} from 'react-native';
import MapView, { Callout, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

// Haversine distance calculation
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Dark map style
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
];

export default function ActiveDeliveryScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const mapRef = useRef<MapView>(null);
    const pickupMarkerRef = useRef<any>(null); // Ref for closing callout
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Theme colors
    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#0D0D0D' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1A1A1A' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const mutedText = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');
    const borderColor = useThemeColor({ light: '#E5E7EB', dark: '#2D2D2D' }, 'background');

    const primary = '#1F2050';
    const accent = '#F27C22';
    const success = '#22C55E';

    const [request, setRequest] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [myLocation, setMyLocation] = useState<any>(null);
    const [speed, setSpeed] = useState(0);
    const [distanceCovered, setDistanceCovered] = useState(0);
    const [distanceRemaining, setDistanceRemaining] = useState(0);
    const [routeCoords, setRouteCoords] = useState<any[]>([]);
    const [eta, setEta] = useState('--');
    const lastLocation = useRef<any>(null);

    // Review State
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [rating, setRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    const [deliveryCode, setDeliveryCode] = useState('');
    const [codeInputModalVisible, setCodeInputModalVisible] = useState(false);
    const [isFoodOrder, setIsFoodOrder] = useState(false);

    // Restaurant state
    const [restaurantInfo, setRestaurantInfo] = useState<any>(null);
    const [restaurantOwnerPhone, setRestaurantOwnerPhone] = useState<string | null>(null);
    const [chatLoading, setChatLoading] = useState(false);

    const confirmDelivery = async () => {
        setLoading(true);

        const locationArgs = myLocation ? {
            p_lat: myLocation.latitude,
            p_lng: myLocation.longitude
        } : {};

        const rpcName = isFoodOrder ? 'complete_food_delivery' : 'complete_delivery_job_v2';
        const idParam = isFoodOrder ? { p_order_id: id } : { p_request_id: id };

        const { data, error } = await supabase.rpc(rpcName, {
            ...idParam,
            p_delivery_code: deliveryCode,
            ...locationArgs
        });

        if (error || (data && !data.success)) {
            const errorMessage = data?.message || error?.message || 'Could not complete delivery.';
            Alert.alert('Delivery Check Failed', errorMessage);
            setLoading(false);
            return;
        }

        setCodeInputModalVisible(false);
        setReviewModalVisible(true);
        setLoading(false);
    };

    useEffect(() => {
        if (id) fetchRequest();
        startLocationTracking();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    }, [id]);

    const fetchRequest = async () => {
        // Try fetching from delivery_requests first
        let { data: requestData, error: requestError } = await supabase
            .from('delivery_requests')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (requestError || !requestData) {
            // Try fetching from orders (Food)
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('*, restaurant:restaurants(*)')
                .eq('id', id)
                .maybeSingle();

            if (orderError || !orderData) {
                router.back();
                return;
            }

            setIsFoodOrder(true);

            // Store restaurant info for the map callout and contact section
            if (orderData.restaurant) {
                setRestaurantInfo(orderData.restaurant);

                // Fetch restaurant owner's phone from profiles
                if (orderData.restaurant.owner_id) {
                    const { data: ownerData } = await supabase
                        .from('profiles')
                        .select('phone_number')
                        .eq('id', orderData.restaurant.owner_id)
                        .single();
                    if (ownerData?.phone_number) {
                        setRestaurantOwnerPhone(ownerData.phone_number);
                    }
                }
            }

            requestData = {
                ...orderData,
                pickup_latitude: orderData.pickup_latitude,
                pickup_longitude: orderData.pickup_longitude,
                dropoff_latitude: orderData.dropoff_latitude,
                dropoff_longitude: orderData.dropoff_longitude,
                item_description: `Order from ${orderData.restaurant?.name || 'Restaurant'}`,
                final_price: orderData.delivery_fee,
                customer_name: 'Customer',
            };
        }

        let userProfile = null;
        if (requestData.user_id) {
            const { data: userData } = await supabase
                .from('profiles')
                .select('first_name, last_name, phone_number')
                .eq('id', requestData.user_id)
                .single();
            userProfile = userData;
        }

        setRequest({ ...requestData, user: userProfile });
        setLoading(false);
    };

    const startLocationTracking = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const location = await Location.getCurrentPositionAsync({});
        setMyLocation(location.coords);
        lastLocation.current = location.coords;

        await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
            (loc) => {
                const coords = loc.coords;
                setMyLocation(coords);
                setSpeed(coords.speed ? Math.max(0, coords.speed * 3.6) : 0);

                if (lastLocation.current) {
                    const delta = calculateDistance(
                        lastLocation.current.latitude,
                        lastLocation.current.longitude,
                        coords.latitude,
                        coords.longitude
                    );
                    setDistanceCovered((prev) => prev + delta);
                }
                lastLocation.current = coords;
                updateLiveLocation(coords.latitude, coords.longitude);
            }
        );
    };

    useEffect(() => {
        if (myLocation && request) {
            const targetLat = request.status === 'accepted' ? request.pickup_latitude : request.dropoff_latitude;
            const targetLng = request.status === 'accepted' ? request.pickup_longitude : request.dropoff_longitude;

            if (targetLat && targetLng) {
                const remaining = calculateDistance(myLocation.latitude, myLocation.longitude, targetLat, targetLng);
                setDistanceRemaining(remaining);

                const avgSpeed = speed > 5 ? speed : 25;
                const etaMinutes = Math.round((remaining / avgSpeed) * 60);
                setEta(etaMinutes < 1 ? '< 1 min' : `${etaMinutes} min`);

                setRouteCoords([
                    { latitude: myLocation.latitude, longitude: myLocation.longitude },
                    { latitude: targetLat, longitude: targetLng },
                ]);

                if (mapRef.current) {
                    mapRef.current.fitToCoordinates(
                        [
                            { latitude: myLocation.latitude, longitude: myLocation.longitude },
                            { latitude: targetLat, longitude: targetLng },
                        ],
                        { edgePadding: { top: 80, right: 50, bottom: 320, left: 50 }, animated: true }
                    );
                }
            }
        }
    }, [myLocation, request, speed]);

    const updateLiveLocation = async (lat: number, long: number) => {
        if (!id) return;

        // Always update the riders table for real-time tracking from the customer side
        // Get the current rider's ID first (assumed to be the logged in user)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('riders').update({
                current_latitude: lat,
                current_longitude: long,
                updated_at: new Date().toISOString()
            }).eq('user_id', user.id);
        }

        // Also update the specific job if it's P2P
        if (!isFoodOrder) {
            await supabase.from('delivery_requests').update({
                current_location: { lat, long },
                updated_at: new Date().toISOString(),
            }).eq('id', id);
        }
    };

    const openGoogleMapsNavigation = () => {
        if (!request) return;
        const targetLat = request.status === 'accepted' ? request.pickup_latitude : request.dropoff_latitude;
        const targetLng = request.status === 'accepted' ? request.pickup_longitude : request.dropoff_longitude;

        // Google Maps navigation intent - works on both Android and iOS
        const url = Platform.select({
            ios: `comgooglemaps://?daddr=${targetLat},${targetLng}&directionsmode=driving`,
            android: `google.navigation:q=${targetLat},${targetLng}&mode=d`,
        });

        Linking.canOpenURL(url!).then((supported) => {
            if (supported) {
                Linking.openURL(url!);
            } else {
                // Fallback to web Google Maps
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=driving`);
            }
        });
    };

    const openAppleMaps = () => {
        if (!request) return;
        const targetLat = request.status === 'accepted' ? request.pickup_latitude : request.dropoff_latitude;
        const targetLng = request.status === 'accepted' ? request.pickup_longitude : request.dropoff_longitude;
        const address = request.status === 'accepted' ? request.pickup_address : request.dropoff_address;

        const url = `maps://?daddr=${targetLat},${targetLng}&q=${encodeURIComponent(address)}`;
        Linking.openURL(url);
    };

    const markAsPickedUp = async () => {
        const table = isFoodOrder ? 'orders' : 'delivery_requests';
        const nextStatus = isFoodOrder ? 'with_rider' : 'picked_up';

        const { error } = await supabase.from(table).update({ status: nextStatus }).eq('id', id);
        if (!error) {
            setDistanceCovered(0);
            fetchRequest();
        }
    };

    const markAsDelivered = () => {
        setCodeInputModalVisible(true);
    };

    const submitReview = async () => {
        if (rating === 0) {
            Alert.alert('Rating Required', 'Please select a star rating.');
            return;
        }

        setSubmittingReview(true);
        try {
            const { error } = await supabase.from('reviews').insert({
                request_id: id,
                reviewer_id: request.rider_id, // I am the rider
                reviewee_id: request.user_id,  // Reviewing the user
                role: 'rider',
                rating: rating,
                comment: reviewComment
            });

            if (error) throw error;

            setReviewModalVisible(false);

            Alert.alert('Success', 'Job completed! Funds released.', [
                { text: 'View Wallet', onPress: () => router.replace('/rider/(dashboard)/wallet') },
                { text: 'Back to Dashboard', onPress: () => router.replace('/rider/(dashboard)') }
            ]);
        } catch (error: any) {
            Alert.alert('Error', 'Failed to submit review');
            setSubmittingReview(false);
        }
    };

    const callCustomer = () => {
        if (request?.user?.phone_number) {
            Linking.openURL(`tel:${request.user.phone_number}`);
        }
    };

    const callRecipient = () => {
        if (request?.recipient_phone) {
            Linking.openURL(`tel:${request.recipient_phone}`);
        }
    };

    const callRestaurant = () => {
        // Try restaurant phone first, then owner's phone
        const phone = restaurantInfo?.phone || restaurantOwnerPhone;
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        } else {
            Alert.alert('No Phone', 'Restaurant phone number not available.');
        }
    };

    const openRestaurantChat = async () => {
        if (!isFoodOrder || !id) return;
        setChatLoading(true);
        try {
            const { data: chatId, error } = await supabase.rpc('get_or_create_rider_order_chat', {
                p_order_id: id,
                p_chat_type: 'rider_restaurant'
            });
            if (error) throw error;
            if (chatId) {
                // Pass target=restaurant so the header shows Restaurant details
                router.push(`/order-chat/${chatId}?target=restaurant` as any);
            }
        } catch (e: any) {
            console.log('Chat error', e);
            Alert.alert('Chat Error', e.message || 'Could not open chat with restaurant.');
        } finally {
            setChatLoading(false);
        }
    };

    const openCustomerChat = async () => {
        if (!id) return;

        // For Food Orders, we use the shared Order Chat (same as restaurant)
        if (isFoodOrder) {
            setChatLoading(true);
            try {
                // Reuse the same RPC to get the shared order chat
                const { data: chatId, error } = await supabase.rpc('get_or_create_rider_order_chat', {
                    p_order_id: id,
                    p_chat_type: 'rider_customer'
                });

                if (error) throw error;
                if (chatId) {
                    // Pass target=customer so the header shows Customer details
                    router.push(`/order-chat/${chatId}?target=customer` as any);
                }
            } catch (e: any) {
                Alert.alert('Chat Error', 'Could not open chat with customer.');
            } finally {
                setChatLoading(false);
            }
        } else {
            // For P2P / Delivery Requests
            // TODO: Verify if request.id is the actual Chat ID or if we need to fetch it.
            // Currently assuming legacy behavior for P2P is correct or will be fixed separately if reported.
            router.push(`/chat/${id}`);
        }
    };

    if (loading) return <RiderLoader size={200} message="Loading delivery..." fullScreen />;

    const formatDistance = (km: number) => {
        if (km < 1) return `${Math.round(km * 1000)}m`;
        return `${km.toFixed(1)}km`;
    };

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            {/* MAP - Takes most of the screen */}
            <View style={styles.mapContainer}>
                {myLocation ? (
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={StyleSheet.absoluteFill}
                        initialRegion={{
                            latitude: myLocation.latitude,
                            longitude: myLocation.longitude,
                            latitudeDelta: 0.02,
                            longitudeDelta: 0.02,
                        }}
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        showsCompass={false}
                        customMapStyle={isDark ? darkMapStyle : []}
                    >
                        {/* Rider Marker */}
                        <Marker coordinate={myLocation} anchor={{ x: 0.5, y: 0.5 }}>
                            <View style={styles.riderMarker}>
                                <Ionicons name="bicycle" size={20} color="#fff" />
                            </View>
                        </Marker>

                        {/* Pickup Marker */}
                        {request?.pickup_latitude && (
                            <Marker
                                ref={pickupMarkerRef}
                                coordinate={{ latitude: request.pickup_latitude, longitude: request.pickup_longitude }}
                                anchor={{ x: 0.5, y: 1 }}
                            >
                                <View style={styles.markerContainer}>
                                    <View style={[styles.markerPin, { backgroundColor: accent }]}>
                                        <Ionicons name={isFoodOrder ? 'restaurant' : 'cube'} size={16} color="#fff" />
                                    </View>
                                    <ThemedText style={[styles.markerText, { backgroundColor: accent }]}>PICKUP</ThemedText>
                                </View>
                                {/* Restaurant Callout Popup */}
                                {isFoodOrder && restaurantInfo && (
                                    <Callout tooltip style={{ width: 260 }}>
                                        <View style={styles.calloutContainer}>
                                            <View style={styles.calloutHeader}>
                                                {restaurantInfo.image_url ? (
                                                    <Image source={{ uri: restaurantInfo.image_url }} style={styles.calloutImage} />
                                                ) : (
                                                    <View style={[styles.calloutImage, { backgroundColor: accent + '20', justifyContent: 'center', alignItems: 'center' }]}>
                                                        <Ionicons name="restaurant" size={24} color={accent} />
                                                    </View>
                                                )}
                                                <View style={styles.calloutInfo}>
                                                    <ThemedText style={styles.calloutName}>{restaurantInfo.name}</ThemedText>
                                                    {restaurantInfo.cuisine_type && (
                                                        <ThemedText style={styles.calloutCuisine}>{restaurantInfo.cuisine_type}</ThemedText>
                                                    )}
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                        <Ionicons name="star" size={12} color="#FFD700" />
                                                        <ThemedText style={styles.calloutRating}>
                                                            {restaurantInfo.rating ? Number(restaurantInfo.rating).toFixed(1) : 'New'}
                                                        </ThemedText>
                                                    </View>
                                                </View>
                                            </View>
                                            {restaurantInfo.address && (
                                                <View style={styles.calloutAddressRow}>
                                                    <Ionicons name="location-outline" size={12} color="#6B7280" />
                                                    <ThemedText style={styles.calloutAddress} numberOfLines={2}>
                                                        {restaurantInfo.address}
                                                    </ThemedText>
                                                </View>
                                            )}
                                            <TouchableOpacity
                                                style={[styles.calloutActions, { justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8 }]}
                                                onPress={() => pickupMarkerRef.current?.hideCallout()}
                                            >
                                                <ThemedText style={{ color: '#6B7280', fontWeight: '600', fontSize: 13 }}>Close</ThemedText>
                                            </TouchableOpacity>
                                        </View>
                                    </Callout>
                                )}
                            </Marker>
                        )}

                        {/* Dropoff Marker */}
                        {request?.dropoff_latitude && (
                            <Marker
                                coordinate={{ latitude: request.dropoff_latitude, longitude: request.dropoff_longitude }}
                                anchor={{ x: 0.5, y: 1 }}
                            >
                                <View style={styles.markerContainer}>
                                    <View style={[styles.markerPin, { backgroundColor: success }]}>
                                        <Ionicons name="flag" size={16} color="#fff" />
                                    </View>
                                    <ThemedText style={[styles.markerText, { backgroundColor: success }]}>DROPOFF</ThemedText>
                                </View>
                            </Marker>
                        )}

                        {/* Route Line */}
                        {routeCoords.length === 2 && (
                            <Polyline
                                coordinates={routeCoords}
                                strokeWidth={4}
                                strokeColor={accent}
                                lineDashPattern={[10, 5]}
                            />
                        )}
                    </MapView>
                ) : (
                    <View style={[styles.loadingMap, { backgroundColor: isDark ? '#1A1A1A' : '#F5F6FA' }]}>
                        <RiderLoader size={80} message="Getting location..." fullScreen={false} />
                    </View>
                )}

                {/* Back Button - Clean, minimal */}
                <TouchableOpacity
                    style={[styles.backButton, { backgroundColor: cardBg }]}
                    onPress={() => router.push('/rider/(dashboard)')}
                >
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>

                {/* Live Badge - Small indicator */}
                <View style={styles.liveBadge}>
                    <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                    <ThemedText style={styles.liveText}>LIVE</ThemedText>
                </View>
            </View>

            {/* BOTTOM PANEL - Clean and functional */}
            <ScrollView
                style={[styles.bottomPanel, { backgroundColor: cardBg, borderTopColor: borderColor }]}
                contentContainerStyle={{ paddingBottom: 60 }} // Extra space at bottom
                showsVerticalScrollIndicator={false}
            >
                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Ionicons name="speedometer-outline" size={20} color={accent} />
                        <ThemedText style={[styles.statValue, { color: textColor }]}>{speed.toFixed(0)}</ThemedText>
                        <ThemedText style={[styles.statLabel, { color: mutedText }]}>km/h</ThemedText>
                    </View>

                    <View style={[styles.statItem, styles.statItemMain]}>
                        <Ionicons name="navigate-outline" size={20} color={success} />
                        <ThemedText style={[styles.statValue, styles.statValueLarge, { color: textColor }]}>
                            {formatDistance(distanceRemaining)}
                        </ThemedText>
                        <ThemedText style={[styles.statLabel, { color: mutedText }]}>remaining</ThemedText>
                    </View>

                    <View style={styles.statItem}>
                        <Ionicons name="time-outline" size={20} color={isDark ? '#60A5FA' : primary} />
                        <ThemedText style={[styles.statValue, { color: textColor }]}>{eta}</ThemedText>
                        <ThemedText style={[styles.statLabel, { color: mutedText }]}>ETA</ThemedText>
                    </View>
                </View>

                {/* Destination Info */}
                <View style={[styles.destinationCard, { backgroundColor: isDark ? '#333333' : '#F8F9FC' }]}>
                    <View style={styles.destinationHeader}>
                        <View style={[styles.destinationDot, { backgroundColor: request.status === 'accepted' ? accent : success }]} />
                        <ThemedText style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: isDark ? '#FFFFFF' : '#6B7280' }}>
                            {request.status === 'accepted' ? 'HEADING TO PICKUP' : 'HEADING TO DROPOFF'}
                        </ThemedText>
                    </View>
                    <ThemedText style={{ fontSize: 15, fontWeight: '600', lineHeight: 22, color: isDark ? '#FFFFFF' : '#1F2050' }} numberOfLines={2}>
                        {request.status === 'accepted' ? request.pickup_address : request.dropoff_address}
                    </ThemedText>
                </View>

                {/* Customer & Quick Actions */}
                <View style={styles.actionsRow}>
                    <View style={styles.customerInfo}>
                        <View style={[styles.customerAvatar, { backgroundColor: primary }]}>
                            <ThemedText style={styles.customerInitial}>
                                {request.user?.first_name?.charAt(0) || 'C'}
                            </ThemedText>
                        </View>
                        <View>
                            <ThemedText style={[styles.customerName, { color: textColor }]}>
                                {request.user ? `${request.user.first_name} ${request.user.last_name}` : 'Customer'}
                            </ThemedText>
                            <ThemedText style={[styles.customerLabel, { color: mutedText }]}>Customer</ThemedText>
                        </View>
                    </View>

                    <View style={styles.quickActions}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: success }]} onPress={callCustomer}>
                            <Ionicons name="call" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: accent }]} onPress={openCustomerChat}>
                            <Ionicons name="chatbubble" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Restaurant Info & Quick Actions (Food Orders Only) */}
                {isFoodOrder && restaurantInfo && (
                    <View style={styles.actionsRow}>
                        <View style={styles.customerInfo}>
                            {restaurantInfo.image_url ? (
                                <Image source={{ uri: restaurantInfo.image_url }} style={[styles.customerAvatar, { borderRadius: 12 }]} />
                            ) : (
                                <View style={[styles.customerAvatar, { backgroundColor: accent, borderRadius: 12 }]}>
                                    <Ionicons name="restaurant" size={20} color="#fff" />
                                </View>
                            )}
                            <View>
                                <ThemedText style={[styles.customerName, { color: textColor }]}>
                                    {restaurantInfo.name || 'Restaurant'}
                                </ThemedText>
                                <ThemedText style={[styles.customerLabel, { color: mutedText }]}>Restaurant</ThemedText>
                            </View>
                        </View>

                        <View style={styles.quickActions}>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: success }]} onPress={callRestaurant}>
                                <Ionicons name="call" size={20} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: accent }]}
                                onPress={openRestaurantChat}
                                disabled={chatLoading}
                            >
                                {chatLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="chatbubble" size={20} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Recipient Info */}
                {(request.recipient_name || request.recipient_phone) && (
                    <View style={styles.actionsRow}>
                        <View style={styles.customerInfo}>
                            <View style={[styles.customerAvatar, { backgroundColor: success }]}>
                                <ThemedText style={styles.customerInitial}>
                                    {request.recipient_name?.charAt(0) || 'R'}
                                </ThemedText>
                            </View>
                            <View>
                                <ThemedText style={[styles.customerName, { color: textColor }]}>
                                    {request.recipient_name || 'Recipient'}
                                </ThemedText>
                                <ThemedText style={[styles.customerLabel, { color: mutedText }]}>Recipient</ThemedText>
                            </View>
                        </View>

                        <View style={styles.quickActions}>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: success }]} onPress={callRecipient}>
                                <Ionicons name="call" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Delivery Notes & Vehicle */}
                <View style={{ marginBottom: 16 }}>
                    {request.delivery_notes && (
                        <View style={[styles.destinationCard, { backgroundColor: isDark ? '#333333' : '#F8F9FC', padding: 12 }]}>
                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                                <Ionicons name="document-text-outline" size={14} color={mutedText} />
                                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: mutedText }}>NOTES</ThemedText>
                            </View>
                            <ThemedText style={{ color: textColor, fontStyle: 'italic' }}>"{request.delivery_notes}"</ThemedText>
                        </View>
                    )}

                    {request.vehicle_types && request.vehicle_types.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {request.vehicle_types.map((v: string) => (
                                <View key={v} style={{ backgroundColor: isDark ? '#333' : '#F0F0F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                    <ThemedText style={{ fontSize: 11, color: mutedText, textTransform: 'capitalize' }}>{v}</ThemedText>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Main Action Buttons */}
                <View style={styles.mainActions}>
                    <TouchableOpacity
                        style={[styles.navButton, { backgroundColor: '#1F2050' }]}
                        onPress={openGoogleMapsNavigation}
                    >
                        <Ionicons name="navigate" size={22} color="#FFFFFF" />
                        <ThemedText style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Navigate</ThemedText>
                    </TouchableOpacity>

                    {request.status === 'accepted' ? (
                        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: accent }]} onPress={markAsPickedUp}>
                            <Ionicons name="checkmark-circle" size={22} color="#fff" />
                            <ThemedText style={styles.primaryButtonText}>Confirm Pickup</ThemedText>
                        </TouchableOpacity>
                    ) : request.status === 'delivered' ? (
                        <View style={[styles.primaryButton, { backgroundColor: '#6B7280', opacity: 0.8 }]}>
                            <Ionicons name="checkmark-done-circle" size={22} color="#fff" />
                            <ThemedText style={styles.primaryButtonText}>Delivery Completed</ThemedText>
                        </View>
                    ) : (
                        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: success }]} onPress={markAsDelivered}>
                            <Ionicons name="checkmark-circle" size={22} color="#fff" />
                            <ThemedText style={styles.primaryButtonText}>Complete Delivery</ThemedText>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            {/* Code Verification Modal */}
            <Modal visible={codeInputModalVisible} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.reviewCard, { backgroundColor: cardBg }]}>
                        <ThemedText style={[styles.reviewTitle, { color: textColor }]}>Verify Delivery</ThemedText>
                        <ThemedText style={{ color: mutedText, textAlign: 'center', marginBottom: 20 }}>
                            Ask the recipient for the 4-digit secure delivery code.
                        </ThemedText>

                        <TextInput
                            style={[styles.codeInput, { color: textColor, backgroundColor: bgColor, borderColor: borderColor }]}
                            placeholder="0-0-0-0"
                            placeholderTextColor={mutedText}
                            keyboardType="number-pad"
                            maxLength={4}
                            value={deliveryCode}
                            onChangeText={setDeliveryCode}
                        />

                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: success, marginTop: 20, width: '100%' }]}
                            onPress={confirmDelivery}
                            disabled={loading || deliveryCode.length !== 4}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <ThemedText style={styles.primaryButtonText}>Verify & Complete</ThemedText>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ marginTop: 16, padding: 10 }}
                            onPress={() => setCodeInputModalVisible(false)}
                        >
                            <ThemedText style={{ color: mutedText }}>Cancel</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Review Modal */}
            <Modal visible={reviewModalVisible} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.reviewCard, { backgroundColor: cardBg }]}>
                        <ThemedText style={[styles.reviewTitle, { color: textColor }]}>Rate Customer</ThemedText>
                        <ThemedText style={{ color: mutedText, textAlign: 'center', marginBottom: 20 }}>
                            How was your experience with {request?.user?.first_name}?
                        </ThemedText>
                        {/* ... existing review content ... */}
                        <View style={styles.starsContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                                    <Ionicons
                                        name={star <= rating ? "star" : "star-outline"}
                                        size={36}
                                        color={star <= rating ? "#FFD700" : borderColor}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={[styles.commentInput, { color: textColor, backgroundColor: bgColor, borderColor }]}
                            placeholder="Write a comment..."
                            placeholderTextColor={mutedText}
                            multiline
                            numberOfLines={3}
                            value={reviewComment}
                            onChangeText={setReviewComment}
                        />

                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: success, marginTop: 20, width: '100%' }]}
                            onPress={submitReview}
                            disabled={submittingReview}
                        >
                            {submittingReview ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <ThemedText style={styles.primaryButtonText}>Submit & Finish</ThemedText>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ marginTop: 16, padding: 10 }}
                            onPress={() => {
                                setReviewModalVisible(false);
                                router.replace('/rider/(dashboard)');
                            }}
                        >
                            <ThemedText style={{ color: mutedText }}>Skip</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ThemedView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },

    // Map
    mapContainer: {
        flex: 1,
    },
    loadingMap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Markers
    riderMarker: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1F2050',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#F27C22',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    markerContainer: {
        alignItems: 'center',
    },
    markerPin: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    markerText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '800',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
        overflow: 'hidden',
    },

    // Back Button
    backButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 50,
        left: 16,
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },

    // Live Badge
    liveBadge: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 50,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
    },
    liveText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },

    // Bottom Panel
    bottomPanel: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
        maxHeight: height * 0.45, // Limit to 45% of screen height
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    statItemMain: {
        flex: 1.2,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        marginTop: 4,
    },
    statValueLarge: {
        fontSize: 24,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },

    // Destination
    destinationCard: {
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
    },
    destinationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    destinationDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    destinationLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    destinationAddress: {
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 22,
    },

    // Customer
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    customerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    customerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    customerInitial: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
    },
    customerName: {
        fontSize: 15,
        fontWeight: '700',
    },
    customerLabel: {
        fontSize: 12,
    },
    quickActions: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Main Actions
    mainActions: {
        flexDirection: 'row',
        gap: 12,
    },
    navButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 14,
        paddingVertical: 16,
        borderWidth: 1,
    },
    navButtonText: {
        fontSize: 15,
        fontWeight: '700',
    },
    primaryButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 14,
        paddingVertical: 16,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },

    // Review Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    reviewCard: { width: '100%', borderRadius: 24, padding: 24, alignItems: 'center' },
    reviewTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    starsContainer: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    commentInput: { width: '100%', height: 100, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
    codeInput: {
        width: '100%',
        height: 60,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 8,
        marginBottom: 8
    },

    // Map Callout
    calloutContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        width: 260,
    },
    calloutHeader: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 10,
    },
    calloutImage: {
        width: 56,
        height: 56,
        borderRadius: 12,
    },
    calloutInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    calloutName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2050',
    },
    calloutCuisine: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    calloutRating: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    calloutAddressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginBottom: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    calloutAddress: {
        fontSize: 12,
        color: '#6B7280',
        flex: 1,
        lineHeight: 16,
    },
    calloutActions: {
        flexDirection: 'row',
        gap: 10,
    },
    calloutBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 10,
    },
    calloutBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
    calloutHint: {
        fontSize: 10,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 6,
    },
});
