import RiderLoader from '@/components/RiderLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useRiderNotifications } from '@/contexts/rider-notifications';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

type TabType = 'Inbox' | 'Unread' | 'Calls';

// Unified Interface for both Chat Types
interface UnifiedChat {
    id: string;
    type: 'delivery' | 'food_customer' | 'food_restaurant';
    title: string;
    subtitle: string; // Last message or status
    avatar_url: string | null;
    last_message_at: string;
    is_verified: boolean;
    unread_count: number;
    metadata?: any; // Extra data like order_id for debugging
}

export default function RiderMessagesScreen() {
    const router = useRouter();
    const { session } = useAuth();
    const { openMenu } = useRiderMenu();
    const { refreshNotifications } = useRiderNotifications();

    // UI State
    const [activeTab, setActiveTab] = useState<TabType>('Inbox');

    // Data State
    const [chats, setChats] = useState<UnifiedChat[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Theme (Locked to design specs mostly, but respectful of dark mode where possible)
    const bgColor = useThemeColor({ light: '#FFFFFF', dark: '#0D0D0D' }, 'background');
    const isDark = bgColor === '#0D0D0D';

    // Exact colors from JSON
    const navBlue = '#1F2050'; // For Messages Title
    const tabText = isDark ? '#FFFFFF' : '#1B1B1B'; // 'Inbox' color
    const dividerColor = 'rgba(242, 124, 34, 0.5)'; // Vector 162

    // Typography
    const fontTitle = 'Montserrat_600SemiBold';
    const fontBodyReg = 'OpenSans_400Regular';

    useFocusEffect(
        useCallback(() => {
            fetchChats();
            refreshNotifications();
        }, [])
    );

    const fetchChats = async () => {
        if (!session?.user.id) return;
        try {
            // --- 1. Fetch Delivery Chats (Logistics) ---
            const deliveryQuery = supabase
                .from('chats')
                .select(`
                    *,
                    user:profiles!user_id(
                        first_name, last_name, profile_picture_url
                    ),
                    request:delivery_requests(
                        status, item_description
                    )
                `)
                .eq('rider_id', session.user.id);

            // --- 2. Fetch Food Order Chats ---
            // Riders can see 'rider_customer' and 'rider_restaurant' chats for assigned orders.
            const foodQuery = supabase
                .from('order_chats')
                .select(`
                    *,
                    order:orders!inner(id, status, rider_id),
                    customer:profiles!customer_id(first_name, last_name, profile_picture_url),
                    restaurant:restaurants(name, logo_url)
                `)
                .in('chat_type', ['rider_customer', 'rider_restaurant']); // Explicitly fetch only rider chats

            // Execute in parallel
            const [deliveryRes, foodRes] = await Promise.all([
                deliveryQuery,
                foodQuery
            ]);

            if (deliveryRes.error) throw deliveryRes.error;
            if (foodRes.error) throw foodRes.error;

            // --- 3. Fetch Unread Counts ---
            // We need to check both message tables
            const deliveryChatIds = (deliveryRes.data || []).map(c => c.id);
            const foodChatIds = (foodRes.data || []).map(c => c.id);

            let unreadCounts: Record<string, number> = {};

            if (deliveryChatIds.length > 0) {
                const { data: unreadDelivery } = await supabase
                    .from('messages')
                    .select('chat_id')
                    .in('chat_id', deliveryChatIds)
                    .eq('is_read', false)
                    .neq('sender_id', session.user.id);

                unreadDelivery?.forEach((m: any) => {
                    unreadCounts[m.chat_id] = (unreadCounts[m.chat_id] || 0) + 1;
                });
            }

            if (foodChatIds.length > 0) {
                const { data: unreadFood } = await supabase
                    .from('order_chat_messages')
                    .select('chat_id')
                    .in('chat_id', foodChatIds)
                    .eq('is_read', false)
                    .neq('sender_id', session.user.id);

                unreadFood?.forEach((m: any) => {
                    unreadCounts[m.chat_id] = (unreadCounts[m.chat_id] || 0) + 1;
                });
            }

            // --- 4. Normalize & Merge ---
            const unified: UnifiedChat[] = [];

            // Normalize Delivery Chats
            deliveryRes.data?.forEach((chat: any) => {
                const userName = chat.user ? `${chat.user.first_name} ${chat.user.last_name}`.trim() : 'Customer';
                unified.push({
                    id: chat.id,
                    type: 'delivery',
                    title: userName || 'Customer',
                    subtitle: chat.last_message || 'Start a conversation...',
                    avatar_url: chat.user?.profile_picture_url,
                    last_message_at: chat.last_message_at,
                    is_verified: chat.user?.is_verified || userName === 'Quible Services',
                    unread_count: unreadCounts[chat.id] || 0
                });
            });

            // Normalize Food Chats
            foodRes.data?.forEach((chat: any) => {
                // Determine Title & Avatar based on chat type
                let title = 'Chat';
                let avatar = null;
                let is_verified = false;

                if (chat.chat_type === 'rider_customer') {
                    title = chat.customer ? `${chat.customer.first_name} ${chat.customer.last_name}`.trim() : 'Customer';
                    avatar = chat.customer?.profile_picture_url;
                } else if (chat.chat_type === 'rider_restaurant') {
                    title = chat.restaurant?.name || 'Restaurant';
                    avatar = chat.restaurant?.logo_url;
                    is_verified = true; // Restaurants are implicitly verified/official
                }

                unified.push({
                    id: chat.id,
                    type: chat.chat_type === 'rider_restaurant' ? 'food_restaurant' : 'food_customer',
                    title: title,
                    subtitle: chat.last_message || 'Order Chat',
                    avatar_url: avatar,
                    last_message_at: chat.last_message_at,
                    is_verified: is_verified,
                    unread_count: unreadCounts[chat.id] || 0
                });
            });

            // Sort by most recent message
            unified.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

            setChats(unified);

        } catch (error) {
            console.error("Error fetching chats:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Filter Logic
    const getFilteredChats = () => {
        if (activeTab === 'Unread') {
            return chats.filter(c => c.unread_count > 0);
        }
        if (activeTab === 'Calls') {
            return []; // Placeholder
        }
        return chats; // Inbox
    };

    const formatTime = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const handleChatPress = (item: UnifiedChat) => {
        if (item.type === 'delivery') {
            router.push(`/chat/${item.id}`);
        } else {
            // Food Order Chat
            router.push(`/order-chat/${item.id}`);
        }
    };

    const renderChatItem = ({ item }: { item: UnifiedChat }) => {
        const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=F27C22&color=fff`;

        return (
            <TouchableOpacity
                style={styles.chatRow}
                onPress={() => handleChatPress(item)}
                activeOpacity={0.7}
            >
                {/* Avatar with Ring if Unread */}
                <View style={[styles.avatarContainer, item.unread_count > 0 && styles.avatarUnreadRing]}>
                    <View style={styles.avatarInner}>
                        <Image source={{ uri: item.avatar_url || fallbackAvatar }} style={styles.avatarImage} />
                    </View>
                    {item.is_verified && (
                        <View style={styles.verifiedBadge}>
                            <MaterialIcons name="verified" size={14} color="#009A49" />
                        </View>
                    )}
                </View>

                {/* Content */}
                <View style={styles.contentContainer}>
                    <View style={styles.rowHeader}>
                        <ThemedText style={[styles.nameText, { color: isDark ? '#FFF' : '#000' }]} numberOfLines={1}>
                            {item.title}
                        </ThemedText>
                        <ThemedText style={[styles.timeText, { color: isDark ? '#AAA' : '#000' }]}>
                            {formatTime(item.last_message_at)}
                        </ThemedText>
                    </View>

                    <View style={styles.rowFooter}>
                        <ThemedText
                            style={[
                                styles.msgText,
                                {
                                    color: isDark ? '#CCC' : '#000',
                                    opacity: item.unread_count > 0 ? 1 : 0.8,
                                    fontWeight: item.unread_count > 0 ? '600' : '400'
                                }
                            ]}
                            numberOfLines={1}
                        >
                            {item.subtitle}
                        </ThemedText>

                        {item.type !== 'delivery' && (
                            <View style={{ marginRight: 6, backgroundColor: item.type === 'food_restaurant' ? '#eab308' : '#3b82f6', borderRadius: 4, paddingHorizontal: 4 }}>
                                <ThemedText style={{ fontSize: 9, color: '#fff', fontWeight: 'bold' }}>
                                    {item.type === 'food_restaurant' ? 'REST' : 'CUST'}
                                </ThemedText>
                            </View>
                        )}

                        {item.unread_count > 0 && (
                            <View style={styles.unreadCountBadge}>
                                <ThemedText style={styles.unreadCountText}>
                                    {item.unread_count > 9 ? '9+' : item.unread_count}
                                </ThemedText>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) return <RiderLoader message="Loading conversations..." />;

    const displayedChats = getFilteredChats();
    const totalUnreadCount = chats.reduce((acc, curr) => acc + curr.unread_count, 0);

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>

            {/* Header Area */}
            <View style={styles.headerArea}>
                {/* Title Row */}
                <View style={styles.titleRow}>
                    <TouchableOpacity onPress={openMenu} style={{ marginRight: 16 }}>
                        <Ionicons name="menu" size={28} color={navBlue} />
                    </TouchableOpacity>
                    <ThemedText style={[styles.pageTitle, { color: navBlue }]}>Messages</ThemedText>
                    <View style={{ flex: 1 }} />
                </View>

                {/* Tabs */}
                <View style={styles.tabBar}>
                    <TouchableOpacity onPress={() => setActiveTab('Inbox')} style={styles.tabItem}>
                        <ThemedText style={[
                            styles.tabText,
                            { color: tabText, opacity: activeTab === 'Inbox' ? 1 : 0.6 }
                        ]}>
                            Inbox
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setActiveTab('Unread')} style={styles.tabItem}>
                        <ThemedText style={[
                            styles.tabText,
                            { color: tabText, opacity: activeTab === 'Unread' ? 1 : 0.6 }
                        ]}>
                            Unread {totalUnreadCount > 0 && `(${totalUnreadCount})`}
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setActiveTab('Calls')} style={styles.tabItem}>
                        <ThemedText style={[
                            styles.tabText,
                            { color: tabText, opacity: activeTab === 'Calls' ? 1 : 0.6 }
                        ]}>
                            Calls
                        </ThemedText>
                    </TouchableOpacity>
                </View>

                {/* Divider Line */}
                <View style={[styles.divider, { borderColor: dividerColor }]} />
            </View>

            {/* List */}
            <FlatList
                data={displayedChats}
                renderItem={renderChatItem}
                keyExtractor={item => `${item.type}_${item.id}`} // Ensure unique key
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChats(); }} colors={['#F27C22']} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <ThemedText style={{ color: '#888', fontFamily: fontBodyReg }}>
                            {activeTab === 'Calls' ? 'No recent calls' : 'No active conversations'}
                        </ThemedText>
                        <ThemedText style={{ color: '#aaa', fontSize: 12, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
                            Chats will appear here when you have active orders or support tickets.
                        </ThemedText>
                    </View>
                }
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    headerArea: {
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 0,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    pageTitle: {
        fontSize: 25,
        fontFamily: 'Montserrat_600SemiBold',
    },

    // Tabs
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 32, // Spacing between tabs
        marginBottom: 16,
    },
    tabItem: {
        paddingVertical: 4,
    },
    tabText: {
        fontSize: 18,
        fontFamily: 'Montserrat_600SemiBold',
    },
    divider: {
        borderBottomWidth: 3,
        opacity: 0.5,
        width: width + 10, // Extend slightly beyond
        marginLeft: -20, // Negative margin to bleed
    },

    // List
    listContent: {
        paddingVertical: 20,
    },

    // Chat Row Match JSON Frame 774/776
    chatRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        width: '100%',
    },

    // Avatar
    avatarContainer: {
        width: 61,
        height: 59,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        marginRight: 12,
    },
    avatarUnreadRing: {
        // Frame 771 from JSON (approx)
        borderWidth: 1.5,
        borderColor: 'rgba(242, 124, 34, 0.6)',
        borderRadius: 34,
        width: 63,
        height: 63,
    },
    avatarInner: {
        // Frame 770
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 10,
    },

    // Content
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    rowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    nameText: {
        fontSize: 18,
        fontFamily: 'OpenSans_600SemiBold',
    },
    timeText: {
        fontSize: 16,
        fontFamily: 'OpenSans_400Regular',
        opacity: 0.5,
    },
    rowFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    msgText: {
        fontSize: 16,
        fontFamily: 'OpenSans_400Regular',
        flex: 1,
        marginRight: 8,
    },
    unreadCountBadge: {
        // Frame 773
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#000', // From JSON (Ellipse 51)
        justifyContent: 'center',
        alignItems: 'center',
    },
    unreadCountText: {
        color: '#FFF',
        fontSize: 12,
        fontFamily: 'OpenSans_400Regular',
    },

    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
});
