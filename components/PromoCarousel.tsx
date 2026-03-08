import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@/utils/AsyncStorage';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '@/contexts/auth';
import { ThemedText } from './themed-text';

const { width } = Dimensions.get('window');
const CAROUSEL_HEIGHT = 200;
const ITEM_WIDTH = width - 40;
const PROMO_VIEWER_KEY_STORAGE = 'promo_viewer_key_v1';
const PROMO_MAX_DISTANCE_KM = 2;
const PROMO_ROTATION_INTERVAL_MS = 10000;

interface Promotion {
    id: string;
    vendor_id: string;
    vendor_type: 'restaurant' | 'store';
    title: string;
    description: string;
    media_url: string;
    media_type: 'image' | 'video';
    destination_type: 'profile' | 'items' | 'item' | 'custom_url' | null;
    destination_value: string | null;
}

type PromotionRow = Promotion & {
    created_at?: string | null;
};

export default function PromoCarousel() {
    const { user } = useAuth();
    const [promos, setPromos] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const [viewerKey, setViewerKey] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const router = useRouter();
    const dotsColor = useThemeColor({ light: '#ccc', dark: '#444' }, 'text');
    const activeDotColor = '#f27c22';

    const ensureViewerKey = async (): Promise<string | null> => {
        if (viewerKey) return viewerKey;

        try {
            if (user?.id) {
                const key = `user:${user.id}`;
                setViewerKey(key);
                return key;
            }

            const existing = await AsyncStorage.getItem(PROMO_VIEWER_KEY_STORAGE);
            if (existing) {
                setViewerKey(existing);
                return existing;
            }

            const generated = `anon:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
            await AsyncStorage.setItem(PROMO_VIEWER_KEY_STORAGE, generated);
            setViewerKey(generated);
            return generated;
        } catch (error) {
            console.error('Error ensuring promotion viewer key:', error);
            return null;
        }
    };

    const calculateDistanceKm = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ) => {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const resolveUserLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return null;

            let loc = await Location.getLastKnownPositionAsync({});
            if (!loc) {
                try {
                    loc = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                        // Some app builds do not type "timeout", so keep default options here.
                    });
                } catch {
                    return null;
                }
            }

            if (!loc) return null;
            return {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            };
        } catch {
            return null;
        }
    };

    useEffect(() => {
        let isMounted = true;

        const initPromos = async () => {
            const coords = await resolveUserLocation();
            if (!isMounted) return;
            await fetchPromos(coords);
        };

        void initPromos();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const resolveViewerKey = async () => {
            try {
                if (user?.id) {
                    if (isMounted) setViewerKey(`user:${user.id}`);
                    return;
                }

                const existing = await AsyncStorage.getItem(PROMO_VIEWER_KEY_STORAGE);
                if (existing) {
                    if (isMounted) setViewerKey(existing);
                    return;
                }

                const generated = `anon:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
                await AsyncStorage.setItem(PROMO_VIEWER_KEY_STORAGE, generated);
                if (isMounted) setViewerKey(generated);
            } catch (error) {
                console.error('Error generating promotion viewer key:', error);
            }
        };

        resolveViewerKey();
        return () => {
            isMounted = false;
        };
    }, [user?.id]);

    useEffect(() => {
        if (!viewerKey || promos.length === 0) return;
        const promo = promos[activeIndex];
        if (!promo?.id) return;
        void recordPromoEvent(promo.id, 'view');
    }, [activeIndex, promos, viewerKey]);

    useEffect(() => {
        if (promos.length <= 1) return;

        const intervalId = setInterval(() => {
            setActiveIndex((prev) => {
                const nextIndex = (prev + 1) % promos.length;
                flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                return nextIndex;
            });
        }, PROMO_ROTATION_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [promos.length]);

    const fetchPromos = async (coords: { latitude: number; longitude: number } | null) => {
        try {
            const nowIso = new Date().toISOString();
            const { data, error } = await supabase
                .from('promotions')
                .select('id, vendor_id, vendor_type, title, description, media_url, media_type, destination_type, destination_value, created_at')
                .eq('status', 'active')
                .lte('start_date', nowIso)
                .gte('end_date', nowIso)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const rows = (data as PromotionRow[]) || [];
            if (!coords || rows.length === 0) {
                setPromos([]);
                setActiveIndex(0);
                return;
            }

            const restaurantIds = [...new Set(
                rows
                    .filter((promo) => promo.vendor_type === 'restaurant')
                    .map((promo) => promo.vendor_id)
                    .filter(Boolean)
            )];

            const storeIds = [...new Set(
                rows
                    .filter((promo) => promo.vendor_type === 'store')
                    .map((promo) => promo.vendor_id)
                    .filter(Boolean)
            )];

            const [restaurantsRes, storesRes] = await Promise.all([
                restaurantIds.length > 0
                    ? supabase
                        .from('restaurants')
                        .select('id, latitude, longitude')
                        .in('id', restaurantIds)
                    : Promise.resolve({ data: [], error: null }),
                storeIds.length > 0
                    ? supabase
                        .from('stores')
                        .select('id, latitude, longitude')
                        .in('id', storeIds)
                    : Promise.resolve({ data: [], error: null }),
            ]);

            if (restaurantsRes.error) throw restaurantsRes.error;
            if (storesRes.error) throw storesRes.error;

            const vendorCoords = new Map<string, { latitude: number | null; longitude: number | null }>();
            (restaurantsRes.data || []).forEach((row: any) => {
                vendorCoords.set(row.id, {
                    latitude: typeof row.latitude === 'number' ? row.latitude : null,
                    longitude: typeof row.longitude === 'number' ? row.longitude : null,
                });
            });
            (storesRes.data || []).forEach((row: any) => {
                vendorCoords.set(row.id, {
                    latitude: typeof row.latitude === 'number' ? row.latitude : null,
                    longitude: typeof row.longitude === 'number' ? row.longitude : null,
                });
            });

            const filteredPromos = rows.filter((promo) => {
                const location = vendorCoords.get(promo.vendor_id);
                if (!location?.latitude || !location?.longitude) return false;

                const distance = calculateDistanceKm(
                    coords.latitude,
                    coords.longitude,
                    location.latitude,
                    location.longitude
                );

                return distance <= PROMO_MAX_DISTANCE_KM;
            });

            setPromos(filteredPromos);
            setActiveIndex(0);
        } catch (error) {
            console.error('Error fetching promos for carousel:', error);
            setPromos([]);
        } finally {
            setLoading(false);
        }
    };

    const getVendorProfileRoute = (promo: Promotion) => {
        if (promo.vendor_type === 'restaurant') {
            return `/restaurant-profile/${promo.vendor_id}`;
        }
        return `/store-profile/${promo.vendor_id}`;
    };

    const recordPromoEvent = async (promotionId: string, eventType: 'view' | 'click') => {
        const resolvedViewerKey = await ensureViewerKey();
        if (!resolvedViewerKey) return;

        try {
            const { data, error } = await supabase.rpc('record_promotion_event', {
                p_promotion_id: promotionId,
                p_event_type: eventType,
                p_viewer_key: resolvedViewerKey,
                p_user_id: user?.id ?? null,
            });

            if (error) {
                console.error(`Error recording promotion ${eventType}:`, error);
            } else if (data && (data as any).success === false) {
                console.error(`Promotion ${eventType} rejected:`, data);
            }
        } catch (error) {
            console.error(`Error recording promotion ${eventType}:`, error);
        }
    };

    const handlePromoPress = async (promo: Promotion) => {
        void recordPromoEvent(promo.id, 'click');

        const destinationType = promo.destination_type || 'profile';
        const destinationValue = promo.destination_value?.trim() || '';

        if (destinationType === 'item' && destinationValue) {
            if (promo.vendor_type === 'restaurant') {
                router.push(`/dish/${destinationValue}`);
            } else {
                router.push(`/store-item/${destinationValue}`);
            }
            return;
        }

        if (destinationType === 'custom_url' && destinationValue) {
            if (destinationValue.startsWith('/')) {
                router.push(destinationValue as any);
                return;
            }

            try {
                await Linking.openURL(destinationValue);
                return;
            } catch (error) {
                console.error('Error opening custom promotion URL:', error);
            }
        }

        // Default and "items" both resolve to the vendor profile page.
        router.push(getVendorProfileRoute(promo));
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#f27c22" />
            </View>
        );
    }

    if (promos.length === 0) return null;

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={promos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
                keyExtractor={(item, index) => {
                    const rawId = typeof item?.id === 'string' ? item.id.trim() : '';
                    return rawId ? `promo-${rawId}-${index}` : `promo-missing-${index}`;
                }}
                onScrollToIndexFailed={(info) => {
                    const fallbackOffset = Math.max(0, info.index * width);
                    flatListRef.current?.scrollToOffset({ offset: fallbackOffset, animated: true });
                }}
                onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / width);
                    setActiveIndex(index);
                }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        activeOpacity={0.9}
                        style={styles.itemContainer}
                        onPress={() => handlePromoPress(item)}
                    >
                        <View style={[styles.card, { borderWidth: 2, borderColor: '#f27c22' }]}>
                            {item.media_type === 'video' ? (
                                <Video
                                    source={{ uri: item.media_url }}
                                    rate={1.0}
                                    volume={0}
                                    isMuted={true}
                                    resizeMode={ResizeMode.COVER}
                                    shouldPlay
                                    isLooping
                                    style={styles.media}
                                />
                            ) : (
                                <Image source={{ uri: item.media_url }} style={styles.media} />
                            )}

                            {/* PROMOTION INDICATOR */}
                            <View style={styles.promotionBadge}>
                                <Ionicons name="megaphone" size={12} color="#fff" />
                                <ThemedText style={styles.promotionBadgeText}>PROMOTION</ThemedText>
                            </View>

                            <View style={styles.overlay}>
                                <ThemedText style={styles.promoTitle}>{item.title}</ThemedText>
                                {item.description && (
                                    <ThemedText style={styles.promoDesc} numberOfLines={1}>
                                        {item.description}
                                    </ThemedText>
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
            />

            {promos.length > 1 && (
                <View style={styles.pagination}>
                    {promos.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                { backgroundColor: i === activeIndex ? activeDotColor : dotsColor },
                                i === activeIndex && styles.activeDot
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 15,
    },
    loadingContainer: {
        height: CAROUSEL_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemContainer: {
        width: width,
        paddingHorizontal: 20,
    },
    card: {
        width: ITEM_WIDTH,
        height: CAROUSEL_HEIGHT,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 15,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    promoTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    promoDesc: {
        color: '#eee',
        fontSize: 12,
        marginTop: 2,
    },
    promotionBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#f27c22',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        zIndex: 10,
    },
    promotionBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    activeDot: {
        width: 20,
        backgroundColor: '#f27c22',
    },
});
