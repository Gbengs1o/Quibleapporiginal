import { useAuth } from '@/contexts/auth';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface RestaurantProfile {
    id: string;
    owner_id: string;
    name: string;
    logo_url: string | null;
}

const RestaurantSidebar = (props: any) => {
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { closeMenu } = useRestaurantMenu();

    const isDark = theme === 'dark';
    const buttonBg = useThemeColor({ light: '#f3f3f3', dark: '#2c2c2e' }, 'background');
    const buttonText = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const iconActiveColor = '#f27c22';
    const iconInactiveColor = useThemeColor({ light: '#1f2050', dark: '#aaa' }, 'text');

    const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [pendingOrderCount, setPendingOrderCount] = useState(0);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);

    // Animation for badge pulse
    const badgeScale = useSharedValue(1);

    useEffect(() => {
        if (pendingOrderCount > 0 || unreadMessageCount > 0) {
            badgeScale.value = withRepeat(
                withSequence(
                    withTiming(1.2, { duration: 300 }),
                    withTiming(1, { duration: 300 })
                ),
                3,
                false
            );
        }
    }, [pendingOrderCount, unreadMessageCount]);

    const badgeAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: badgeScale.value }],
    }));

    useEffect(() => {
        if (user?.id) {
            fetchRestaurantProfile();
        }
    }, [user?.id]);

    useEffect(() => {
        if (!restaurant?.id) return;

        // Fetch initial pending order count
        fetchPendingOrders();
        fetchUnreadMessages();

        // Subscribe to new orders
        const subscription = supabase
            .channel('restaurant-orders-sidebar')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'orders',
                filter: `restaurant_id=eq.${restaurant.id}`
            }, () => {
                fetchPendingOrders();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `restaurant_id=eq.${restaurant.id}`
            }, () => {
                fetchPendingOrders();
            })
            .subscribe();

        // Subscribe to new chat messages
        const chatSub = supabase
            .channel('restaurant-messages-sidebar')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'order_chat_messages',
            }, () => {
                fetchUnreadMessages();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'order_chat_messages',
            }, () => {
                fetchUnreadMessages();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
            supabase.removeChannel(chatSub);
        };
    }, [restaurant?.id]);

    const fetchPendingOrders = async () => {
        if (!restaurant?.id) return;

        const { data, error } = await supabase
            .from('orders')
            .select('id', { count: 'exact' })
            .eq('restaurant_id', restaurant.id)
            .in('status', ['received', 'preparing']);

        if (!error && data) {
            setPendingOrderCount(data.length);
        }
    };

    const fetchUnreadMessages = async () => {
        if (!restaurant?.id || !user?.id) return;

        // Get all order chats for this restaurant
        const { data: chats } = await supabase
            .from('order_chats')
            .select('id')
            .eq('restaurant_id', restaurant.id);

        if (!chats || chats.length === 0) {
            setUnreadMessageCount(0);
            return;
        }

        const chatIds = chats.map(c => c.id);
        const { data: unread, error } = await supabase
            .from('order_chat_messages')
            .select('id', { count: 'exact' })
            .in('chat_id', chatIds)
            .eq('is_read', false)
            .neq('sender_id', user.id);

        if (!error && unread) {
            setUnreadMessageCount(unread.length);
        }
    };

    const fetchRestaurantProfile = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('restaurants')
                .select('id, owner_id, name, logo_url')
                .eq('owner_id', user?.id)
                .single();

            if (error) {
                console.error('Error fetching restaurant profile:', error);
                return;
            }

            if (data) {
                setRestaurant(data);
            }
        } catch (err) {
            console.error('Unexpected error:', err);
        } finally {
            setLoading(false);
        }
    };

    const menuItems = [
        { name: 'Dashboard', icon: 'home', type: 'Ionicons', route: '/restaurant/dashboard' },
        { name: 'Orders', icon: 'clipboard-list', type: 'FontAwesome5', route: '/restaurant/orders', hasBadge: true },
        { name: 'Menu Management', icon: 'restaurant-menu', type: 'MaterialIcons', route: '/restaurant/menu' },
        { name: 'Promotions', icon: 'pricetag', type: 'Ionicons', route: '/restaurant/promotions' },
        { name: 'Reviews', icon: 'star', type: 'Ionicons', route: '/restaurant/reviews' },
        { name: 'Messages', icon: 'chatbubble-ellipses', type: 'Ionicons', route: '/restaurant/messages', hasMessageBadge: true },
        { name: 'Profile & Settings', icon: 'person', type: 'Ionicons', route: '/restaurant/settings' },
        { name: 'Support & Help', icon: 'help-circle', type: 'Ionicons', route: '/restaurant/support' },
        { name: 'Analytics', icon: 'bar-chart', type: 'Ionicons', route: '/restaurant/analytics' },
    ];

    const handleNavigate = (route: string) => {
        closeMenu();
        router.push(route);
    };

    const renderIcon = (item: typeof menuItems[0], isActive: boolean) => {
        const color = isActive ? iconActiveColor : iconInactiveColor;
        if (item.type === 'Ionicons') return <Ionicons name={item.icon as any} size={24} color={color} />;
        if (item.type === 'MaterialIcons') return <MaterialIcons name={item.icon as any} size={24} color={color} />;
        if (item.type === 'FontAwesome5') return <FontAwesome5 name={item.icon as any} size={22} color={color} />;
        return null;
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Profile Section */}
                    <View style={styles.profileSection}>
                        <View style={styles.avatarContainer}>
                            {loading ? (
                                <View style={styles.avatarPlaceholder}>
                                    <ActivityIndicator size="small" color="#fff" />
                                </View>
                            ) : restaurant?.logo_url && !imageError ? (
                                <Image
                                    source={{ uri: restaurant.logo_url }}
                                    style={styles.avatarImage}
                                    onError={() => setImageError(true)}
                                />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <ThemedText style={styles.avatarText}>
                                        {restaurant?.name?.[0]?.toUpperCase() || 'R'}
                                    </ThemedText>
                                </View>
                            )}
                        </View>
                        <View style={styles.profileInfo}>
                            <ThemedText style={styles.userName}>
                                {restaurant?.name || 'Loading...'}
                            </ThemedText>
                            <ThemedText style={styles.restaurantName}>
                                {loading ? 'Loading...' : 'Restaurant Dashboard'}
                            </ThemedText>
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: isDark ? '#333' : 'rgba(0,0,0,0.1)' }]} />

                    {/* Menu Items */}
                    <View style={styles.menuContainer}>
                        {menuItems.map((item, index) => {
                            const isActive = pathname === item.route;
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.menuItem,
                                        isActive && [styles.activeMenuItem, { backgroundColor: isDark ? 'rgba(242, 124, 34, 0.15)' : 'rgba(242, 124, 34, 0.1)' }]
                                    ]}
                                    onPress={() => handleNavigate(item.route)}
                                >
                                    <View style={styles.iconContainer}>
                                        {renderIcon(item, isActive)}
                                    </View>
                                    <ThemedText style={[styles.menuText, isActive && styles.activeMenuText]}>
                                        {item.name}
                                    </ThemedText>

                                    {/* Order Badge */}
                                    {item.hasBadge && pendingOrderCount > 0 && (
                                        <Animated.View style={[styles.orderBadge, badgeAnimatedStyle]}>
                                            <ThemedText style={styles.orderBadgeText}>
                                                {pendingOrderCount > 9 ? '9+' : pendingOrderCount}
                                            </ThemedText>
                                        </Animated.View>
                                    )}

                                    {/* Message Badge */}
                                    {item.hasMessageBadge && unreadMessageCount > 0 && (
                                        <Animated.View style={[styles.orderBadge, { backgroundColor: '#F27C22' }, badgeAnimatedStyle]}>
                                            <ThemedText style={styles.orderBadgeText}>
                                                {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                                            </ThemedText>
                                        </Animated.View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={[styles.divider, { backgroundColor: isDark ? '#333' : 'rgba(0,0,0,0.1)' }]} />

                    {/* Theme Toggle */}
                    <View style={styles.themeToggleContainer}>
                        <View style={styles.themeToggleContent}>
                            <Ionicons
                                name={theme === 'dark' ? 'moon' : 'sunny'}
                                size={20}
                                color={theme === 'dark' ? '#f27c22' : '#1f2050'}
                            />
                            <ThemedText style={styles.themeToggleText}>
                                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                            </ThemedText>
                        </View>
                        <Switch
                            value={theme === 'dark'}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#ccc', true: '#f27c22' }}
                            thumbColor={theme === 'dark' ? '#fff' : '#f4f4f4'}
                        />
                    </View>

                    <View style={[styles.divider, { backgroundColor: isDark ? '#333' : 'rgba(0,0,0,0.1)' }]} />

                    {/* Go to Marketplace */}
                    <TouchableOpacity
                        style={[styles.marketplaceButton, { backgroundColor: buttonBg }]}
                        onPress={() => router.replace('/')}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <ThemedText style={[styles.marketplaceText, { color: buttonText }]}>Go to</ThemedText>
                            <ThemedText style={[styles.marketplaceText, { color: '#f27c22', fontWeight: 'bold' }]}>QUIBLE</ThemedText>
                            <ThemedText style={[styles.marketplaceText, { color: buttonText }]}>Marketplace</ThemedText>
                        </View>
                    </TouchableOpacity>

                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    avatarContainer: {
        marginRight: 15,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f27c22',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f0f0f0',
    },
    avatarText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    profileInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    restaurantName: {
        fontSize: 14,
        opacity: 0.7,
    },
    divider: {
        height: 1,
        marginVertical: 20,
    },
    menuContainer: {
        gap: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    activeMenuItem: {
        borderRadius: 12,
    },
    iconContainer: {
        width: 32,
        alignItems: 'center',
        marginRight: 14,
    },
    menuText: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    activeMenuText: {
        color: '#f27c22',
        fontWeight: 'bold',
    },
    orderBadge: {
        backgroundColor: '#ef4444',
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    orderBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    marketplaceButton: {
        marginTop: 20,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center'
    },
    marketplaceText: {
        fontWeight: 'bold'
    },
    themeToggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
    },
    themeToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    themeToggleText: {
        fontSize: 16,
        fontWeight: '500',
    },
});

export default RestaurantSidebar;
