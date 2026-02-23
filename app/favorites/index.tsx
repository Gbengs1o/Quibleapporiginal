import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

type FavoriteType = 'dish' | 'rider' | 'restaurant' | 'store_item' | 'store';

interface FavoriteItem {
    id: string;
    reference_id: string;
    type: FavoriteType;
    metadata: any;
    details?: any; // To store joined data
}

export default function FavoritesScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<FavoriteType>('dish');
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [loading, setLoading] = useState(true);

    const activeTabBg = useThemeColor({ light: '#f27c22', dark: '#f27c22' }, 'background');
    const inactiveTabBg = useThemeColor({ light: '#eee', dark: '#333' }, 'background');
    const activeTabText = '#fff';
    const inactiveTabText = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
    const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');

    useEffect(() => {
        if (user) {
            fetchFavorites();
        }
    }, [user, activeTab]);

    const fetchFavorites = async () => {
        setLoading(true);
        try {
            // Fetch favorites for current tab
            const { data: favs, error } = await supabase
                .from('favorites')
                .select('*')
                .eq('user_id', user?.id)
                .eq('type', activeTab);

            if (error) throw error;

            if (!favs || favs.length === 0) {
                setFavorites([]);
                setLoading(false);
                return;
            }

            // Now we need to fetch the details for each favorite
            const referenceIds = favs.map(f => f.reference_id);
            let detailsData: any[] = [];

            if (activeTab === 'dish') {
                const { data } = await supabase.from('menu_items').select('*').in('id', referenceIds);
                detailsData = data || [];
            } else if (activeTab === 'rider') {
                const { data: riders } = await supabase.from('riders').select('id, user_id, status, rider_photo').in('user_id', referenceIds);
                if (riders) {
                    const userIds = riders.map(r => r.user_id);
                    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name').in('id', userIds);
                    detailsData = riders.map(r => {
                        const p = profiles?.find(prof => prof.id === r.user_id);
                        return { ...r, ...p };
                    });
                }
            } else if (activeTab === 'restaurant') {
                const { data } = await supabase.from('restaurants').select('*').in('id', referenceIds);
                detailsData = data || [];
            } else if (activeTab === 'store_item') {
                const { data } = await supabase.from('store_items').select('*').in('id', referenceIds);
                detailsData = data || [];
            } else if (activeTab === 'store') {
                const { data } = await supabase.from('stores').select('*').in('id', referenceIds);
                detailsData = data || [];
            }

            // Merge details back into favorites
            const enrichedFavorites = favs.map(f => {
                const detail = detailsData.find(d => {
                    if (activeTab === 'dish' || activeTab === 'restaurant' || activeTab === 'store_item' || activeTab === 'store') {
                        return d.id === f.reference_id;
                    }
                    if (activeTab === 'rider') return d.user_id === f.reference_id;
                    return false;
                });
                return { ...f, details: detail };
            }).filter(f => f.details);

            setFavorites(enrichedFavorites);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: FavoriteItem }) => {
        const d = item.details;
        let title = '';
        let subtitle = '';
        let image = null;

        if (activeTab === 'dish') {
            title = d.name;
            subtitle = `₦${d.price.toLocaleString()}`;
            image = d.image_url;
        } else if (activeTab === 'restaurant') {
            title = d.name;
            subtitle = d.address || 'Restaurant';
            image = d.logo_url;
        } else if (activeTab === 'store_item') {
            title = d.name;
            subtitle = `₦${d.price.toLocaleString()}`;
            image = d.image_url;
        } else if (activeTab === 'store') {
            title = d.name;
            subtitle = d.address || 'Store';
            image = d.logo_url;
        } else if (activeTab === 'rider') {
            title = `${d.first_name || 'Rider'} ${d.last_name || ''}`;
            subtitle = d.status === 'active' ? 'Available' : 'Offline';
            image = d.rider_photo || d.profile_picture_url;
        }

        return (
            <TouchableOpacity style={[styles.card, { backgroundColor: cardBg }]} onPress={() => {
                if (activeTab === 'dish') router.push(`/dish/${d.id}`);
                if (activeTab === 'restaurant') router.push(`/restaurant-profile/${d.id}`);
                if (activeTab === 'store_item') router.push(`/store-item/${d.id}`);
                if (activeTab === 'store') router.push(`/store-profile/${d.id}`);
                if (activeTab === 'rider') router.push(`/rider/${d.id}`);
            }}>
                <Image source={{ uri: image || 'https://via.placeholder.com/80' }} style={styles.image} />
                <View style={styles.info}>
                    <ThemedText style={styles.title}>{title}</ThemedText>
                    <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
                </View>
                <Ionicons name="heart" size={24} color="#f27c22" />
            </TouchableOpacity>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerTitle: 'Favorites', headerShadowVisible: false }} />

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                    {(['dish', 'store_item', 'restaurant', 'store', 'rider'] as FavoriteType[]).map(tab => (
                        <TouchableOpacity
                            key={tab}
                            style={[
                                styles.tab,
                                { backgroundColor: activeTab === tab ? activeTabBg : inactiveTabBg }
                            ]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <ThemedText style={{
                                color: activeTab === tab ? activeTabText : inactiveTabText,
                                fontWeight: '600',
                                textTransform: 'capitalize'
                            }}>
                                {tab === 'dish' ? 'Food' : (tab === 'store_item' ? 'Store Items' : (tab === 'restaurant' ? 'Restaurants' : (tab === 'store' ? 'Stores' : 'Riders')))}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#f27c22" />
                </View>
            ) : favorites.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="heart-dislike-outline" size={64} color="#ccc" />
                    <ThemedText style={{ color: '#999', marginTop: 10 }}>No favorites yet</ThemedText>
                </View>
            ) : (
                <FlatList
                    data={favorites}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                />
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    tabsContainer: { height: 60 },
    tabs: { paddingHorizontal: 16, alignItems: 'center', gap: 10 },
    tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: 16 },
    card: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 12, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    image: { width: 60, height: 60, borderRadius: 30, marginRight: 12, backgroundColor: '#eee' },
    info: { flex: 1 },
    title: { fontWeight: 'bold', fontSize: 16 },
    subtitle: { color: '#666', fontSize: 14, marginTop: 4 }
});
