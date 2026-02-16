import LogoLoader from '@/components/LogoLoader';
import NotificationItem from '@/components/NotificationItem';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Stack } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const FILTERS = ['All', 'Wallet', 'Order', 'Chat', 'Delivery', 'System'];

export default function NotificationsScreen() {
    const { user, isReady } = useAuth();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('All');

    const activeTabBg = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const activeTabText = useThemeColor({ light: '#fff', dark: '#000' }, 'background');
    const inactiveTabBg = useThemeColor({ light: '#eee', dark: '#333' }, 'background');
    const inactiveTabText = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');

    const fetchNotifications = async () => {
        if (!isReady) return;

        if (!user) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (isReady) {
            fetchNotifications();
        }

        // Realtime subscription for instant notifications
        if (!user) return;
        const channel = supabase
            .channel('user-notifications-realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                // Prepend the new notification at the top
                setNotifications(prev => [payload.new as any, ...prev]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, isReady]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    // Filter and Group Logic
    const filteredNotifications = useMemo(() => {
        if (activeFilter === 'All') return notifications;
        return notifications.filter(n => n.type.toLowerCase() === activeFilter.toLowerCase());
    }, [notifications, activeFilter]);

    const groupedNotifications = useMemo(() => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const groups: { title: string; data: any[] }[] = [
            { title: 'Today', data: [] },
            { title: 'Yesterday', data: [] },
            { title: 'Earlier', data: [] }
        ];

        filteredNotifications.forEach(item => {
            const itemDate = new Date(item.created_at);
            if (itemDate.toDateString() === today.toDateString()) {
                groups[0].data.push(item);
            } else if (itemDate.toDateString() === yesterday.toDateString()) {
                groups[1].data.push(item);
            } else {
                groups[2].data.push(item);
            }
        });

        return groups.filter(g => g.data.length > 0);
    }, [filteredNotifications]);

    if (loading && !refreshing) {
        return (
            <ThemedView style={styles.center}>
                <LogoLoader size={60} />
            </ThemedView>
        );
    }

    const renderSection = ({ item }: { item: { title: string; data: any[] } }) => (
        <View>
            <ThemedText style={styles.sectionHeader}>{item.title}</ThemedText>
            {item.data.map(n => (
                <NotificationItem
                    key={n.id}
                    id={n.id}
                    title={n.title}
                    message={n.message}
                    type={n.type}
                    isRead={n.is_read}
                    createdAt={n.created_at}
                    metaData={n.meta_data}
                />
            ))}
        </View>
    );

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerTitle: 'Notifications', headerShadowVisible: false }} />

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                    {FILTERS.map(filter => (
                        <TouchableOpacity
                            key={filter}
                            style={[
                                styles.filterChip,
                                { backgroundColor: activeFilter === filter ? activeTabBg : inactiveTabBg }
                            ]}
                            onPress={() => setActiveFilter(filter)}
                        >
                            <ThemedText style={[
                                styles.filterText,
                                { color: activeFilter === filter ? activeTabText : inactiveTabText }
                            ]}>
                                {filter}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {notifications.length === 0 ? (
                <View style={styles.center}>
                    <ThemedText>No notifications yet.</ThemedText>
                </View>
            ) : (
                <FlatList
                    data={groupedNotifications}
                    keyExtractor={(item) => item.title}
                    renderItem={renderSection}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterContainer: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        marginBottom: 8,
    },
    filterContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    filterText: {
        fontWeight: '600',
        fontSize: 14,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '700',
        opacity: 0.5,
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
        textTransform: 'uppercase',
    }
});
