import { supabase } from '@/utils/supabase';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export interface StoreItem {
    id: string;
    store_id: string;
    name: string;
    description: string;
    category: string;
    price: number;
    image_url: string | null;
    is_active: boolean;
    stock_quantity: number;
    distance?: number;
    rating?: number;
    review_count?: number;
    store: {
        id: string;
        name: string;
        logo_url: string | null;
        latitude: number;
        longitude: number;
        address: string;
    };
}

export const useStoreFeed = (maxDistance: number = 20) => {
    const [items, setItems] = useState<StoreItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    useEffect(() => {
        initFeed();
    }, []);

    const initFeed = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLoading(false);
                return;
            }

            let loc = await Location.getLastKnownPositionAsync({});
            if (!loc) {
                try {
                    loc = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                        timeout: 5000
                    });
                } catch (e) {
                    console.warn("Could not retrieve current location for stores.");
                }
            }

            if (loc) {
                const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                setUserLocation(coords);
                await fetchStoreItems(coords);
            } else {
                setLoading(false);
            }
        } catch (err) {
            console.error("Store feed init error:", err);
            setLoading(false);
        }
    };

    const fetchStoreItems = async (coords: { latitude: number; longitude: number }) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('store_items')
                .select(`
                    *,
                    store:stores!store_id(*)
                `)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            if (data) {
                const processed = data.map(item => ({
                    ...item,
                    distance: calculateDistance(
                        coords.latitude,
                        coords.longitude,
                        item.store?.latitude,
                        item.store?.longitude
                    ),
                    // Default ratings for now as we don't have store_item_stats yet
                    rating: 4.5,
                    review_count: 0
                })).filter(item => item.distance <= maxDistance);

                setItems(processed);
            }
        } catch (err) {
            console.error("Error fetching store items:", err);
        } finally {
            setLoading(false);
        }
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        if (!lat2 || !lon2) return 9999;
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const refresh = () => userLocation && fetchStoreItems(userLocation);

    return { items, loading, refresh };
};
