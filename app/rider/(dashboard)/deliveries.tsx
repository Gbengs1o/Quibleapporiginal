import DeliveryRequestCard from '@/components/DeliveryRequestCard';
import LottieLoader from '@/components/LottieLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderNotifications } from '@/contexts/rider-notifications';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function DeliveryRequests() {
    const { openMenu } = useRiderMenu();
    const { user } = useAuth();
    const { pendingDeliveries, pendingFoodInvites, activeOrders, refreshNotifications } = useRiderNotifications();
    const { tab } = useLocalSearchParams();
    const router = useRouter();
    const iconColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');
    const subtleColor = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');
    const cardBg = useThemeColor({ light: '#FFF', dark: '#1E1E1E' }, 'background');

    const [activeTab, setActiveTab] = useState<'logistics' | 'active' | 'orders' | 'history'>('logistics');

    const [requests, setRequests] = useState<any[]>([]);
    const [invites, setInvites] = useState<any[]>([]); // New state for invites
    const [myBids, setMyBids] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);
    const [countdowns, setCountdowns] = useState<Record<string, number>>({});
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [seenCounts, setSeenCounts] = useState<Record<'logistics' | 'active' | 'orders' | 'history', number>>({
        logistics: 0,
        active: 0,
        orders: 0,
        history: 0,
    });

    useEffect(() => {
        if (tab && typeof tab === 'string' && ['logistics', 'active', 'orders', 'history'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [tab]);

    useEffect(() => {
        if (!user?.id) return;
        fetchData();

        // Real-time subscriptions for rider orders feed.
        const requestSub = supabase
            .channel(`delivery_requests_feed:${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requests' }, () => fetchData({ silent: true }))
            .subscribe();

        const inviteSub = supabase
            .channel(`rider_invites:${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_rider_bids', filter: `rider_id=eq.${user.id}` },
                () => fetchData({ silent: true })
            )
            .subscribe();

        // Keeps bid status in sync (pending -> accepted/rejected) without manual refresh.
        const bidSub = supabase
            .channel(`delivery_bids_feed:${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'delivery_bids', filter: `rider_id=eq.${user.id}` },
                () => fetchData({ silent: true })
            )
            .subscribe();

        return () => {
            supabase.removeChannel(requestSub);
            supabase.removeChannel(inviteSub);
            supabase.removeChannel(bidSub);
        };
    }, [activeTab, user?.id]);

    // Fallback polling for cases where realtime delivery events lag/drop on client networks.
    useEffect(() => {
        if (!user?.id) return;
        const poll = setInterval(() => {
            fetchData({ silent: true });
        }, 5000);

        return () => clearInterval(poll);
    }, [activeTab, user?.id]);

    const fetchData = async (options?: { silent?: boolean }) => {
        if (!user) return;
        const silent = options?.silent === true;
        if (!silent) setLoading(true);
        try {
            if (activeTab === 'logistics') {
                const { data: reqData, error: reqError } = await supabase
                    .from('delivery_requests')
                    .select('*')
                    .eq('status', 'pending')
                    .or(`rider_id.is.null,rider_id.eq.${user.id}`)
                    .order('created_at', { ascending: false });

                if (reqError) throw reqError;
                setRequests(reqData || []);

                // Fetch My Bids 
                const { data: bidData } = await supabase
                    .from('delivery_bids')
                    .select('id, request_id, amount, status, created_at')
                    .eq('rider_id', user.id)
                    .order('created_at', { ascending: false });
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

                // Fetch Food/Store Active orders
                const { data: foodData, error: foodError } = await supabase
                    .from('orders')
                    .select(`
                        id,
                        status,
                        total_amount,
                        delivery_fee,
                        created_at,
                        pickup_code,
                        restaurant_id,
                        store_id,
                        restaurant:restaurants (
                            name,
                            address
                        ),
                        store:stores (
                            name,
                            address
                        )
                    `)
                    .eq('rider_id', user.id)
                    .in('status', ['ready', 'with_rider', 'out_for_delivery'])
                    .order('updated_at', { ascending: false });

                if (foodError) throw foodError;

                const formattedFood = (foodData || []).map((order: any) => {
                    const isStore = !!order.store_id;
                    const source = isStore
                        ? (Array.isArray(order.store) ? order.store[0] : order.store)
                        : (Array.isArray(order.restaurant) ? order.restaurant[0] : order.restaurant);
                    return {
                        id: order.id,
                        type: isStore ? 'store' : 'food',
                        pickup_address: source?.address,
                        dropoff_address: 'Customer Address',
                        final_price: order.delivery_fee,
                        status: order.status,
                        created_at: order.created_at,
                        restaurant_name: source?.name,
                        item_description: isStore ? 'Store Order' : 'Food Order',
                        pickup_code: order.pickup_code
                    };
                });

                setRequests([...(logisticsData || []), ...formattedFood]);

            } else if (activeTab === 'history') {
                const [logisticsRes, orderRes] = await Promise.all([
                    supabase
                        .from('delivery_requests')
                        .select('*')
                        .eq('rider_id', user?.id)
                        .in('status', ['delivered', 'cancelled'])
                        .order('updated_at', { ascending: false }),
                    supabase
                        .from('orders')
                        .select(`
                            id,
                            status,
                            total_amount,
                            delivery_fee,
                            pickup_code,
                            created_at,
                            updated_at,
                            restaurant_id,
                            store_id,
                            restaurant:restaurants (
                                name,
                                address
                            ),
                            store:stores (
                                name,
                                address
                            )
                        `)
                        .eq('rider_id', user.id)
                        .in('status', ['delivered', 'cancelled'])
                        .order('updated_at', { ascending: false })
                ]);

                if (logisticsRes.error) throw logisticsRes.error;
                if (orderRes.error) throw orderRes.error;

                const logisticsHistory = logisticsRes.data || [];
                const orderHistory = (orderRes.data || []).map((order: any) => {
                    const isStore = !!order.store_id;
                    const source = isStore
                        ? (Array.isArray(order.store) ? order.store[0] : order.store)
                        : (Array.isArray(order.restaurant) ? order.restaurant[0] : order.restaurant);
                    return {
                        id: order.id,
                        type: isStore ? 'store' : 'food',
                        pickup_address: source?.address || 'Pickup Location',
                        dropoff_address: 'Customer Address',
                        item_description: isStore ? 'Store Order' : 'Food Order',
                        offered_price: order.delivery_fee ?? 0,
                        final_price: order.delivery_fee ?? 0,
                        status: order.status,
                        created_at: order.created_at,
                        updated_at: order.updated_at,
                        restaurant_name: source?.name || (isStore ? 'Store' : 'Restaurant'),
                        pickup_code: order.pickup_code
                    };
                });

                const mergedHistory = [...logisticsHistory, ...orderHistory].sort((a: any, b: any) => {
                    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
                    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
                    return bTime - aTime;
                });

                setRequests(mergedHistory);

            } else if (activeTab === 'orders') {
                // 1) Vendor invites (restaurant/store)
                const { data: inviteData, error: inviteError } = await supabase
                    .rpc('get_rider_order_invites', { p_rider_id: user.id });
                if (inviteError) throw inviteError;

                // 2) Open package/ride requests from marketplace
                const { data: logisticsData, error: logisticsError } = await supabase
                    .from('delivery_requests')
                    .select(`
                        id,
                        rider_id,
                        pickup_address,
                        dropoff_address,
                        item_description,
                        offered_price,
                        item_image_url,
                        status,
                        vehicle_types,
                        delivery_notes,
                        request_type,
                        created_at
                    `)
                    .eq('status', 'pending')
                    .or(`rider_id.is.null,rider_id.eq.${user.id}`)
                    .order('created_at', { ascending: false });
                if (logisticsError) throw logisticsError;

                // 3) Rider's existing bids on package/ride requests
                const { data: bidData } = await supabase
                    .from('delivery_bids')
                    .select('id, request_id, amount, status, created_at')
                    .eq('rider_id', user.id)
                    .order('created_at', { ascending: false });
                setMyBids(bidData || []);

                const formattedInvites = (inviteData || []).map((invite: any) => {
                    const isStore = invite.order_source === 'store';
                    return {
                        id: invite.bid_id,
                        feed_type: 'vendor_invite',
                        amount: invite.amount,
                        status: invite.bid_status,
                        created_at: invite.created_at,
                        expired_at: invite.expired_at || null,
                        order_source: invite.order_source || 'restaurant',
                        order: {
                            id: invite.order_id,
                            total_amount: invite.order_total,
                            status: invite.order_status,
                            restaurant: isStore ? null : {
                                name: invite.restaurant_name,
                                address: invite.restaurant_address,
                                logo_url: invite.restaurant_logo_url
                            },
                            store: isStore ? {
                                name: invite.store_name,
                                address: invite.store_address,
                                logo_url: invite.store_logo_url
                            } : null
                        }
                    };
                });

                const formattedLogistics = (logisticsData || []).map((req: any) => ({
                    ...req,
                    feed_type: 'market_request'
                }));

                const mergedOrderFeed = [...formattedInvites, ...formattedLogistics].sort(
                    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                setInvites(mergedOrderFeed);

                const newCountdowns: Record<string, number> = {};
                formattedInvites.forEach((inv: any) => {
                    if (inv.expired_at && inv.status === 'invited') {
                        const remaining = Math.max(0, Math.floor((new Date(inv.expired_at).getTime() - Date.now()) / 1000));
                        newCountdowns[inv.id] = remaining;
                    }
                });
                setCountdowns(newCountdowns);
                setRequests([]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            if (!silent) setLoading(false);
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

    const handleAcceptDirectRequest = async (requestId: string) => {
        if (!user) return;
        setProcessing(requestId);
        try {
            const { data: req, error: fetchError } = await supabase
                .from('delivery_requests')
                .select('id, rider_id, offered_price, status')
                .eq('id', requestId)
                .single();

            if (fetchError) throw fetchError;
            if (!req) throw new Error('Request not found');
            if (req.rider_id && req.rider_id !== user.id) {
                throw new Error('This request is assigned to another rider');
            }
            if (req.status !== 'pending') {
                throw new Error('This request is no longer pending');
            }

            const { error: updateError } = await supabase
                .from('delivery_requests')
                .update({
                    rider_id: user.id,
                    status: 'accepted',
                    final_price: req.offered_price,
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (updateError) throw updateError;

            Alert.alert('Success', 'Request accepted. Proceed to pickup.');
            setActiveTab('active');
            await fetchData();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to accept request');
        } finally {
            setProcessing(null);
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
        refreshNotifications();
        fetchData();
    };

    // Countdown timer for order invites
    useEffect(() => {
        if (activeTab !== 'orders') return;
        if (countdownRef.current) clearInterval(countdownRef.current);

        countdownRef.current = setInterval(() => {
            setCountdowns(prev => {
                const updated = { ...prev };
                for (const id of Object.keys(updated)) {
                    if (updated[id] > 0) {
                        updated[id] = updated[id] - 1;
                    }
                }
                return updated;
            });
        }, 1000);

        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [activeTab, invites]);

    const getRawTabCount = (tabKey: 'logistics' | 'active' | 'orders' | 'history') => {
        if (tabKey === 'logistics') return pendingDeliveries;
        if (tabKey === 'active') return activeOrders;
        if (tabKey === 'orders') return pendingFoodInvites + pendingDeliveries;
        return 0;
    };

    const acknowledgeTab = (tabKey: 'logistics' | 'active' | 'orders' | 'history') => {
        const rawCount = getRawTabCount(tabKey);
        setSeenCounts(prev => {
            if (prev[tabKey] === rawCount) return prev;
            return { ...prev, [tabKey]: rawCount };
        });
    };

    // Keep baseline aligned when raw counts shrink.
    useEffect(() => {
        setSeenCounts(prev => {
            const next = { ...prev };
            let changed = false;
            (['logistics', 'active', 'orders', 'history'] as const).forEach(tabKey => {
                const raw = getRawTabCount(tabKey);
                if (next[tabKey] > raw) {
                    next[tabKey] = raw;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [pendingDeliveries, pendingFoodInvites, activeOrders]);

    // When rider is on a tab, treat current items as seen.
    useEffect(() => {
        acknowledgeTab(activeTab);
    }, [activeTab, pendingDeliveries, pendingFoodInvites, activeOrders]);

    // Also acknowledge after list data is loaded for the active tab.
    useEffect(() => {
        if (!loading) acknowledgeTab(activeTab);
    }, [loading, activeTab, requests.length, invites.length]);

    const getTitle = () => {
        switch (activeTab) {
            case 'active': return 'My Active Jobs';
            case 'history': return 'Order History';
            case 'orders': return 'Incoming Requests';
            default: return 'New Requests';
        }
    };

    const getTabBadgeCount = (tabKey: 'logistics' | 'active' | 'orders' | 'history') => {
        const raw = getRawTabCount(tabKey);
        const seen = seenCounts[tabKey] || 0;
        return Math.max(0, raw - seen);
    };

    const latestBidByRequest = useMemo(() => {
        const map: Record<string, any> = {};
        for (const bid of myBids) {
            if (!bid?.request_id) continue;
            const existing = map[bid.request_id];
            if (!existing) {
                map[bid.request_id] = bid;
                continue;
            }
            const existingTime = new Date(existing.created_at || 0).getTime();
            const currentTime = new Date(bid.created_at || 0).getTime();
            if (currentTime > existingTime) {
                map[bid.request_id] = bid;
            }
        }
        return map;
    }, [myBids]);


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
        return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) + ' - ' + date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    };

    const hasPreviewCoordinates = (item: any) => {
        const hasPickup = Number.isFinite(Number(item?.pickup_latitude)) && Number.isFinite(Number(item?.pickup_longitude));
        const hasDropoff = Number.isFinite(Number(item?.dropoff_latitude)) && Number.isFinite(Number(item?.dropoff_longitude));
        return hasPickup && hasDropoff;
    };

    const renderMarketRequestCard = (item: any, showActions: boolean) => {
        const myBid = latestBidByRequest[item.id];
        const card = (
            <DeliveryRequestCard
                request={item}
                onBid={handleBid}
                onAccept={(id, amt) => item.rider_id === user?.id ? handleAcceptDirectRequest(id) : handleBid(id, amt)}
                myBid={myBid}
                showActions={showActions}
            />
        );

        if (item?.status !== 'pending' || !hasPreviewCoordinates(item)) {
            return card;
        }

        return (
            <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => router.push(`/rider/request-preview/${item.id}` as any)}
            >
                {card}
            </TouchableOpacity>
        );
    };

    const renderActiveJobCard = ({ item }: { item: any }) => {
        const isFoodOrder = item.type === 'food' || item.type === 'store';
        const isStoreOrder = item.type === 'store';
        const navRoute = `/rider/delivery/${item.id}`;
        const timeAgo = getTimeAgo(item.created_at);
        const isStale = (new Date().getTime() - new Date(item.created_at).getTime()) > 86400000; // older than 24h
        const isReadyForPickup = item.status === 'accepted' || item.status === 'ready';
        const isPickedUp = item.status === 'picked_up' || item.status === 'with_rider';
        const isOutForDelivery = item.status === 'out_for_delivery';
        const activeLabel = isReadyForPickup
            ? 'Ready for Pickup'
            : isOutForDelivery
                ? 'Out for Delivery'
                : isPickedUp
                    ? 'Picked Up'
                    : 'In Progress';

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: cardBg, borderLeftWidth: isStale ? 3 : 0, borderLeftColor: '#EF4444' }]}
                onPress={() => router.push(navRoute as any)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.row, { flex: 1 }]}>
                        <View style={[styles.iconBox, { backgroundColor: item.request_type === 'ride' ? 'rgba(33, 150, 243, 0.1)' : isStoreOrder ? 'rgba(139, 92, 246, 0.1)' : isFoodOrder ? 'rgba(242, 124, 34, 0.1)' : 'rgba(76, 175, 80, 0.1)' }]}>
                            <Ionicons name={item.request_type === 'ride' ? 'person' : isStoreOrder ? 'storefront' : isFoodOrder ? 'restaurant' : 'cube'} size={20} color={item.request_type === 'ride' ? '#2196F3' : isStoreOrder ? '#8B5CF6' : isFoodOrder ? '#F27C22' : '#4CAF50'} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <ThemedText style={styles.restaurantName}>
                                {item.request_type === 'ride' ? 'Passenger Ride' : (item.restaurant_name || 'Delivery')}
                            </ThemedText>
                            <ThemedText style={styles.timestamp}>
                                {item.pickup_address || 'Pickup Location'}
                            </ThemedText>
                        </View>
                    </View>
                    <View style={[styles.activeStatusBadge, {
                        backgroundColor: isReadyForPickup ? '#FFF3E0' : '#e8f5e9'
                    }]}>
                        <ThemedText style={[styles.activeStatusText, {
                            color: isReadyForPickup ? '#F27C22' : '#4CAF50'
                        }]}>
                            {activeLabel}
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
                            Delivery Fee: <ThemedText style={{ fontWeight: 'bold', color: '#F27C22' }}>NGN {(item.final_price ?? item.delivery_fee ?? 0).toLocaleString()}</ThemedText>
                        </ThemedText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <ThemedText style={{ color: '#F27C22', fontSize: 13, fontWeight: '600' }}>View Details</ThemedText>
                        <Ionicons name="chevron-forward" size={16} color="#F27C22" />
                    </View>
                </View>

                {/* Pickup Code */}
                {isFoodOrder && (item.pickup_code || item.delivery_code) && (
                    <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd' }}>
                        <ThemedText style={{ textAlign: 'center', fontSize: 12, color: '#0369a1', marginBottom: 4 }}>
                            SECURE HANDOFF CODE
                        </ThemedText>
                        <ThemedText style={{ textAlign: 'center', fontSize: 24, fontWeight: 'bold', color: '#0284c7', letterSpacing: 4 }}>
                            {item.pickup_code || item.delivery_code}
                        </ThemedText>
                        <ThemedText style={{ textAlign: 'center', fontSize: 10, color: '#0369a1', marginTop: 4 }}>
                            Show this code at pickup
                        </ThemedText>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderInviteCard = ({ item }: { item: any }) => {
        const order = item.order;

        if (!order) {
            return null;
        }

        const isStore = item.order_source === 'store';
        const source = isStore ? order?.store : order?.restaurant;
        const sourceName = source?.name || (isStore ? 'Store' : 'Restaurant');
        const isProcessing = processing === order.id;
        const countdown = countdowns[item.id];
        const isExpired = item.status === 'expired' || (countdown !== undefined && countdown <= 0);

        const iconName = isStore ? 'storefront' : 'restaurant';
        const accentColor = isStore ? '#8B5CF6' : '#F27C22';

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: cardBg, borderLeftWidth: isExpired ? 3 : 0, borderLeftColor: '#EF4444' }]}
                onPress={() => {
                    if (!isExpired) {
                        router.push(`/rider/job-preview/${order.id}?amount=${item.amount}`);
                    }
                }}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.row}>
                        <View style={[styles.iconBox, { backgroundColor: `${accentColor}15` }]}>
                            <Ionicons name={iconName as any} size={20} color={isExpired ? '#EF4444' : accentColor} />
                        </View>
                        <View>
                            <ThemedText style={styles.restaurantName}>{sourceName}</ThemedText>
                            <ThemedText style={styles.timestamp}>{new Date(item.created_at).toLocaleTimeString()}</ThemedText>
                        </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <ThemedText style={styles.price}>NGN {Number(item.amount || 0).toLocaleString()}</ThemedText>
                        {!isExpired && countdown !== undefined && countdown > 0 && (
                            <View style={{ backgroundColor: countdown <= 5 ? '#FEE2E2' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 }}>
                                <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: countdown <= 5 ? '#EF4444' : '#D97706' }}>
                                    {countdown}s left
                                </ThemedText>
                            </View>
                        )}
                    </View>
                </View>

                {isExpired && (
                    <View style={{ backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginTop: 8 }}>
                        <ThemedText style={{ color: '#EF4444', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                            Expired - You did not respond in time
                        </ThemedText>
                    </View>
                )}

                <View style={styles.divider} />

                <View style={styles.locationRow}>
                    <Ionicons name="location" size={16} color={subtleColor} />
                    <ThemedText style={styles.addressText} numberOfLines={1}>
                        {source?.address || 'Pickup Location'}
                    </ThemedText>
                </View>

                {!isExpired && (
                    <>
                        {/* View Details Prompt */}
                        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                            <ThemedText style={{ color: '#F27C22', fontSize: 13, fontWeight: '600' }}>
                                Tap to view distance, ETA and map
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
                    </>
                )}
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
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ width: '100%' }}
                    contentContainerStyle={{ flexDirection: 'row', gap: 10, paddingRight: 12 }}
                >
                    {(['logistics', 'active', 'orders', 'history'] as const).map((t) => (
                        <TouchableOpacity
                            key={t}
                            style={[styles.tab, activeTab === t && styles.activeTab]}
                            onPress={() => {
                                setActiveTab(t);
                                acknowledgeTab(t);
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <ThemedText style={[styles.tabText, activeTab === t && styles.activeTabText]}>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </ThemedText>
                                {getTabBadgeCount(t) > 0 && (
                                    <View style={[styles.tabBadge, activeTab === t && styles.tabBadgeActive]}>
                                        <ThemedText style={[styles.tabBadgeText, activeTab === t && styles.tabBadgeTextActive]}>
                                            {getTabBadgeCount(t)}
                                        </ThemedText>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <LottieLoader size={120} />
                </View>
            ) : (
                <FlatList
                    data={activeTab === 'orders' ? invites : requests}
                    keyExtractor={(item) => activeTab === 'orders' ? `${item.feed_type || 'request'}-${item.id}` : item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => {
                        if (activeTab === 'orders') {
                            if (item.feed_type === 'vendor_invite') return renderInviteCard({ item });
                            return renderMarketRequestCard(item, item.status === 'pending');
                        }
                        if (activeTab === 'active') return renderActiveJobCard({ item });
                        return renderMarketRequestCard(item, activeTab === 'logistics');
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
    tabBadge: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F27C22',
    },
    tabBadgeActive: {
        backgroundColor: '#fff',
    },
    tabBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    tabBadgeTextActive: {
        color: '#F27C22',
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
