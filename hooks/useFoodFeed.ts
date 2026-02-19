import { supabase } from '@/utils/supabase';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export interface Dish {
    id: string;
    name: string;
    description: string;
    category: string;
    price: number;
    image_url: string | null;
    is_active: boolean;
    distance?: number;
    rating?: number;
    review_count?: number;
    restaurant: {
        id: string;
        name: string;
        logo_url: string | null;
        latitude: number;
        longitude: number;
    };
}

export const useFoodFeed = (maxDistance: number = 15) => {
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    // Initial Load
    useEffect(() => {
        initFeed();
    }, []);

    const initFeed = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') { setLoading(false); return; }

            // Try last known location first for speed
            let loc = await Location.getLastKnownPositionAsync({});

            if (!loc) {
                // If no last known, try current with timeout
                try {
                    loc = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                        timeout: 5000
                    });
                } catch (e) {
                    console.warn("Could not retrieve current location, using default or skipping.");
                }
            }

            if (loc) {
                const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                setUserLocation(coords);
                await fetchDishes(coords);
            } else {
                // Fallback to Lagos or empty
                setLoading(false);
            }
        } catch (err) {
            console.log("Location initialization error (handled):", err);
            setLoading(false);
        }
    };

    // Data Fetching
    const fetchDishes = async (coords: { latitude: number; longitude: number }) => {
        setLoading(true);
        const { data, error } = await supabase
            .from('menu_items')
            .select(`*, restaurant:restaurants!restaurant_id(*)`)
            .order('id', { ascending: true })
            .limit(50);

        if (error) {
            console.error("Fetch error (menu_items):", error.message || error);
        }

        if (data) {
            // Fetch ratings
            const dishIds = data.map(d => d.id);
            const { data: stats } = await supabase
                .from('dish_stats')
                .select('dish_id, average_rating, review_count')
                .in('dish_id', dishIds);

            // Create specific map for O(1) lookup
            const statsMap = new Map(stats?.map(s => [s.dish_id, s]) || []);

            const processed = processDishes(data, coords, statsMap);
            setDishes(processed);
        }
        setLoading(false);
    };

    const processDishes = (rawItems: any[], coords: { latitude: number; longitude: number }, statsMap?: Map<string, any>) => {
        return rawItems.map(d => ({
            ...d,
            distance: calculateDistance(coords.latitude, coords.longitude, d.restaurant?.latitude, d.restaurant?.longitude),
            rating: parseFloat(statsMap?.get(d.id)?.average_rating) || 0,
            review_count: parseInt(statsMap?.get(d.id)?.review_count) || 0
        })).filter(d => d.distance <= maxDistance);
    };

    // --- REALTIME LISTENER ---
    useEffect(() => {
        if (!userLocation) return;

        console.log("🟢 SYSTEM: Listening for background updates on 'menu_items'...");

        const channel = supabase.channel('food_feed_live')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'menu_items' },
                (payload) => {
                    console.log("⚡ UPDATE DETECTED:", payload.eventType);
                    handleSilentUpdate(payload);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userLocation]); // Re-binds if location changes

    const handleSilentUpdate = async (payload: any) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        if (eventType === 'DELETE') {
            setDishes(prev => prev.filter(d => d.id !== oldRecord.id));
            return;
        }

        // Fetch the SINGLE updated item cleanly
        const { data: fullDish, error } = await supabase
            .from('menu_items')
            .select(`*, restaurant:restaurants!restaurant_id(*)`)
            .eq('id', newRecord.id)
            .single();

        if (error || !fullDish || !fullDish.restaurant) return;

        // Fetch rating for this single item
        const { data: stats } = await supabase
            .from('dish_stats')
            .select('average_rating, review_count')
            .eq('dish_id', newRecord.id)
            .single();

        const distance = calculateDistance(
            userLocation!.latitude, userLocation!.longitude,
            fullDish.restaurant.latitude, fullDish.restaurant.longitude
        );

        // If it moved too far, remove it. Otherwise update it.
        if (distance > maxDistance) {
            setDishes(prev => prev.filter(d => d.id !== newRecord.id));
            return;
        }

        const updatedDish: Dish = {
            ...fullDish,
            distance,
            restaurant: fullDish.restaurant,
            rating: parseFloat(stats?.average_rating) || 0,
            review_count: parseInt(stats?.review_count) || 0
        };

        setDishes(prev => {
            const index = prev.findIndex(d => d.id === newRecord.id);

            // If it's new and not in list, add to top
            if (eventType === 'INSERT' && index === -1) {
                return [updatedDish, ...prev];
            }

            // If it exists, SWAP IT OUT perfectly
            if (index !== -1) {
                const newArr = [...prev];
                newArr[index] = updatedDish;
                return newArr;
            }

            return prev;
        });
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        if (!lat2 || !lon2) return 9999;
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return { dishes, loading, refresh: () => userLocation && fetchDishes(userLocation) };
};