import FoodLoader from '@/components/FoodLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

type TabType = 'All' | 'Unread';

export default function MessagesScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { openMenu } = useRestaurantMenu();
    const iconColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const bgColor = useThemeColor({ light: '#F4F5F9', dark: '#0A0A0F' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1A1A22' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const mutedText = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');
    const borderColor = useThemeColor({ light: 'rgba(0,0,0,0.06)', dark: 'rgba(255,255,255,0.08)' }, 'text');
    const isDark = bgColor === '#0A0A0F';

    const [activeTab, setActiveTab] = useState<TabType>('All');
    const [chats, setChats] = useState<any[]>([]);
    const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);

    const accent = '#F27C22';

    useFocusEffect(
        useCallback(() => {
            fetchChats();
        }, [user])
    );

    // Real-time subscription: refresh chat list when new messages arrive
    useEffect(() => {
        if (!restaurantId) return;

        const channel = supabase
            .channel('restaurant-messages-page')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'order_chat_messages',
            }, () => {
                fetchChats();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'order_chat_messages',
            }, () => {
                fetchChats();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'order_chats',
            }, () => {
                fetchChats();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [restaurantId]);

    const fetchChats = async () => {
        if (!user?.id) return;
        try {
            // 1. Get restaurant ID for the current owner
            const { data: rest } = await supabase
                .from('restaurants')
                .select('id')
                .eq('owner_id', user.id)
                .single();

            if (!rest) {
                setLoading(false);
                setRefreshing(false);
                return;
            }
            setRestaurantId(rest.id);

            // 2. Fetch all order chats for this restaurant
            const { data: chatData, error } = await supabase
                .from('order_chats')
                .select(`
                    *,
                    order:orders(
                        id, status, total_amount, created_at, rider_id
                    )
                `)
                .eq('restaurant_id', rest.id)
                .order('last_message_at', { ascending: false });

            if (error) throw error;

            // 3. Fetch customer profiles separately (FK is to auth.users, not profiles)
            if (chatData && chatData.length > 0) {
                const customerIds = [...new Set(chatData.map(c => c.customer_id).filter(Boolean))];
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name, profile_picture_url')
                    .in('id', customerIds);

                const profileMap: Record<string, any> = {};
                profiles?.forEach(p => { profileMap[p.id] = p; });

                // 3b. Fetch rider profiles
                const riderIds = [...new Set(chatData.map(c => c.order?.rider_id).filter(Boolean))];
                let riderMap: Record<string, any> = {};
                if (riderIds.length > 0) {
                    const { data: riders } = await supabase
                        .from('profiles')
                        .select('id, first_name, last_name, profile_picture_url')
                        .in('id', riderIds);
                    riders?.forEach(p => { riderMap[p.id] = p; });
                }

                // Attach profiles to chats
                chatData.forEach(chat => {
                    chat.customer = profileMap[chat.customer_id] || null;
                    if (chat.order?.rider_id) {
                        chat.rider = riderMap[chat.order.rider_id] || null;
                    }
                });

                // 4. Fetch unread counts per chat
                const chatIds = chatData.map(c => c.id);
                const { data: unreadMsgs } = await supabase
                    .from('order_chat_messages')
                    .select('chat_id')
                    .in('chat_id', chatIds)
                    .eq('is_read', false)
                    .neq('sender_id', user.id);

                const counts: Record<string, number> = {};
                unreadMsgs?.forEach((m: any) => {
                    counts[m.chat_id] = (counts[m.chat_id] || 0) + 1;
                });
                setUnreadMap(counts);
            } else {
                setUnreadMap({});
            }

            setChats(chatData || []);
        } catch (error) {
            console.error('Error fetching chats:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getFilteredChats = () => {
        if (activeTab === 'Unread') {
            return chats.filter(c => unreadMap[c.id]);
        }
        return chats;
    };

    const formatTime = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const getOrderStatusColor = (status: string) => {
        switch (status) {
            case 'received': return '#f59e0b';
            case 'preparing': return '#3b82f6';
            case 'ready': return '#22c55e';
            case 'with_rider': return '#8b5cf6';
            case 'out_for_delivery': return '#06b6d4';
            case 'delivered': return '#22c55e';
            case 'cancelled': return '#ef4444';
            default: return mutedText;
        }
    };

    const renderChatItem = ({ item }: { item: any }) => {
        const isRiderChat = item.chat_type === 'rider_restaurant';

        const customerName = isRiderChat
            ? (item.rider ? `${item.rider.first_name || ''} ${item.rider.last_name || ''}`.trim() : 'Rider')
            : (item.customer ? `${item.customer.first_name || ''} ${item.customer.last_name || ''}`.trim() : 'Customer');

        const avatar = isRiderChat ? item.rider?.profile_picture_url : item.customer?.profile_picture_url;
        const unreadCount = unreadMap[item.id] || 0;
        const lastMsg = item.last_message || 'No messages yet';
        const orderStatus = item.order?.status || '';

        return (
            <TouchableOpacity
                style={[styles.chatRow, { backgroundColor: cardBg, borderBottomColor: borderColor }]}
                onPress={() => router.push(`/order-chat/${item.id}`)}
                activeOpacity={0.7}
            >
                {/* Avatar */}
                <View style={[styles.avatarContainer, unreadCount > 0 && styles.avatarUnreadRing]}>
                    {avatar ? (
                        <Image source={{ uri: avatar }} style={styles.avatarImage} />
                    ) : (
                        <View style={[styles.avatarFallback, { backgroundColor: (isRiderChat ? '#1F2050' : accent) + '20' }]}>
                            <Ionicons name={isRiderChat ? "bicycle" : "person"} size={22} color={isRiderChat ? '#1F2050' : accent} />
                        </View>
                    )}
                </View>

                {/* Content */}
                <View style={styles.chatContent}>
                    <View style={styles.chatTopRow}>
                        <ThemedText style={[styles.nameText, { color: textColor }]} numberOfLines={1}>
                            {customerName}
                        </ThemedText>
                        <ThemedText style={[styles.timeText, { color: unreadCount > 0 ? accent : mutedText }]}>
                            {formatTime(item.last_message_at)}
                        </ThemedText>
                    </View>

                    <View style={styles.chatBottomRow}>
                        <ThemedText
                            style={[
                                styles.lastMsgText,
                                { color: unreadCount > 0 ? textColor : mutedText, fontWeight: unreadCount > 0 ? '600' : '400' }
                            ]}
                            numberOfLines={1}
                        >
                            {lastMsg}
                        </ThemedText>
                        {unreadCount > 0 && (
                            <View style={[styles.unreadBadge, { backgroundColor: accent }]}>
                                <ThemedText style={styles.unreadText}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </ThemedText>
                            </View>
                        )}
                    </View>

                    {/* Order Reference */}
                    <View style={styles.orderRefRow}>
                        <View style={[styles.orderStatusDot, { backgroundColor: getOrderStatusColor(orderStatus) }]} />
                        <ThemedText style={[styles.orderRefText, { color: mutedText }]} numberOfLines={1}>
                            Order #{item.order?.id?.slice(0, 8)} · {orderStatus?.replace('_', ' ')} {isRiderChat ? '(Rider)' : ''}
                        </ThemedText>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const displayedChats = getFilteredChats();
    const totalUnread = Object.values(unreadMap).reduce((sum, v) => sum + v, 0);

    if (loading) {
        return <FoodLoader message="Loading messages..." />;
    }

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={openMenu} style={styles.menuBtn}>
                    <Ionicons name="menu" size={26} color={iconColor} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, { color: textColor }]}>Messages</ThemedText>
                <View style={{ width: 40 }} />
            </View>

            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'All' && [styles.tabActive, { borderBottomColor: accent }]]}
                    onPress={() => setActiveTab('All')}
                >
                    <ThemedText style={[
                        styles.tabText,
                        { color: activeTab === 'All' ? accent : mutedText }
                    ]}>
                        All ({chats.length})
                    </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'Unread' && [styles.tabActive, { borderBottomColor: accent }]]}
                    onPress={() => setActiveTab('Unread')}
                >
                    <ThemedText style={[
                        styles.tabText,
                        { color: activeTab === 'Unread' ? accent : mutedText }
                    ]}>
                        Unread {totalUnread > 0 && `(${totalUnread})`}
                    </ThemedText>
                </TouchableOpacity>
            </View>

            {/* Chat List */}
            <FlatList
                data={displayedChats}
                renderItem={renderChatItem}
                keyExtractor={item => item.id}
                contentContainerStyle={displayedChats.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchChats(); }}
                        colors={[accent]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <View style={[styles.emptyIconBg, { backgroundColor: accent + '15' }]}>
                            <Ionicons name="chatbubbles-outline" size={48} color={accent} />
                        </View>
                        <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
                            {activeTab === 'Unread' ? 'All caught up!' : 'No messages yet'}
                        </ThemedText>
                        <ThemedText style={[styles.emptySubtitle, { color: mutedText }]}>
                            {activeTab === 'Unread'
                                ? 'You have no unread messages'
                                : 'When customers message you about their orders, they\'ll appear here'
                            }
                        </ThemedText>
                    </View>
                }
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    menuBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
    },

    // Tabs
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    tab: {
        paddingVertical: 14,
        paddingHorizontal: 4,
        marginRight: 28,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomWidth: 2,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
    },

    // Chat Row
    chatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },

    // Avatar
    avatarContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        marginRight: 14,
        overflow: 'hidden',
    },
    avatarUnreadRing: {
        borderWidth: 2,
        borderColor: '#F27C22',
        padding: 2,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 26,
    },
    avatarFallback: {
        width: '100%',
        height: '100%',
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Content
    chatContent: {
        flex: 1,
    },
    chatTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 3,
    },
    nameText: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    timeText: {
        fontSize: 12,
    },
    chatBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    lastMsgText: {
        fontSize: 14,
        flex: 1,
        marginRight: 8,
    },
    unreadBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },

    // Order Reference
    orderRefRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    orderStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    orderRefText: {
        fontSize: 11,
    },

    // Empty State
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyIconBg: {
        width: 90,
        height: 90,
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});
