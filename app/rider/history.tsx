import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function RiderHistoryScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Theme
    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#0D0D0D' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1A1A1A' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const mutedText = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');
    const borderColor = useThemeColor({ light: '#E5E7EB', dark: '#333333' }, 'background');
    const primary = '#F27C22';
    const success = '#22C55E';

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('delivery_requests')
                .select('*')
                .eq('rider_id', user?.id)
                .eq('status', 'delivered')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setJobs(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.cardHeader}>
                <View style={styles.dateContainer}>
                    <Ionicons name="calendar-outline" size={14} color={mutedText} />
                    <ThemedText style={[styles.dateText, { color: mutedText }]}>
                        {new Date(item.updated_at).toLocaleDateString()} • {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </ThemedText>
                </View>
                <View style={[styles.priceBadge, { backgroundColor: success + '15' }]}>
                    <ThemedText style={[styles.priceText, { color: success }]}>
                        +₦{(item.final_price || item.offered_price)?.toLocaleString()}
                    </ThemedText>
                </View>
            </View>

            <View style={styles.routeContainer}>
                <View style={[styles.dot, { backgroundColor: primary }]} />
                <ThemedText style={[styles.address, { color: textColor }]} numberOfLines={1}>
                    {item.pickup_address}
                </ThemedText>
            </View>
            <View style={styles.connector} />
            <View style={styles.routeContainer}>
                <View style={[styles.dot, { backgroundColor: success }]} />
                <ThemedText style={[styles.address, { color: textColor }]} numberOfLines={1}>
                    {item.dropoff_address}
                </ThemedText>
            </View>

            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <TouchableOpacity
                style={styles.detailsBtn}
                onPress={() => router.push(`/rider/delivery/${item.id}`)}
            >
                <ThemedText style={{ color: primary, fontWeight: '600', fontSize: 13 }}>View Details</ThemedText>
                <Ionicons name="chevron-forward" size={16} color={primary} />
            </TouchableOpacity>
        </View>
    );

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, { color: textColor }]}>Delivery History</ThemedText>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={primary} />
                </View>
            ) : (
                <FlatList
                    data={jobs}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} colors={[primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="document-text-outline" size={64} color={mutedText} />
                            <ThemedText style={[styles.emptyText, { color: mutedText }]}>No completed deliveries yet</ThemedText>
                        </View>
                    }
                />
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    backBtn: { padding: 4 },
    listContent: { padding: 16 },

    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
            android: { elevation: 2 }
        }),
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    dateContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dateText: { fontSize: 12, fontWeight: '500' },
    priceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    priceText: { fontSize: 14, fontWeight: '700' },

    routeContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    address: { fontSize: 14, flex: 1, fontWeight: '500' },
    connector: { height: 16, borderLeftWidth: 1, borderLeftColor: '#ccc', marginLeft: 3.5, marginVertical: 2 },

    divider: { height: 1, marginVertical: 12 },
    detailsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },

    emptyContainer: { alignItems: 'center', marginTop: 100, padding: 20 },
    emptyText: { marginTop: 16, fontSize: 16 },
});
