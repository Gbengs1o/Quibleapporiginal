import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
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
    const buttonBg = useThemeColor({ light: '#f3f3f3', dark: '#2c2c2e' }, 'background');
    const buttonText = useThemeColor({ light: '#000', dark: '#fff' }, 'text');

    const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        if (user?.id) {
            fetchRestaurantProfile();
        }
    }, [user?.id]);

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
        { name: 'Orders', icon: 'clipboard-list', type: 'FontAwesome5', route: '/restaurant/orders' },
        { name: 'Menu Management', icon: 'restaurant-menu', type: 'MaterialIcons', route: '/restaurant/menu' },
        { name: 'Payments and earning', icon: 'card', type: 'Ionicons', route: '/restaurant/payments' },
        { name: 'Promotions', icon: 'pricetag', type: 'Ionicons', route: '/restaurant/promotions' },
        { name: 'Reviews', icon: 'star', type: 'Ionicons', route: '/restaurant/reviews' },
        { name: 'Messages', icon: 'chatbubble-ellipses', type: 'Ionicons', route: '/restaurant/messages' },
        { name: 'Profile & Settings', icon: 'person', type: 'Ionicons', route: '/restaurant/settings' },
        { name: 'Support & Help', icon: 'help-circle', type: 'Ionicons', route: '/restaurant/support' },
        { name: 'Wallet', icon: 'wallet', type: 'Ionicons', route: '/restaurant/wallet' },
        { name: 'Analytics', icon: 'bar-chart', type: 'Ionicons', route: '/restaurant/analytics' },
    ];

    const handleNavigate = (route: string) => {
        router.push(route);
    };

    return (
        <ThemedView style={styles.container}>
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

                <View style={styles.divider} />

                {/* Menu Items */}
                <View style={styles.menuContainer}>
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.menuItem, pathname === item.route && styles.activeMenuItem]}
                            onPress={() => handleNavigate(item.route)}
                        >
                            <View style={styles.iconContainer}>
                                {item.type === 'Ionicons' && <Ionicons name={item.icon as any} size={24} color={pathname === item.route ? '#f27c22' : '#1f2050'} />}
                                {item.type === 'MaterialIcons' && <MaterialIcons name={item.icon as any} size={24} color={pathname === item.route ? '#f27c22' : '#1f2050'} />}
                                {item.type === 'FontAwesome5' && <FontAwesome5 name={item.icon as any} size={24} color={pathname === item.route ? '#f27c22' : '#1f2050'} />}
                            </View>
                            <ThemedText style={[styles.menuText, pathname === item.route && styles.activeMenuText]}>
                                {item.name}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.divider} />

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

                <View style={styles.divider} />

                {/* Go to Marketplace */}
                <TouchableOpacity
                    style={[styles.marketplaceButton, { backgroundColor: buttonBg }]}
                    onPress={() => router.push('/(tabs)')}
                >
                    <ThemedText style={[styles.marketplaceText, { color: buttonText }]}>Go to Marketplace</ThemedText>
                </TouchableOpacity>

            </ScrollView>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 50,
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
        backgroundColor: 'rgba(0,0,0,0.1)',
        marginVertical: 20,
    },
    menuContainer: {
        gap: 15,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    activeMenuItem: {
        // backgroundColor: 'rgba(242, 124, 34, 0.1)', // Optional highlight
        // borderRadius: 8,
    },
    iconContainer: {
        width: 30,
        alignItems: 'center',
        marginRight: 15,
    },
    menuText: {
        fontSize: 16,
        fontWeight: '500',
    },
    activeMenuText: {
        color: '#f27c22',
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
