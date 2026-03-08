import LottieLoader from '@/components/LottieLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

interface DeliveryRequestPreview {
    id: string;
    pickup_address: string;
    pickup_latitude: number;
    pickup_longitude: number;
    dropoff_address: string;
    dropoff_latitude: number;
    dropoff_longitude: number;
    offered_price: number;
    request_type: 'ride' | 'package';
    item_description: string | null;
    vehicle_types: string[] | null;
    delivery_notes: string | null;
    created_at: string;
    status: string;
    rider_id: string | null;
}

const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const estimateMinutes = (distanceKm: number) => {
    const avgCitySpeedKmH = 25;
    return Math.max(1, Math.ceil((distanceKm / avgCitySpeedKmH) * 60));
};

export default function RiderRequestPreviewScreen() {
    const { requestId } = useLocalSearchParams<{ requestId: string }>();
    const router = useRouter();
    const mapRef = useRef<MapView>(null);
    const { user } = useAuth();

    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#121212' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1E1E1E' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const subtleColor = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');

    const [loading, setLoading] = useState(true);
    const [request, setRequest] = useState<DeliveryRequestPreview | null>(null);
    const [riderLocation, setRiderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [riderToPickupKm, setRiderToPickupKm] = useState(0);
    const [riderToDropoffKm, setRiderToDropoffKm] = useState(0);
    const [pickupToDropoffKm, setPickupToDropoffKm] = useState(0);

    useEffect(() => {
        const fetchPreview = async () => {
            if (!requestId || !user?.id) {
                setLoading(false);
                return;
            }

            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const location = await Location.getCurrentPositionAsync({});
                    setRiderLocation({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    });
                }

                const { data, error } = await supabase
                    .from('delivery_requests')
                    .select(`
                        id,
                        pickup_address,
                        pickup_latitude,
                        pickup_longitude,
                        dropoff_address,
                        dropoff_latitude,
                        dropoff_longitude,
                        offered_price,
                        request_type,
                        item_description,
                        vehicle_types,
                        delivery_notes,
                        created_at,
                        status,
                        rider_id
                    `)
                    .eq('id', requestId)
                    .maybeSingle();

                if (error) throw error;
                if (!data) throw new Error('Request not found.');
                if (data.rider_id && data.rider_id !== user.id) {
                    throw new Error('This request is assigned to another rider.');
                }
                if (
                    !Number.isFinite(Number(data.pickup_latitude)) ||
                    !Number.isFinite(Number(data.pickup_longitude)) ||
                    !Number.isFinite(Number(data.dropoff_latitude)) ||
                    !Number.isFinite(Number(data.dropoff_longitude))
                ) {
                    throw new Error('Location data is incomplete for this request.');
                }

                setRequest(data as DeliveryRequestPreview);
            } catch (err: any) {
                Alert.alert('Unable to load preview', err?.message || 'Please try again.');
                router.back();
            } finally {
                setLoading(false);
            }
        };

        fetchPreview();
    }, [requestId, router, user?.id]);

    useEffect(() => {
        if (!request) return;

        const pickupToDropoff = calculateDistanceKm(
            request.pickup_latitude,
            request.pickup_longitude,
            request.dropoff_latitude,
            request.dropoff_longitude
        );
        setPickupToDropoffKm(pickupToDropoff);

        if (!riderLocation) return;

        setRiderToPickupKm(
            calculateDistanceKm(
                riderLocation.latitude,
                riderLocation.longitude,
                request.pickup_latitude,
                request.pickup_longitude
            )
        );
        setRiderToDropoffKm(
            calculateDistanceKm(
                riderLocation.latitude,
                riderLocation.longitude,
                request.dropoff_latitude,
                request.dropoff_longitude
            )
        );
    }, [request, riderLocation]);

    const mapRegion = useMemo(() => {
        if (riderLocation) {
            return {
                latitude: riderLocation.latitude,
                longitude: riderLocation.longitude,
                latitudeDelta: 0.06,
                longitudeDelta: 0.06,
            };
        }

        return {
            latitude: request?.pickup_latitude || 6.5244,
            longitude: request?.pickup_longitude || 3.3792,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
        };
    }, [request?.pickup_latitude, request?.pickup_longitude, riderLocation]);

    useEffect(() => {
        if (!mapRef.current || !request) return;

        const coordinates = [
            riderLocation,
            { latitude: request.pickup_latitude, longitude: request.pickup_longitude },
            { latitude: request.dropoff_latitude, longitude: request.dropoff_longitude },
        ].filter(Boolean) as Array<{ latitude: number; longitude: number }>;

        if (coordinates.length < 2) return;

        const timer = setTimeout(() => {
            mapRef.current?.fitToCoordinates(coordinates, {
                edgePadding: { top: 70, right: 50, bottom: 60, left: 50 },
                animated: true,
            });
        }, 250);

        return () => clearTimeout(timer);
    }, [request, riderLocation]);

    if (loading) {
        return (
            <ThemedView style={[styles.loaderContainer, { backgroundColor: bgColor }]}>
                <LottieLoader size={120} />
            </ThemedView>
        );
    }

    if (!request) {
        return (
            <ThemedView style={[styles.loaderContainer, { backgroundColor: bgColor }]}>
                <ThemedText style={{ color: textColor }}>Request not found.</ThemedText>
                <TouchableOpacity style={styles.backOnlyBtn} onPress={() => router.back()}>
                    <ThemedText style={styles.backOnlyText}>Go Back</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    const requestTypeLabel = request.request_type === 'ride' ? 'Passenger Ride' : 'Package Delivery';
    const requestTime = new Date(request.created_at).toLocaleString('en-NG', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
                    <Ionicons name="arrow-back" size={22} color={textColor} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, { color: textColor }]}>Request Preview</ThemedText>
                <View style={{ width: 42 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
                <View style={styles.mapCard}>
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        initialRegion={mapRegion}
                    >
                        {riderLocation && (
                            <Marker coordinate={riderLocation} title="You">
                                <View style={[styles.markerContainer, { backgroundColor: '#3B82F6' }]}>
                                    <Ionicons name="bicycle" size={18} color="#fff" />
                                </View>
                            </Marker>
                        )}

                        <Marker
                            coordinate={{ latitude: request.pickup_latitude, longitude: request.pickup_longitude }}
                            title="User (Pickup)"
                        >
                            <View style={[styles.markerContainer, { backgroundColor: '#F27C22' }]}>
                                <Ionicons name="person" size={18} color="#fff" />
                            </View>
                        </Marker>

                        <Marker
                            coordinate={{ latitude: request.dropoff_latitude, longitude: request.dropoff_longitude }}
                            title="Delivery (Dropoff)"
                        >
                            <View style={[styles.markerContainer, { backgroundColor: '#22C55E' }]}>
                                <Ionicons name="flag" size={18} color="#fff" />
                            </View>
                        </Marker>

                        {riderLocation && (
                            <>
                                <Polyline
                                    coordinates={[
                                        riderLocation,
                                        { latitude: request.pickup_latitude, longitude: request.pickup_longitude },
                                    ]}
                                    strokeColor="#3B82F6"
                                    strokeWidth={3}
                                    lineDashPattern={[8, 4]}
                                />
                                <Polyline
                                    coordinates={[
                                        riderLocation,
                                        { latitude: request.dropoff_latitude, longitude: request.dropoff_longitude },
                                    ]}
                                    strokeColor="#8B5CF6"
                                    strokeWidth={3}
                                    lineDashPattern={[8, 4]}
                                />
                            </>
                        )}
                        <Polyline
                            coordinates={[
                                { latitude: request.pickup_latitude, longitude: request.pickup_longitude },
                                { latitude: request.dropoff_latitude, longitude: request.dropoff_longitude },
                            ]}
                            strokeColor="#22C55E"
                            strokeWidth={3}
                        />
                    </MapView>
                </View>

                <View style={[styles.infoCard, { backgroundColor: cardBg }]}>
                    <View style={styles.infoTopRow}>
                        <View style={styles.requestTypeChip}>
                            <ThemedText style={styles.requestTypeChipText}>{requestTypeLabel}</ThemedText>
                        </View>
                        <ThemedText style={styles.amountText}>NGN {(request.offered_price || 0).toLocaleString()}</ThemedText>
                    </View>

                    <View style={styles.addressBlock}>
                        <ThemedText style={[styles.addressLabel, { color: subtleColor }]}>USER (PICKUP)</ThemedText>
                        <ThemedText style={[styles.addressValue, { color: textColor }]}>{request.pickup_address}</ThemedText>
                    </View>

                    <View style={[styles.inlineDivider, { backgroundColor: 'rgba(148,163,184,0.2)' }]} />

                    <View style={styles.addressBlock}>
                        <ThemedText style={[styles.addressLabel, { color: subtleColor }]}>DELIVERY (DROPOFF)</ThemedText>
                        <ThemedText style={[styles.addressValue, { color: textColor }]}>{request.dropoff_address}</ThemedText>
                    </View>

                    <ThemedText style={[styles.requestTimeText, { color: subtleColor }]}>Posted {requestTime}</ThemedText>
                </View>

                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                        <Ionicons name="person-outline" size={18} color="#F27C22" />
                        <ThemedText style={[styles.statLabel, { color: subtleColor }]}>To User</ThemedText>
                        <ThemedText style={[styles.statValue, { color: textColor }]}>
                            {riderLocation ? `${riderToPickupKm.toFixed(1)} km` : '--'}
                        </ThemedText>
                        <ThemedText style={[styles.statEta, { color: subtleColor }]}>
                            {riderLocation ? `~${estimateMinutes(riderToPickupKm)} min` : 'Enable GPS'}
                        </ThemedText>
                    </View>

                    <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                        <Ionicons name="navigate-outline" size={18} color="#22C55E" />
                        <ThemedText style={[styles.statLabel, { color: subtleColor }]}>To Delivery</ThemedText>
                        <ThemedText style={[styles.statValue, { color: textColor }]}>
                            {riderLocation ? `${riderToDropoffKm.toFixed(1)} km` : '--'}
                        </ThemedText>
                        <ThemedText style={[styles.statEta, { color: subtleColor }]}>
                            {riderLocation ? `~${estimateMinutes(riderToDropoffKm)} min` : 'Enable GPS'}
                        </ThemedText>
                    </View>
                </View>

                <View style={[styles.totalCard, { backgroundColor: cardBg }]}>
                    <ThemedText style={[styles.totalLabel, { color: subtleColor }]}>Pickup to Dropoff Route</ThemedText>
                    <ThemedText style={[styles.totalValue, { color: textColor }]}>
                        {pickupToDropoffKm.toFixed(1)} km  •  ~{estimateMinutes(pickupToDropoffKm)} min
                    </ThemedText>
                </View>

                <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
                    <ThemedText style={styles.primaryBtnText}>Back to Requests</ThemedText>
                </TouchableOpacity>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 54,
        paddingHorizontal: 18,
        paddingBottom: 14,
    },
    headerBackBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(15,23,42,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1F2050',
    },
    mapCard: {
        marginHorizontal: 16,
        borderRadius: 18,
        overflow: 'hidden',
        height: 300,
        marginBottom: 14,
    },
    map: {
        flex: 1,
    },
    markerContainer: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    infoCard: {
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
    },
    infoTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    requestTypeChip: {
        backgroundColor: 'rgba(242,124,34,0.12)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    requestTypeChipText: {
        color: '#F27C22',
        fontSize: 12,
        fontWeight: '700',
    },
    amountText: {
        color: '#F27C22',
        fontSize: 20,
        fontWeight: '800',
    },
    addressBlock: {
        marginBottom: 10,
    },
    addressLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 4,
    },
    addressValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2050',
    },
    inlineDivider: {
        height: 1,
        marginBottom: 10,
    },
    requestTimeText: {
        fontSize: 12,
        marginTop: 2,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginHorizontal: 16,
    },
    statCard: {
        flex: 1,
        borderRadius: 14,
        padding: 12,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        marginTop: 6,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1F2050',
        marginTop: 2,
    },
    statEta: {
        fontSize: 12,
        marginTop: 3,
    },
    totalCard: {
        marginHorizontal: 16,
        marginTop: 10,
        borderRadius: 14,
        padding: 13,
    },
    totalLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2050',
    },
    primaryBtn: {
        marginTop: 14,
        marginHorizontal: 16,
        backgroundColor: '#F27C22',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    backOnlyBtn: {
        marginTop: 14,
        backgroundColor: '#F27C22',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    backOnlyText: {
        color: '#fff',
        fontWeight: '700',
    },
});
