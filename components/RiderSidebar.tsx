import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useRiderNotifications } from '@/contexts/rider-notifications';
import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface RiderProfile {
    id: string;
    user_id: string;
    rider_photo: string | null;
    status: string;
}

interface UserProfile {
    first_name: string;
    last_name: string;
    profile_picture_url: string | null;
}

const RiderSidebar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const { user, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { closeMenu } = useRiderMenu();
    const { unreadMessages, pendingDeliveries, pendingFoodInvites, unreadAlerts } = useRiderNotifications();

    const isDark = theme === 'dark';

    const textColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');
    const subtleText = useThemeColor({ light: '#666', dark: '#999' }, 'text');
    const borderColor = useThemeColor({ light: 'rgba(0,0,0,0.1)', dark: 'rgba(255,255,255,0.1)' }, 'background');
    const activeBg = '#F27C22';

    const [rider, setRider] = useState<RiderProfile | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            fetchData();
        }
    }, [user?.id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [riderRes, profileRes] = await Promise.all([
                supabase.from('riders').select('id, user_id, rider_photo, status').eq('user_id', user?.id).single(),
                supabase.from('profiles').select('first_name, last_name, profile_picture_url').eq('id', user?.id).single()
            ]);

            if (riderRes.data) setRider(riderRes.data);
            if (profileRes.data) setProfile(profileRes.data);
        } catch (err) {
            console.error('Error fetching rider data:', err);
        } finally {
            setLoading(false);
        }
    };

    const menuItems = [
        { name: 'Dashboard', icon: 'home-outline', activeIcon: 'home', route: '/rider/(dashboard)' },
        {
            name: 'Delivery Requests',
            icon: 'document-text-outline',
            activeIcon: 'document-text',
            route: '/rider/(dashboard)/deliveries',
            route: '/rider/(dashboard)/deliveries',
            badge: pendingDeliveries + pendingFoodInvites
        },
        {
            name: 'Messages',
            icon: 'chatbubbles-outline',
            activeIcon: 'chatbubbles',
            route: '/rider/(dashboard)/messages',
            badge: unreadMessages
        },
        { name: 'Payments and earning', icon: 'card-outline', activeIcon: 'card', route: '/rider/(dashboard)/payments' },
        { name: 'Wallet', icon: 'wallet-outline', activeIcon: 'wallet', route: '/rider/(dashboard)/wallet' },
        { name: 'Reviews', icon: 'star-outline', activeIcon: 'star', route: '/rider/(dashboard)/reviews' },
        { name: 'Profile & Settings', icon: 'person-outline', activeIcon: 'person', route: '/rider/(dashboard)/settings' },
        { name: 'Analytics', icon: 'bar-chart-outline', activeIcon: 'bar-chart', route: '/rider/(dashboard)/analytics' },
        { name: 'Support & Help', icon: 'headset-outline', activeIcon: 'headset', route: '/rider/(dashboard)/support' },
    ];

    const handleNavigate = (route: string) => {
        closeMenu();
        router.push(route);
    };

    const handleGoToMarketplace = () => {
        closeMenu();
        router.replace('/');
    };

    const handleSignOut = async () => {
        await signOut();
        closeMenu();
        router.replace('/');
    };

    const isActive = (route: string) => {
        if (route === '/rider/(dashboard)') {
            return pathname === '/rider/(dashboard)' || pathname === '/rider/(dashboard)/index';
        }
        return pathname.startsWith(route);
    };

    const displayName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Rider';
    const avatarUrl = rider?.rider_photo || profile?.profile_picture_url;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                    {/* Profile Header */}
                    <View style={styles.profileSection}>
                        {loading ? (
                            <View style={styles.loaderContainer}>
                                <LottieView
                                    source={{ uri: 'https://lottie.host/48f61870-2123-4747-9616-6f24a597eaa2/r4b8jStJoh.lottie' }}
                                    autoPlay
                                    loop
                                    style={{ width: 80, height: 80 }}
                                />
                            </View>
                        ) : (
                            <View style={styles.profileRow}>
                                <View style={styles.avatarContainer}>
                                    {avatarUrl ? (
                                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                                    ) : (
                                        <View style={[styles.avatarPlaceholder, { backgroundColor: activeBg }]}>
                                            <ThemedText style={styles.avatarText}>
                                                {displayName[0]?.toUpperCase() || 'R'}
                                            </ThemedText>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.profileInfo}>
                                    <ThemedText style={[styles.profileName, { color: textColor }]}>
                                        {displayName || 'Quible Rider'}
                                    </ThemedText>
                                    <ThemedText style={[styles.profileLabel, { color: textColor }]}>
                                        Quible Rider
                                    </ThemedText>
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={[styles.divider, { borderColor }]} />

                    {/* Menu Items */}
                    <View style={styles.menuContainer}>
                        {menuItems.map((item, index) => {
                            const active = isActive(item.route);
                            return (
                                <React.Fragment key={item.name}>
                                    <TouchableOpacity
                                        style={[
                                            styles.menuItem,
                                            active && { backgroundColor: activeBg }
                                        ]}
                                        onPress={() => handleNavigate(item.route)}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                            <Ionicons
                                                name={(active ? item.activeIcon : item.icon) as any}
                                                size={24}
                                                color={active ? '#fff' : textColor}
                                            />
                                            <ThemedText style={[
                                                styles.menuText,
                                                { color: active ? '#fff' : textColor }
                                            ]}>
                                                {item.name}
                                            </ThemedText>
                                        </View>

                                        {/* Global Badge */}
                                        {item.badge ? (
                                            <View style={[styles.menuBadge, { backgroundColor: active ? '#fff' : '#EF4444' }]}>
                                                <ThemedText style={[styles.menuBadgeText, { color: active ? activeBg : '#fff' }]}>
                                                    {item.badge}
                                                </ThemedText>
                                            </View>
                                        ) : null}

                                    </TouchableOpacity>
                                    {index < menuItems.length - 1 && (
                                        <View style={[styles.menuDivider, { borderColor }]} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </View>

                    <View style={[styles.divider, { borderColor }]} />

                    {/* Go to Marketplace */}
                    <TouchableOpacity style={styles.marketplaceRow} onPress={handleGoToMarketplace}>
                        <Ionicons name="storefront-outline" size={24} color={textColor} />
                        <View style={styles.marketplaceText}>
                            <ThemedText style={[styles.menuText, { color: textColor }]}>Go to </ThemedText>
                            <Image
                                source={require('@/assets/images/icon_v2.jpg')}
                                style={styles.quibleIcon}
                            />
                            <ThemedText style={[styles.quibleBrand, { color: activeBg }]}>UIBLE</ThemedText>
                            <ThemedText style={[styles.menuText, { color: textColor }]}> Marketplace</ThemedText>
                        </View>
                    </TouchableOpacity>

                    {/* Theme Toggle */}
                    <View style={styles.themeRow}>
                        <View style={styles.themeInfo}>
                            <Ionicons name={isDark ? 'moon' : 'sunny'} size={24} color={textColor} />
                            <ThemedText style={[styles.menuText, { color: textColor }]}>
                                {isDark ? 'Dark Mode' : 'Light Mode'}
                            </ThemedText>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#ccc', true: '#F27C22' }}
                            thumbColor="#fff"
                        />
                    </View>

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
        paddingHorizontal: 15,
        paddingBottom: 30,
    },
    profileSection: {
        paddingVertical: 20,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        marginRight: 12,
    },
    avatar: {
        width: 53,
        height: 53,
        borderRadius: 26.5,
        backgroundColor: '#f0f0f0',
    },
    avatarPlaceholder: {
        width: 53,
        height: 53,
        borderRadius: 26.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 21,
        fontWeight: '600',
        fontFamily: 'Montserrat_700Bold',
    },
    profileLabel: {
        fontSize: 16,
        marginTop: 2,
    },
    divider: {
        borderBottomWidth: 0.5,
        marginVertical: 10,
    },
    menuContainer: {
        gap: 0,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 4,
        justifyContent: 'space-between',
    },
    menuText: {
        fontSize: 16,
        fontWeight: '500',
    },
    menuDivider: {
        borderBottomWidth: 0.5,
        marginLeft: 44,
    },
    // New Badge Styles
    menuBadge: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        minWidth: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    marketplaceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        gap: 8,
    },
    marketplaceText: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    quibleIcon: {
        width: 23,
        height: 23,
        marginHorizontal: 2,
    },
    quibleBrand: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    themeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
    },
    themeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    loaderContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
});

export default RiderSidebar;
