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
            
            const loc = await Location.getCurrentPositionAsync({});
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(coords);
            
            await fetchDishes(coords);
        } catch (err) {
            console.error("Location error:", err);
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

        if (error) console.error("Fetch error:", error);

        if (data) {
            const processed = processDishes(data, coords);
            setDishes(processed);
        }
        setLoading(false);
    };

    const processDishes = (rawItems: any[], coords: { latitude: number; longitude: number }) => {
        return rawItems.map(d => ({
            ...d,
            distance: calculateDistance(coords.latitude, coords.longitude, d.restaurant?.latitude, d.restaurant?.longitude)
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

        const distance = calculateDistance(
            userLocation!.latitude, userLocation!.longitude,
            fullDish.restaurant.latitude, fullDish.restaurant.longitude
        );

        // If it moved too far, remove it. Otherwise update it.
        if (distance > maxDistance) {
            setDishes(prev => prev.filter(d => d.id !== newRecord.id));
            return;
        }

        const updatedDish: Dish = { ...fullDish, distance, restaurant: fullDish.restaurant };

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