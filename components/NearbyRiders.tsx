import IsometricStackLoader from '@/components/IsometricStackLoader';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Animated,
    FlatList,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

// Types
interface Rider {
    id: string;
    user_id: string;
    vehicle_type: string;
    average_rating?: number;
    total_jobs?: number;
    review_count?: number; // Added review count
    is_online: boolean;
    current_latitude: number;
    current_longitude: number;
    rider_photo: string;
    status: string; // Added status
    profile: {
        first_name: string;
        last_name: string;
        profile_picture_url: string;
    };
    distance: number;
}

type VehicleFilter = 'all' | 'bike' | 'tricycle' | 'car' | 'van'; // Added tricycle
type DistanceFilter = 1 | 3 | 5 | 10 | 'all';
type SortOption = 'nearest' | 'rating' | 'jobs';

// Haversine formula for distance calculation
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

// Vehicle icon mapping
const vehicleIcons: Record<string, string> = {
    bike: 'bicycle',
    bicycle: 'bicycle',
    motorcycle: 'bicycle',
    tricycle: 'git-merge-outline', // Keke icon
    keke: 'git-merge-outline',
    car: 'car-sport',
    van: 'bus',
    truck: 'bus'
};

interface NearbyRidersProps {
    ListHeaderComponent?: React.ReactElement | null;
    searchQuery?: string;
}

export default function NearbyRiders({ ListHeaderComponent, searchQuery }: NearbyRidersProps) {
    const router = useRouter();
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    // Filters
    const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>('all');
    const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>('all');
    const [sortOption, setSortOption] = useState<SortOption>('nearest');

    // Theme
    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#0A0A0F' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1A1A1A' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const mutedText = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');
    const isDark = bgColor === '#0A0A0F';
    const primary = '#F27C22';
    const navy = '#1F2050';

    useEffect(() => {
        getUserLocation();
    }, []);

    useEffect(() => {
        if (userLocation) {
            fetchRiders();
        }
    }, [userLocation, vehicleFilter, distanceFilter, sortOption, searchQuery]);

    const getUserLocation = async () => {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
                let location = await Location.getLastKnownPositionAsync({});

                if (!location) {
                    try {
                        location = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                            timeout: 5000
                        });
                    } catch (e) {
                        // Ignore timeout, will fallback below
                    }
                }

                if (location) {
                    setUserLocation({
                        lat: location.coords.latitude,
                        lng: location.coords.longitude
                    });
                } else {
                    setUserLocation({ lat: 6.5244, lng: 3.3792 }); // Default Lagos
                }
            } else {
                setUserLocation({ lat: 6.5244, lng: 3.3792 });
            }
        } catch (e) {
            setUserLocation({ lat: 6.5244, lng: 3.3792 });
        }
    };

    const fetchRiders = async () => {
        try {
            let query = supabase
                .from('riders')
                .select(`
                    id, user_id, vehicle_type, 
                    is_online, current_latitude, current_longitude, rider_photo,
                    average_rating, total_jobs, status, review_count,
                    profile:profiles(first_name, last_name, profile_picture_url)
                `)
                .eq('is_online', true);

            if (vehicleFilter !== 'all') {
                if (vehicleFilter === 'bike') {
                    query = query.in('vehicle_type', ['bike', 'bicycle']);
                } else if (vehicleFilter === 'van') {
                    query = query.in('vehicle_type', ['van', 'truck']);
                } else if (vehicleFilter === 'tricycle') {
                    query = query.eq('vehicle_type', 'tricycle');
                } else {
                    query = query.eq('vehicle_type', vehicleFilter);
                }
            }

            if (searchQuery) {
                // Since profile is a joined table, we might need a different approach for filtering 
                // but if there are few riders, we can do it client-side or use a clever rpc/query.
                // For now, let's fetch profile first_name and filter client side for better performance with few records.
            }

            const { data, error } = await query;
            if (error) throw error;

            // Calculate distances and filter
            let processedRiders = (data || []).map((rider: any) => ({
                ...rider,
                profile: rider.profile || { first_name: 'Rider', last_name: '', profile_picture_url: null },
                distance: userLocation && rider.current_latitude && rider.current_longitude
                    ? calculateDistance(userLocation.lat, userLocation.lng, rider.current_latitude, rider.current_longitude)
                    : 999
            }));

            // Search filter (client-side)
            if (searchQuery) {
                const queryLower = searchQuery.toLowerCase();
                processedRiders = processedRiders.filter(r =>
                    r.profile?.first_name?.toLowerCase().includes(queryLower) ||
                    r.profile?.last_name?.toLowerCase().includes(queryLower) ||
                    r.vehicle_brand?.toLowerCase().includes(queryLower)
                );
            }

            // Distance filter
            if (distanceFilter !== 'all') {
                processedRiders = processedRiders.filter(r => r.distance <= distanceFilter);
            }

            // Sort
            switch (sortOption) {
                case 'nearest':
                    processedRiders.sort((a, b) => a.distance - b.distance);
                    break;
                case 'rating':
                    processedRiders.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
                    break;
                case 'jobs':
                    processedRiders.sort((a, b) => (b.total_jobs || 0) - (a.total_jobs || 0));
                    break;
            }

            setRiders(processedRiders);
        } catch (error: any) {
            console.error('Error fetching riders:', error.message || error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchRiders();
    };

    const FilterChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.filterChip,
                active ? { backgroundColor: primary } : { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' },
                !active && { borderWidth: 1, borderColor: isDark ? '#333' : '#E8E9ED' }
            ]}
        >
            <ThemedText style={[styles.filterChipText, { color: active ? '#fff' : (isDark ? '#9CA3AF' : '#1F2050') }]}>
                {label}
            </ThemedText>
        </TouchableOpacity>
    );

    const QuickSendBanner = () => (
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

    const renderRiderCard = ({ item, index }: { item: Rider, index: number }) => {
        const avatar = item.profile?.profile_picture_url || item.rider_photo;
        const name = `${item.profile?.first_name || 'Rider'} ${item.profile?.last_name || ''}`.trim();
        const vehicleIcon = vehicleIcons[item.vehicle_type?.toLowerCase()] || 'bicycle';

        // Scroll entry animation
        const translateY = new Animated.Value(50);
        const opacity = new Animated.Value(0);

        Animated.parallel([
            Animated.timing(translateY, { toValue: 0, duration: 400, delay: index * 50, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 400, delay: index * 50, useNativeDriver: true })
        ]).start();

        return (
            <Animated.View style={{ transform: [{ translateY }], opacity }}>
                <TouchableOpacity
                    style={[styles.uniqueCard, { backgroundColor: cardBg }]}
                    activeOpacity={0.95}
                    onPress={() => router.push(`/rider-profile/${item.user_id}`)}
                >
                    {/* Visual Accent */}
                    <View style={[styles.cardAccent, { backgroundColor: primary }]} />

                    <View style={styles.cardMain}>
                        {/* Top Section - Profile & Vehicle */}
                        <View style={styles.cardHeader}>
                            <View style={styles.profileSection}>
                                <View style={styles.uniqueAvatarWrapper}>
                                    {avatar ? (
                                        <Image source={{ uri: avatar }} style={styles.uniqueAvatar} />
                                    ) : (
                                        <View style={[styles.uniqueAvatar, { backgroundColor: primary, justifyContent: 'center', alignItems: 'center' }]}>
                                            <Ionicons name="person" size={24} color="#fff" />
                                        </View>
                                    )}
                                    {item.status === 'active' && (
                                        <View style={styles.uniqueVerified}>
                                            <Ionicons name="checkmark-sharp" size={10} color="#fff" />
                                        </View>
                                    )}
                                </View>
                                <View style={styles.nameSection}>
                                    <ThemedText style={[styles.uniqueName, { color: textColor }]} numberOfLines={1}>
                                        {name}
                                    </ThemedText>
                                    <View style={[styles.vehiclePill, { backgroundColor: isDark ? 'rgba(242, 124, 34, 0.15)' : 'rgba(242, 124, 34, 0.08)' }]}>
                                        <Ionicons name={vehicleIcon as any} size={12} color={primary} />
                                        <ThemedText style={[styles.vehiclePillText, { color: primary }]}>
                                            {item.vehicle_type}
                                        </ThemedText>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.ratingSection}>
                                <View style={[styles.ratingPill, { backgroundColor: isDark ? '#2A2000' : '#FFFBEB', borderColor: isDark ? '#4A3B00' : '#FEF3C7' }]}>
                                    <Ionicons name="star" size={12} color="#FBBF24" />
                                    <ThemedText style={[styles.ratingValue, { color: isDark ? '#FBBF24' : '#B45309' }]}>
                                        {item.average_rating ? Number(item.average_rating).toFixed(1) : '5.0'}
                                    </ThemedText>
                                </View>
                            </View>
                        </View>

                        {/* Stats Row */}
                        <View style={[styles.cardBody, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                            <View style={styles.metricItem}>
                                <ThemedText style={[styles.metricLabel, { color: mutedText }]}>JOBS</ThemedText>
                                <ThemedText style={[styles.metricValue, { color: textColor }]}>
                                    {item.total_jobs || 0}
                                </ThemedText>
                            </View>
                            <View style={[styles.metricDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} />
                            <View style={styles.metricItem}>
                                <ThemedText style={[styles.metricLabel, { color: mutedText }]}>DISTANCE</ThemedText>
                                <ThemedText style={[styles.metricValue, { color: textColor }]}>
                                    {item.distance < 1 ? `${(item.distance * 1000).toFixed(0)}m` : `${item.distance.toFixed(1)}km`}
                                </ThemedText>
                            </View>
                            <View style={[styles.metricDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} />
                            <View style={styles.metricItem}>
                                <ThemedText style={[styles.metricLabel, { color: mutedText }]}>ETA</ThemedText>
                                <ThemedText style={[styles.metricValue, { color: primary }]}>
                                    {Math.round(item.distance * 3 + 2)} min
                                </ThemedText>
                            </View>
                        </View>

                        {/* Footer / Action */}
                        <View style={styles.cardFooter}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => router.push({
                                    pathname: '/send-package',
                                    params: { riderId: item.user_id, riderName: name }
                                })}
                            >
                                <LinearGradient
                                    colors={[primary, '#E86A10']}
                                    style={styles.fullRequestBtn}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <ThemedText style={styles.fullRequestBtnText}>Request Package Delivery</ThemedText>
                                    <Ionicons name="paper-plane" size={16} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <IsometricStackLoader width={120} height={102} />
            <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
                No Riders Nearby
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: mutedText }]}>
                Try expanding your search distance or check back later
            </ThemedText>
            <TouchableOpacity
                style={[styles.sendAnywayBtn, { backgroundColor: primary }]}
                onPress={() => router.push('/send-package')}
            >
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <ThemedText style={styles.sendAnywayText}>Send Package Anyway</ThemedText>
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <IsometricStackLoader width={120} height={102} />
                <ThemedText style={[styles.loadingText, { color: mutedText }]}>
                    Finding riders near you...
                </ThemedText>
            </View>
        );
    }

    return (
        <View style={styles.container}>


            {/* Riders List */}
            <FlatList
                data={riders}
                renderItem={({ item, index }) => renderRiderCard({ item, index })}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <>
                        {ListHeaderComponent}
                        <QuickSendBanner />
                        {/* Header */}
                        <View style={styles.headerRow}>
                            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                                Riders Nearby
                            </ThemedText>
                            <ThemedText style={[styles.riderCount, { color: mutedText }]}>
                                {riders.length} available
                            </ThemedText>
                        </View>

                        {/* Filter Rows */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingBottom: 4 }}>
                            <View style={styles.filterGroup}>
                                <FilterChip label="All Vehicles" active={vehicleFilter === 'all'} onPress={() => setVehicleFilter('all')} />
                                <FilterChip label="Bike" active={vehicleFilter === 'bike'} onPress={() => setVehicleFilter('bike')} />
                                <FilterChip label="Tricycle (Keke)" active={vehicleFilter === 'tricycle'} onPress={() => setVehicleFilter('tricycle')} />
                                <FilterChip label="Car" active={vehicleFilter === 'car'} onPress={() => setVehicleFilter('car')} />
                                <FilterChip label="Van/Truck" active={vehicleFilter === 'van'} onPress={() => setVehicleFilter('van')} />
                            </View>
                        </ScrollView>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                            <View style={styles.filterGroup}>
                                <ThemedText style={[styles.filterLabel, { color: mutedText }]}>Distance:</ThemedText>
                                <FilterChip label="Any" active={distanceFilter === 'all'} onPress={() => setDistanceFilter('all')} />
                                <FilterChip label="1km" active={distanceFilter === 1} onPress={() => setDistanceFilter(1)} />
                                <FilterChip label="3km" active={distanceFilter === 3} onPress={() => setDistanceFilter(3)} />
                                <FilterChip label="5km" active={distanceFilter === 5} onPress={() => setDistanceFilter(5)} />
                                <FilterChip label="10km" active={distanceFilter === 10} onPress={() => setDistanceFilter(10)} />
                            </View>
                        </ScrollView>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                            <View style={styles.filterGroup}>
                                <ThemedText style={[styles.filterLabel, { color: mutedText }]}>Sort:</ThemedText>
                                <FilterChip label="Nearest" active={sortOption === 'nearest'} onPress={() => setSortOption('nearest')} />
                                <FilterChip label="Top Rated" active={sortOption === 'rating'} onPress={() => setSortOption('rating')} />
                                <FilterChip label="Most Jobs" active={sortOption === 'jobs'} onPress={() => setSortOption('jobs')} />
                            </View>
                        </ScrollView>
                    </>
                }
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16 },
    loadingContainer: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
    loadingText: { fontSize: 14, marginTop: 16 },

    // Header
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 },
    sectionTitle: { fontSize: 20, fontWeight: '700' },
    riderCount: { fontSize: 14, fontWeight: '500' },

    // Filters
    filterRow: { marginBottom: 8 },
    filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 },
    filterLabel: { fontSize: 12, fontWeight: '600', marginRight: 4 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    filterChipText: { fontSize: 13, fontWeight: '600' },

    // Rider Card
    listContent: { paddingBottom: 100 },
    riderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 12,
        borderRadius: 16,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 }
        })
    },
    riderAvatarContainer: { position: 'relative', marginRight: 14 },
    riderAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
    onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#fff' },
    riderInfo: { flex: 1 },
    riderName: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
    riderStats: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    riderSubStats: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 13 },
    verifiedBadge: {
        backgroundColor: '#22C55E',
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    distanceText: { fontSize: 13, fontWeight: '700' },
    etaText: { fontSize: 12, fontWeight: '500' },
    requestBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#F27C22', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },

    // Empty State
    emptyContainer: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 20 },
    emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
    sendAnywayBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28, marginTop: 24 },
    sendAnywayText: { color: '#fff', fontSize: 15, fontWeight: '600' },

    // Unified Unique Card
    uniqueCard: {
        borderRadius: 24,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(150, 150, 150, 0.1)',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
            android: { elevation: 8 }
        })
    },
    cardAccent: { height: 4, width: '100%' },
    cardMain: { padding: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    profileSection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    uniqueAvatarWrapper: { position: 'relative' },
    uniqueAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#fff' },
    uniqueVerified: { position: 'absolute', top: -2, right: -2, backgroundColor: '#22C55E', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    nameSection: { gap: 4 },
    uniqueName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
    vehiclePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(242, 124, 34, 0.08)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    vehiclePillText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    ratingSection: {},
    ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#FEF3C7' },
    ratingValue: { fontSize: 14, fontWeight: '800', color: '#B45309' },
    cardBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(150, 150, 150, 0.08)', marginBottom: 16 },
    metricItem: { flex: 1, alignItems: 'center' },
    metricLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
    metricValue: { fontSize: 15, fontWeight: '800' },
    metricDivider: { width: 1, height: 24, backgroundColor: 'rgba(150, 150, 150, 0.1)' },
    cardFooter: {},
    fullRequestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, shadowColor: '#F27C22', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    fullRequestBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    // Quick Send Card
    quickSendCard: {
        borderRadius: 24,
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
