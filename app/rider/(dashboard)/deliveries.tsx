import DeliveryRequestCard from '@/components/DeliveryRequestCard';
import LottieLoader from '@/components/LottieLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function DeliveryRequests() {
    const { openMenu } = useRiderMenu();
    const { user } = useAuth();
    const { tab } = useLocalSearchParams();
    const router = useRouter();
    const iconColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');
    const subtleColor = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');
    const cardBg = useThemeColor({ light: '#FFF', dark: '#1E1E1E' }, 'background');

    const [activeTab, setActiveTab] = useState<'logistics' | 'active' | 'food' | 'history'>('logistics');

    const [requests, setRequests] = useState<any[]>([]);
    const [invites, setInvites] = useState<any[]>([]); // New state for invites
    const [myBids, setMyBids] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        if (tab && typeof tab === 'string' && ['logistics', 'active', 'food', 'history'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [tab]);

    useEffect(() => {
        if (user) fetchData();

        // Real-time subscription for both tables
        const requestSub = supabase
            .channel('delivery_requests_feed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requests' }, () => fetchData())
            .subscribe();

        const inviteSub = supabase
            .channel('rider_invites')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_rider_bids', filter: `rider_id=eq.${user?.id}` },
                () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(requestSub);
            supabase.removeChannel(inviteSub);
        };
    }, [activeTab, user?.id]);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            if (activeTab === 'logistics') {
                const { data: reqData, error: reqError } = await supabase
                    .from('delivery_requests')
                    .select('*')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });

                if (reqError) throw reqError;
                setRequests(reqData || []);

                // Fetch My Bids 
                const { data: bidData } = await supabase
                    .from('delivery_bids')
                    .select('*')
                    .eq('rider_id', user.id);
                setMyBids(bidData || []);

            } else if (activeTab === 'active') { // Active Jobs (Logistics OR Food)
                // Fetch Logistics Active
                const { data: logisticsData, error: logError } = await supabase
                    .from('delivery_requests')
                    .select('*')
                    .eq('rider_id', user?.id)
                    .in('status', ['accepted', 'picked_up'])
                    .order('updated_at', { ascending: false });

                if (logError) throw logError;

                // Fetch Food Active
                const { data: foodData, error: foodError } = await supabase
                    .from('orders') // Food orders
                    .select(`
                        id,
                        status,
                        total_amount,
                        delivery_fee,
                        created_at,
                        pickup_code,
                        restaurant:restaurants (
                            name,
                            address
                        )
                    `)
                    .eq('rider_id', user.id)
                    .in('status', ['with_rider', 'out_for_delivery']) // 'active' statuses for food
                    .order('updated_at', { ascending: false });

                if (foodError) throw foodError;

                // Transform Food Data to match common interface or handle separately
                const formattedFood = (foodData || []).map((order: any) => {
                    const restaurant = Array.isArray(order.restaurant) ? order.restaurant[0] : order.restaurant;
                    return {
                        id: order.id,
                        type: 'food',
                        pickup_address: restaurant?.address,
                        dropoff_address: 'Customer Address', // TODO: Get from order details if needed
                        final_price: order.delivery_fee,
                        status: order.status,
                        created_at: order.created_at,
                        restaurant_name: restaurant?.name,
                        item_description: 'Food Order',
                        pickup_code: order.pickup_code
                    };
                });

                setRequests([...(logisticsData || []), ...formattedFood]);

            } else if (activeTab === 'history') {
                const { data, error } = await supabase
                    .from('delivery_requests')
                    .select('*')
                    .eq('rider_id', user?.id)
                    .in('status', ['delivered', 'cancelled'])
                    .order('updated_at', { ascending: false });
                if (error) throw error;
                setRequests(data || []);

            } else if (activeTab === 'food') {
                // FETCH INVITES using RPC (bypasses RLS issues)
                const { data: inviteData, error: inviteError } = await supabase
                    .rpc('get_rider_food_invites', { p_rider_id: user.id });

                if (inviteError) throw inviteError;

                // Transform RPC result to match expected format
                const formattedInvites = (inviteData || []).map((invite: any) => ({
                    id: invite.bid_id,
                    amount: invite.amount,
                    status: invite.bid_status,
                    created_at: invite.created_at,
                    order: {
                        id: invite.order_id,
                        total_amount: invite.order_total,
                        status: invite.order_status,
                        restaurant: {
                            name: invite.restaurant_name,
                            address: invite.restaurant_address,
                            logo_url: invite.restaurant_logo_url
                        }
                    }
                }));

                setInvites(formattedInvites);
                setRequests([]); // Clear requests as we use 'invites' state
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleBid = async (requestId: string, amount: number) => {
        if (!user) return;
        try {
            const { error } = await supabase.from('delivery_bids').insert({
                request_id: requestId,
                rider_id: user.id,
                amount: amount
            });
            if (error) throw error;
            Alert.alert('Success', 'Bid placed!');
            fetchData();
        } catch (err: any) {
            Alert.alert('Error', err.message);
        }
    };

    const handleRespondToInvite = async (orderId: string, response: 'accepted' | 'rejected') => {
        if (!user) return;
        setProcessing(orderId);

        try {
            const { data, error } = await supabase.rpc('rider_respond_to_invite', {
                p_order_id: orderId,
                p_rider_id: user.id,
                p_response: response
            });

            if (error) throw error;

            if (data?.success) {
                Alert.alert('Success', response === 'accepted' ? 'You accepted the order!' : 'Invite declined.');
                if (response === 'accepted') {
                    setActiveTab('active'); // Switch to active tab
                } else {
                    fetchData();
                }
            } else {
                Alert.alert('Error', data?.message || 'Action failed');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setProcessing(null);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const getTitle = () => {
        switch (activeTab) {
            case 'active': return 'My Active Jobs';
            case 'history': return 'Order History';
            case 'food': return 'Food Requests'; // Renamed
            default: return 'New Requests';
        }
    };


    const getTimeAgo = (dateStr: string) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) + ' · ' + date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    };

    const renderActiveJobCard = ({ item }: { item: any }) => {
        const isFoodOrder = item.type === 'food';
        const navRoute = `/rider/delivery/${item.id}`;
        const timeAgo = getTimeAgo(item.created_at);
        const isStale = (new Date().getTime() - new Date(item.created_at).getTime()) > 86400000; // older than 24h

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: cardBg, borderLeftWidth: isStale ? 3 : 0, borderLeftColor: '#EF4444' }]}
                onPress={() => router.push(navRoute as any)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.row, { flex: 1 }]}>
                        <View style={[styles.iconBox, { backgroundColor: isFoodOrder ? 'rgba(242, 124, 34, 0.1)' : 'rgba(76, 175, 80, 0.1)' }]}>
                            <Ionicons name={isFoodOrder ? 'restaurant' : 'cube'} size={20} color={isFoodOrder ? '#F27C22' : '#4CAF50'} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <ThemedText style={styles.restaurantName}>
                                {item.restaurant_name || 'Delivery'}
                            </ThemedText>
                            <ThemedText style={styles.timestamp}>
                                {item.pickup_address || 'Pickup Location'}
                            </ThemedText>
                        </View>
                    </View>
                    <View style={[styles.activeStatusBadge, {
                        backgroundColor: item.status === 'picked_up' ? '#e8f5e9' : '#FFF3E0'
                    }]}>
                        <ThemedText style={[styles.activeStatusText, {
                            color: item.status === 'picked_up' ? '#4CAF50' : '#F27C22'
                        }]}>
                            {item.status === 'picked_up' ? 'Picked Up' : 'In Progress'}
                        </ThemedText>
                    </View>
                </View>

                {/* Date/Time Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <Ionicons name="time-outline" size={14} color={isStale ? '#EF4444' : '#888'} />
                    <ThemedText style={{ fontSize: 12, color: isStale ? '#EF4444' : '#888', fontWeight: isStale ? '600' : '400' }}>
                        {timeAgo}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 11, color: '#aaa' }}>
                        ({formatDate(item.created_at)})
                    </ThemedText>
                    {isStale && (
                        <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 }}>
                            <ThemedText style={{ fontSize: 10, color: '#EF4444', fontWeight: 'bold' }}>OVERDUE</ThemedText>
                        </View>
                    )}
                </View>

                <View style={styles.divider} />

                {/* Delivery Fee */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="cash-outline" size={16} color={subtleColor} />
                        <ThemedText style={{ color: subtleColor, fontSize: 14 }}>
                            Delivery Fee: <ThemedText style={{ fontWeight: 'bold', color: '#F27C22' }}>₦{(item.final_price ?? item.delivery_fee ?? 0).toLocaleString()}</ThemedText>
                        </ThemedText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <ThemedText style={{ color: '#F27C22', fontSize: 13, fontWeight: '600' }}>View Details</ThemedText>
                        <Ionicons name="chevron-forward" size={16} color="#F27C22" />
                    </View>
                </View>

                {/* Pickup Code */}
                {item.pickup_code && (
                    <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd' }}>
                        <ThemedText style={{ textAlign: 'center', fontSize: 12, color: '#0369a1', marginBottom: 4 }}>
                            SECURE HANDOFF CODE
                        </ThemedText>
                        <ThemedText style={{ textAlign: 'center', fontSize: 24, fontWeight: 'bold', color: '#0284c7', letterSpacing: 4 }}>
                            {item.pickup_code}
                        </ThemedText>
                        <ThemedText style={{ textAlign: 'center', fontSize: 10, color: '#0369a1', marginTop: 4 }}>
                            Show this code to the restaurant
                        </ThemedText>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderInviteCard = ({ item }: { item: any }) => {
        const order = item.order;

        // Guard: Skip rendering if order data is missing
        if (!order) {
            return null;
        }

        const restaurant = order?.restaurant;
        const isProcessing = processing === order.id;

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: cardBg }]}
                onPress={() => router.push(`/rider/job-preview/${order.id}?amount=${item.amount}`)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.row}>
                        <View style={styles.iconBox}>
                            <Ionicons name="restaurant" size={20} color="#F27C22" />
                        </View>
                        <View>
                            <ThemedText style={styles.restaurantName}>{restaurant?.name || 'Restaurant'}</ThemedText>
                            <ThemedText style={styles.timestamp}>{new Date(item.created_at).toLocaleTimeString()}</ThemedText>
                        </View>
                    </View>
                    <ThemedText style={styles.price}>₦{item.amount}</ThemedText>
                </View>

                <View style={styles.divider} />

                <View style={styles.locationRow}>
                    <Ionicons name="location" size={16} color={subtleColor} />
                    <ThemedText style={styles.addressText} numberOfLines={1}>
                        {restaurant?.address || 'Pickup Location'}
                    </ThemedText>
                </View>

                {/* View Details Prompt */}
                <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                    <ThemedText style={{ color: '#F27C22', fontSize: 13, fontWeight: '600' }}>
                        Tap to view distance, ETA & map →
                    </ThemedText>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.rejectBtn]}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleRespondToInvite(order.id, 'rejected');
                        }}
                        disabled={isProcessing || processing !== null}
                    >
                        <ThemedText style={[styles.btnText, { color: '#EF4444' }]}>Decline</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.acceptBtn]}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleRespondToInvite(order.id, 'accepted');
                        }}
                        disabled={isProcessing || processing !== null}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <ThemedText style={[styles.btnText, { color: '#fff' }]}>Accept Order</ThemedText>
                        )}
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu}>
                    <Ionicons name="menu" size={28} color={iconColor} />
                </TouchableOpacity>
                <ThemedText style={styles.title}>{getTitle()}</ThemedText>
                <View style={{ width: 28 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {['logistics', 'active', 'food', 'history'].map((t) => (
                        <TouchableOpacity
                            key={t}
                            style={[styles.tab, activeTab === t && styles.activeTab]}
                            onPress={() => setActiveTab(t as any)}
                        >
                            <ThemedText style={[styles.tabText, activeTab === t && styles.activeTabText]}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <LottieLoader size={120} />
                </View>
            ) : (
                <FlatList
                    data={activeTab === 'food' ? invites : requests}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => {
                        if (activeTab === 'food') return renderInviteCard({ item });
                        if (activeTab === 'active') return renderActiveJobCard({ item });
                        return (
                            <DeliveryRequestCard
                                request={item}
                                onBid={handleBid}
                                onAccept={(id, amt) => handleBid(id, amt)}
                                myBidAmount={undefined}
                                showActions={activeTab === 'logistics'}
                            />
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Ionicons name="cube-outline" size={64} color="#ccc" />
                            <ThemedText style={styles.emptyText}>No items found</ThemedText>
                        </View>
                    }
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                />
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    title: { fontSize: 20, fontWeight: 'bold' },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        marginTop: 50,
    },
    listContent: {
        padding: 20,
        paddingBottom: 100,
    },
    emptyText: { fontSize: 18, fontWeight: '600', marginTop: 10 },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    tab: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    activeTab: {
        backgroundColor: '#F27C22',
        borderColor: '#F27C22',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        opacity: 0.7,
    },
    activeTabText: {
        color: '#fff',
        opacity: 1,
    },

    // Card Styles
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(242, 124, 34, 0.1)', justifyContent: 'center', alignItems: 'center' },
    restaurantName: { fontWeight: 'bold', fontSize: 16 },
    timestamp: { fontSize: 12, color: '#888' },
    price: { fontWeight: 'bold', fontSize: 18, color: '#F27C22' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    addressText: { color: '#666', fontSize: 14, flex: 1 },
    actions: { flexDirection: 'row', gap: 12 },
    actionButton: { flex: 1, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    rejectBtn: { borderColor: '#EF4444', backgroundColor: 'transparent' },
    acceptBtn: { backgroundColor: '#F27C22', borderColor: '#F27C22' },
    btnText: { fontWeight: 'bold', fontSize: 14 },
    activeStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    activeStatusText: { fontSize: 12, fontWeight: '600' },
});
