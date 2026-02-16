import QuibleMiniLoader from '@/components/QuibleMiniLoader';
import RiderLoader from '@/components/RiderLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Image,
    Linking,
    Modal,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = 320;

// Vehicle icon helper
const getVehicleIcon = (vehicleType: string): keyof typeof Ionicons.glyphMap => {
    const type = vehicleType?.toLowerCase() || '';
    if (type.includes('bike') || type.includes('motorcycle') || type.includes('scooter')) return 'bicycle';
    if (type.includes('car') || type.includes('sedan') || type.includes('suv')) return 'car-sport';
    if (type.includes('van') || type.includes('truck')) return 'bus';
    if (type.includes('tricycle') || type.includes('keke')) return 'git-merge-outline';
    return 'car-sport';
};

export default function RiderProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [rider, setRider] = useState<any>(null);
    const [stats, setStats] = useState({ deliveries: 0, rating: 0, reviews: 0 });
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [mapRegion, setMapRegion] = useState<any>(null);
    const [showVehiclePhoto, setShowVehiclePhoto] = useState(false);
    const [showRiderPhoto, setShowRiderPhoto] = useState(false);
    const mapRef = useRef<MapView>(null);

    // Animations
    const scrollY = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Background animations
    const bgAnim1 = useRef(new Animated.Value(0)).current;
    const bgAnim2 = useRef(new Animated.Value(0)).current;

    // Theme colors
    const navy = '#1F2050';
    const primary = '#F27C22';
    const success = '#22C55E';
    const teal = '#26A69A';
    const bgColor = useThemeColor({ light: '#F8F9FC', dark: '#0A0A0F' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#16161F' }, 'background');
    const textColor = useThemeColor({ light: navy, dark: '#FFFFFF' }, 'text');
    const mutedText = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');
    const insets = useSafeAreaInsets();
    const isDark = useThemeColor({ light: false, dark: true }, 'text');

    // State for supercharged map
    const [userLocation, setUserLocation] = useState<any>(null);
    const [activeDelivery, setActiveDelivery] = useState<any>(null);
    const [routeStats, setRouteStats] = useState({ distance: '0 km', eta: '0 min', speed: '0 km/h' });

    // Animated header values
    const headerOpacity = scrollY.interpolate({
        inputRange: [0, HEADER_HEIGHT / 2],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    useEffect(() => {
        fetchRiderDetails();
        getUserLocation();
        checkActiveDelivery();
        startEntranceAnimation();
        startPulseAnimation();
        startBackgroundAnimation();

        const subscription = supabase
            .channel(`rider-live:${id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'riders', filter: `user_id=eq.${id}` },
                (payload) => {
                    const newRider = payload.new;
                    if (newRider.current_latitude && newRider.current_longitude) {
                        // Only update map region if we don't have user location to fit to
                        // or if this is the first update. Otherwise allow user to pan.
                        if (!userLocation && !mapRegion) {
                            const newRegion = {
                                latitude: newRider.current_latitude,
                                longitude: newRider.current_longitude,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01
                            };
                            setMapRegion(newRegion);
                        } else if (mapRegion) {
                            // Use simpler state update for marker only to avoid map re-render glitch
                            // We will update the rider object which drives the marker
                            setRider(prev => ({
                                ...prev,
                                current_latitude: newRider.current_latitude,
                                current_longitude: newRider.current_longitude,
                                current_speed: newRider.current_speed
                            }));
                        }

                        // Update stats whenever rider moves
                        if (userLocation) {
                            calculateStats(
                                userLocation.latitude,
                                userLocation.longitude,
                                newRider.current_latitude,
                                newRider.current_longitude,
                                newRider.current_speed
                            );

                            // Auto-fit map to show both Points
                            mapRef.current?.fitToCoordinates([
                                { latitude: userLocation.latitude, longitude: userLocation.longitude },
                                { latitude: newRider.current_latitude, longitude: newRider.current_longitude }
                            ], {
                                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                                animated: true
                            });
                        } else {
                        }
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(subscription); };
    }, [id, userLocation]); // Added userLocation dependency to re-calc stats/fit map

    const getUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const location = await Location.getCurrentPositionAsync({});
            setUserLocation(location.coords);
        } catch (e) {
            console.log('Error getting user location', e);
        }
    };

    const checkActiveDelivery = async () => {
        try {
            const { data: req } = await supabase
                .from('delivery_requests')
                .select('*')
                .eq('rider_id', id)
                .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
                .in('status', ['accepted', 'picked_up', 'in_transit'])
                .single();

            if (req) setActiveDelivery(req);
        } catch (e) {
            // No active delivery
        }
    };

    const calculateStats = (userLat: number, userLon: number, riderLat: number, riderLon: number, riderSpeed: number) => {
        // Haversine Distance
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(riderLat - userLat);
        const dLon = deg2rad(riderLon - userLon);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(userLat)) * Math.cos(deg2rad(riderLat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km

        // ETA Calculation
        // Use rider speed if available and > 0, else assume avg speed of 30km/h for bike, 40km/h car
        const speedKmh = riderSpeed ? (riderSpeed * 3.6) : 30;
        const timeHours = d / Math.max(speedKmh, 5); // Avoid div by zero, min speed 5km/h
        const timeMins = Math.round(timeHours * 60);

        setRouteStats({
            distance: `${d.toFixed(1)} km`,
            eta: `${timeMins} min`,
            speed: `${speedKmh.toFixed(0)} km/h`
        });
    };

    const deg2rad = (deg: number) => {
        return deg * (Math.PI / 180);
    };

    const startEntranceAnimation = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const startPulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const startBackgroundAnimation = () => {
        Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(bgAnim1, {
                        toValue: 1,
                        duration: 8000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(bgAnim1, {
                        toValue: 0,
                        duration: 8000,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(bgAnim2, {
                        toValue: 1,
                        duration: 10000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(bgAnim2, {
                        toValue: 0,
                        duration: 10000,
                        useNativeDriver: true,
                    }),
                ])
            ])
        ).start();
    };

    const fetchRiderDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('riders')
                .select(`*, profile:profiles(*)`)
                .eq('user_id', id)
                .single();

            if (error) throw error;
            setRider(data);

            if (data.current_latitude && data.current_longitude) {
                setMapRegion({
                    latitude: data.current_latitude,
                    longitude: data.current_longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01
                });
            }

            const { count: deliveryCount } = await supabase
                .from('delivery_requests')
                .select('*', { count: 'exact', head: true })
                .eq('rider_id', id)
                .eq('status', 'delivered');

            const { data: reviewsData } = await supabase
                .from('reviews')
                .select('*')
                .eq('reviewee_id', id)
                .order('created_at', { ascending: false });

            // Use stored metrics to match the Dashboard Card exactly
            const avgRating = data.average_rating !== undefined && data.average_rating !== null
                ? Number(data.average_rating).toFixed(1)
                : (reviewsData?.length
                    ? (reviewsData.reduce((acc: any, curr: any) => acc + (curr.rating || 0), 0) / reviewsData.length).toFixed(1)
                    : '5.0');

            const totalDeliveries = data.total_jobs !== undefined && data.total_jobs !== null
                ? data.total_jobs
                : (deliveryCount || 0);

            setStats({
                deliveries: totalDeliveries,
                rating: parseFloat(avgRating as string),
                reviews: reviewsData?.length || 0
            });
            setReviews(reviewsData || []);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCall = () => {
        if (rider?.profile?.phone_number) {
            Linking.openURL(`tel:${rider.profile.phone_number}`);
        }
    };

    const handleChat = async () => {
        setLoading(true);
        try {
            const { data: req } = await supabase
                .from('delivery_requests')
                .select('id')
                .eq('rider_id', id)
                .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!req) {
                Alert.alert('No Active Request', 'You need an active delivery with this rider to start a chat.');
                return;
            }

            const { data: chatId, error } = await supabase.rpc('get_or_create_chat', {
                p_request_id: req.id,
                p_user_id: (await supabase.auth.getUser()).data.user?.id,
                p_rider_id: id
            });

            if (error) throw error;
            router.push(`/chat/${chatId}`);
        } catch (e) {
            Alert.alert('Error', 'Could not start chat');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
                <Stack.Screen options={{ headerShown: false }} />
                <RiderLoader size={150} message="Loading profile..." />
            </ThemedView>
        );
    }

    if (!rider) {
        return (
            <ThemedView style={[styles.container, styles.centerContent, { backgroundColor: bgColor }]}>
                <Stack.Screen options={{ headerShown: false }} />
                <ThemedText>Rider not found</ThemedText>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <ThemedText style={{ color: primary }}>Go Back</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    const isVerified = rider.status === 'active';
    const isOnline = rider.is_online;
    const vehicleIcon = getVehicleIcon(rider.vehicle_type);

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Animated Compact Header (appears on scroll) */}
            <Animated.View style={[
                styles.compactHeader,
                {
                    opacity: headerOpacity,
                    backgroundColor: cardBg,
                    paddingTop: insets.top + 10
                }
            ]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCompact}>
                    <Ionicons name="arrow-back" size={22} color={textColor} />
                </TouchableOpacity>
                <ThemedText style={[styles.compactName, { color: textColor }]}>
                    {rider.profile.first_name} {rider.profile.last_name}
                </ThemedText>
                <View style={{ width: 40 }} />
            </Animated.View>

            <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
            >
                {/* Hero Header with Gradient */}
                <LinearGradient
                    colors={isDark ? [navy, '#0A0A0F'] : [navy, '#3D4080']}
                    style={[styles.heroHeader, { paddingTop: insets.top + 20 }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Back Button */}
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={[styles.backBtn, { top: insets.top + 10 }]}
                    >
                        <View style={styles.backBtnBg}>
                            <Ionicons name="arrow-back" size={22} color="#fff" />
                        </View>
                    </TouchableOpacity>

                    {/* Decorative Elements */}
                    <Animated.View style={[
                        styles.decorCircle1,
                        {
                            transform: [
                                {
                                    translateY: bgAnim1.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, 20]
                                    })
                                },
                                {
                                    scale: bgAnim1.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [1, 1.1]
                                    })
                                }
                            ]
                        }
                    ]} />
                    <Animated.View style={[
                        styles.decorCircle2,
                        {
                            transform: [
                                {
                                    translateY: bgAnim2.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, -25]
                                    })
                                },
                                {
                                    scale: bgAnim2.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [1.2, 1]
                                    })
                                }
                            ]
                        }
                    ]} />

                    {/* Avatar with Pulse Animation */}
                    <Animated.View style={styles.avatarWrapper}>
                        <Animated.View style={{ transform: [{ scale: isOnline ? pulseAnim : 1 }] }}>
                            <View style={[styles.avatarRing, { borderColor: isOnline ? success : '#ffffff50' }]}>
                                <Image
                                    source={{
                                        uri: rider.profile?.profile_picture_url || rider.rider_photo ||
                                            `https://ui-avatars.com/api/?name=${rider.profile.first_name}+${rider.profile.last_name}&background=F27C22&color=fff&size=200`
                                    }}
                                    style={styles.avatar}
                                />
                            </View>
                        </Animated.View>
                        {isOnline && (
                            <Animated.View style={[styles.onlineDot, { transform: [{ scale: pulseAnim }] }]} />
                        )}
                    </Animated.View>

                    {/* Name */}
                    <ThemedText style={styles.heroName}>
                        {rider.profile.first_name} {rider.profile.last_name}
                    </ThemedText>

                    {/* Vehicle Badge with Dynamic Icon */}
                    <View style={styles.vehicleBadge}>
                        <Ionicons name={vehicleIcon} size={16} color="#fff" />
                        <ThemedText style={styles.vehicleText}>
                            {rider.vehicle_brand} {rider.vehicle_type}
                        </ThemedText>
                    </View>

                    {/* Status Badges */}
                    <View style={styles.badgeRow}>
                        <View style={[styles.badge, { backgroundColor: isVerified ? '#22C55E30' : '#FBBF2430' }]}>
                            <Ionicons
                                name={isVerified ? "shield-checkmark" : "time-outline"}
                                size={14}
                                color={isVerified ? success : '#FBBF24'}
                            />
                            <ThemedText style={[styles.badgeText, { color: isVerified ? success : '#FBBF24' }]}>
                                {isVerified ? 'Verified' : 'Pending'}
                            </ThemedText>
                        </View>
                        {isOnline && (
                            <View style={[styles.badge, { backgroundColor: '#22C55E30' }]}>
                                <View style={styles.liveDot} />
                                <ThemedText style={[styles.badgeText, { color: success }]}>Online Now</ThemedText>
                            </View>
                        )}
                    </View>

                    {/* Stats Row (Inside Header) */}
                    <View style={styles.statsRowInline}>
                        <View style={styles.statInline}>
                            <ThemedText style={styles.statValueInline}>{stats.deliveries}</ThemedText>
                            <ThemedText style={styles.statLabelInline}>Deliveries</ThemedText>
                        </View>
                        <View style={styles.statDividerInline} />
                        <View style={styles.statInline}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <ThemedText style={styles.statValueInline}>{stats.rating}</ThemedText>
                                <Ionicons name="star" size={14} color="#FBBF24" />
                            </View>
                            <ThemedText style={styles.statLabelInline}>Rating</ThemedText>
                        </View>
                        <View style={styles.statDividerInline} />
                        <View style={styles.statInline}>
                            <ThemedText style={styles.statValueInline}>{stats.reviews}</ThemedText>
                            <ThemedText style={styles.statLabelInline}>Reviews</ThemedText>
                        </View>
                    </View>
                </LinearGradient>

                {/* Action Buttons - Redesigned for proximity issues */}
                <Animated.View style={[
                    styles.actionContainer,
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}>
                    {/* Primary Action Button */}
                    <TouchableOpacity
                        style={styles.primaryActionBtn}
                        activeOpacity={0.8}
                        onPress={() => router.push({
                            pathname: '/send-package',
                            params: {
                                riderId: rider.user_id,
                                riderName: `${rider.profile.first_name} ${rider.profile.last_name}`.trim()
                            }
                        })}
                    >
                        <LinearGradient
                            colors={[primary, '#E86A10']}
                            style={styles.primaryGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Ionicons name="paper-plane" size={22} color="#fff" />
                            <ThemedText style={styles.primaryActionText}>Send Package with this Rider</ThemedText>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Secondary Action Row */}
                    <View style={styles.secondaryActionRow}>
                        <TouchableOpacity
                            style={[styles.secondaryActionBtn, { backgroundColor: cardBg }]}
                            onPress={handleCall}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: `${teal}15` }]}>
                                <Ionicons name="call" size={20} color={teal} />
                            </View>
                            <ThemedText style={[styles.secondaryActionText, { color: textColor }]}>Call Rider</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.secondaryActionBtn, { backgroundColor: cardBg }]}
                            onPress={handleChat}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: `${primary}15` }]}>
                                <Ionicons name="chatbubble-ellipses" size={20} color={primary} />
                            </View>
                            <ThemedText style={[styles.secondaryActionText, { color: textColor }]}>Message</ThemedText>
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Live Location Map */}
                <Animated.View style={[
                    styles.section,
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}>
                    <View style={styles.sectionHeader}>
                        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>📍 Live Location</ThemedText>
                        {isOnline && (
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <ThemedText style={styles.liveText}>LIVE</ThemedText>
                            </View>
                        )}
                    </View>
                    <View style={[styles.mapCard, { backgroundColor: cardBg }]}>
                        {mapRegion ? (
                            <>
                                <MapView
                                    ref={mapRef}
                                    style={styles.map}
                                    initialRegion={mapRegion}
                                    scrollEnabled={true} // Allow panning now
                                    zoomEnabled={true}   // Allow zooming now
                                >
                                    {/* Rider Marker */}
                                    <Marker
                                        coordinate={{
                                            latitude: mapRegion.latitude,
                                            longitude: mapRegion.longitude
                                        }}
                                        title={`${rider.profile.first_name}`}
                                        description={activeDelivery ? "On delivery" : "Online"}
                                    >
                                        <View style={styles.mapMarker}>
                                            <Ionicons name={vehicleIcon} size={20} color={primary} />
                                        </View>
                                    </Marker>

                                    {/* User Marker (You) */}
                                    {userLocation && (
                                        <Marker
                                            coordinate={{
                                                latitude: userLocation.latitude,
                                                longitude: userLocation.longitude
                                            }}
                                            title="You"
                                            pinColor={teal}
                                        >
                                            <View style={[styles.mapMarker, { backgroundColor: teal }]}>
                                                <Ionicons name="person" size={16} color="white" />
                                            </View>
                                        </Marker>
                                    )}
                                </MapView>

                                {/* Live Stats Panel Overlay */}
                                {userLocation && (
                                    <View style={[styles.statsOverlay, { backgroundColor: isDark ? 'rgba(22, 22, 31, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]}>
                                        <View style={styles.statItem}>
                                            <ThemedText style={[styles.statValue, { color: textColor }]}>{routeStats.distance}</ThemedText>
                                            <ThemedText style={[styles.statLabel, { color: mutedText }]}>Distance</ThemedText>
                                        </View>
                                        <View style={[styles.statDivider, { backgroundColor: mutedText + '40' }]} />
                                        <View style={styles.statItem}>
                                            <ThemedText style={[styles.statValue, { color: textColor }]}>{routeStats.eta}</ThemedText>
                                            <ThemedText style={[styles.statLabel, { color: mutedText }]}>ETA</ThemedText>
                                        </View>
                                        <View style={[styles.statDivider, { backgroundColor: mutedText + '40' }]} />
                                        <View style={styles.statItem}>
                                            <ThemedText style={[styles.statValue, { color: textColor }]}>{routeStats.speed}</ThemedText>
                                            <ThemedText style={[styles.statLabel, { color: mutedText }]}>Speed</ThemedText>
                                        </View>
                                    </View>
                                )}
                            </>
                        ) : (
                            <View style={[styles.mapPlaceholder, { backgroundColor: isDark ? '#16161F' : '#F8F9FC' }]}>
                                <QuibleMiniLoader size={100} />
                                <ThemedText style={[styles.placeholderText, { color: mutedText, marginTop: 16 }]}>
                                    Getting location...
                                </ThemedText>
                            </View>
                        )}
                    </View>
                </Animated.View>

                {/* Vehicle & Contact Info */}
                <Animated.View style={[
                    styles.section,
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>🚗 Identity & Vehicle</ThemedText>
                    <View style={[styles.infoCard, { backgroundColor: cardBg }]}>

                        {/* Rider Photo Row */}
                        <View style={styles.infoRow}>
                            <View style={[styles.infoIcon, { backgroundColor: `${navy}15` }]}>
                                <Ionicons name="person" size={22} color={navy} />
                            </View>
                            <View style={styles.infoContent}>
                                <ThemedText style={[styles.infoLabel, { color: mutedText }]}>Identity</ThemedText>
                                <ThemedText style={[styles.infoValue, { color: textColor }]}>
                                    Verified Rider
                                </ThemedText>
                                {rider.rider_photo && (
                                    <TouchableOpacity
                                        style={{ marginTop: 8 }}
                                        onPress={() => setShowRiderPhoto(true)}
                                    >
                                        <ThemedText style={{ color: primary, fontSize: 13, fontWeight: '600' }}>
                                            View Registration Photo
                                        </ThemedText>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: mutedText + '20' }]} />

                        <View style={styles.infoRow}>
                            <View style={[styles.infoIcon, { backgroundColor: `${primary}15` }]}>
                                <Ionicons name={vehicleIcon} size={22} color={primary} />
                            </View>
                            <View style={styles.infoContent}>
                                <ThemedText style={[styles.infoLabel, { color: mutedText }]}>Vehicle</ThemedText>
                                <ThemedText style={[styles.infoValue, { color: textColor }]}>
                                    {rider.vehicle_brand} {rider.vehicle_type}
                                </ThemedText>
                                {rider.documents?.vehicle_photo && (
                                    <TouchableOpacity
                                        style={{ marginTop: 8 }}
                                        onPress={() => setShowVehiclePhoto(true)}
                                    >
                                        <ThemedText style={{ color: primary, fontSize: 13, fontWeight: '600' }}>
                                            View Vehicle Photo
                                        </ThemedText>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: mutedText + '20' }]} />

                        <View style={styles.infoRow}>
                            <View style={[styles.infoIcon, { backgroundColor: `${teal}15` }]}>
                                <Ionicons name="call" size={22} color={teal} />
                            </View>
                            <View style={styles.infoContent}>
                                <ThemedText style={[styles.infoLabel, { color: mutedText }]}>Phone</ThemedText>
                                <ThemedText style={[styles.infoValue, { color: textColor }]}>
                                    {rider.contact_phone || rider.profile?.phone_number || 'Not available'}
                                </ThemedText>
                            </View>
                        </View>
                    </View>
                </Animated.View>

                {/* Reviews Section */}
                <Animated.View style={[
                    styles.section,
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }], marginBottom: 40 }
                ]}>
                    <View style={styles.sectionHeader}>
                        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>⭐ Reviews</ThemedText>
                        <ThemedText style={[styles.reviewCount, { color: mutedText }]}>{reviews.length} total</ThemedText>
                    </View>

                    {reviews.length > 0 ? reviews.slice(0, 5).map((review) => (
                        <View key={review.id} style={[styles.reviewCard, { backgroundColor: cardBg }]}>
                            <View style={styles.reviewHeader}>
                                <View style={styles.starsRow}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Ionicons
                                            key={star}
                                            name={star <= (review.rating || 0) ? "star" : "star-outline"}
                                            size={16}
                                            color="#FBBF24"
                                        />
                                    ))}
                                </View>
                                <ThemedText style={[styles.reviewDate, { color: mutedText }]}>
                                    {new Date(review.created_at).toLocaleDateString()}
                                </ThemedText>
                            </View>
                            <ThemedText style={[styles.reviewText, { color: textColor }]}>
                                {review.comment || 'No comment provided.'}
                            </ThemedText>
                        </View>
                    )) : (
                        <View style={[styles.emptyReviews, { backgroundColor: cardBg }]}>
                            <Ionicons name="chatbubble-outline" size={48} color={mutedText} />
                            <ThemedText style={[styles.emptyText, { color: mutedText }]}>No reviews yet</ThemedText>
                        </View>
                    )}
                </Animated.View>

            </Animated.ScrollView>

            {/* Vehicle Photo Modal */}
            <Modal
                visible={showVehiclePhoto}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowVehiclePhoto(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.9)' }]}>
                    <TouchableOpacity
                        style={styles.closeModalBtn}
                        onPress={() => setShowVehiclePhoto(false)}
                    >
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>

                    {rider.documents?.vehicle_photo && (
                        <Image
                            source={{ uri: rider.documents.vehicle_photo }}
                            style={styles.fullScreenImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>

            {/* Rider Photo Modal */}
            <Modal
                visible={showRiderPhoto}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowRiderPhoto(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.9)' }]}>
                    <TouchableOpacity
                        style={styles.closeModalBtn}
                        onPress={() => setShowRiderPhoto(false)}
                    >
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>

                    {rider.rider_photo && (
                        <Image
                            source={{ uri: rider.rider_photo }}
                            style={styles.fullScreenImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerContent: { justifyContent: 'center', alignItems: 'center' },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeModalBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        padding: 10,
    },
    fullScreenImage: {
        width: '100%',
        height: '80%',
    },
    statsOverlay: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 10,
        textTransform: 'uppercase',
    },
    statDivider: {
        width: 1,
        height: '80%',
    },

    // Compact Header
    compactHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 54 : 40,
        paddingBottom: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    backBtnCompact: { padding: 8 },
    compactName: { fontSize: 16, fontWeight: '700' },

    // Hero Header
    heroHeader: {
        paddingTop: Platform.OS === 'ios' ? 60 : 45,
        paddingBottom: 24,
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    backBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 54 : 40,
        left: 20,
        zIndex: 10,
    },
    backBtnBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    decorCircle1: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.05)',
        top: -50,
        right: -50,
    },
    decorCircle2: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255,255,255,0.03)',
        bottom: 50,
        left: -30,
    },

    avatarWrapper: { alignItems: 'center', marginTop: 20, marginBottom: 12 },
    avatarRing: {
        padding: 4,
        borderRadius: 60,
        borderWidth: 3,
    },
    avatar: { width: 100, height: 100, borderRadius: 50 },
    onlineDot: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#22C55E',
        borderWidth: 3,
        borderColor: '#1F2050',
    },
    heroName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },

    // Vehicle Badge
    vehicleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 8,
        marginBottom: 12,
    },
    vehicleText: { fontSize: 13, fontWeight: '600', color: '#fff' },

    badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    badgeText: { fontSize: 12, fontWeight: '600' },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22C55E',
    },

    // Stats Inline (inside header)
    statsRowInline: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        marginTop: 4,
    },
    statInline: { alignItems: 'center', paddingHorizontal: 16 },
    statValueInline: { fontSize: 20, fontWeight: '800', color: '#fff' },
    statLabelInline: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    statDividerInline: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },

    actionContainer: {
        marginHorizontal: 20,
        marginTop: 24,
        gap: 16,
    },
    primaryActionBtn: {
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#F27C22',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
    },
    primaryGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        gap: 12,
    },
    primaryActionText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '800',
    },
    secondaryActionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    secondaryActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 18,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    secondaryActionText: {
        fontSize: 14,
        fontWeight: '700',
    },
    actionIconBox: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Sections
    section: { marginHorizontal: 20, marginTop: 28 },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: { fontSize: 18, fontWeight: '700' },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#22C55E20',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    liveText: { fontSize: 10, fontWeight: '800', color: '#22C55E' },

    // Map
    mapCard: {
        borderRadius: 24,
        overflow: 'hidden',
        height: 220,
    },
    map: { width: '100%', height: '100%' },
    mapPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: { fontSize: 14, fontWeight: '500' },
    mapMarker: {
        padding: 10,
        borderRadius: 25,
        borderWidth: 3,
        borderColor: '#F27C22',
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },

    // Info Card
    infoCard: {
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    infoIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: 12, marginBottom: 2 },
    infoValue: { fontSize: 16, fontWeight: '600' },
    divider: { height: 1, marginVertical: 16 },

    // Reviews
    reviewCount: { fontSize: 14, fontWeight: '600' },
    reviewCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    starsRow: { flexDirection: 'row', gap: 2 },
    reviewDate: { fontSize: 11 },
    reviewText: { fontSize: 14, lineHeight: 22 },
    emptyReviews: {
        padding: 40,
        borderRadius: 20,
        alignItems: 'center',
    },
    emptyText: { marginTop: 12, fontSize: 15 },
});
