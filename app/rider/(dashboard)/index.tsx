import LottieLoader from '@/components/LottieLoader';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useRiderNotifications } from '@/contexts/rider-notifications';
import { useWallet } from '@/contexts/wallet';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Animated,
    Easing,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// --- Components ---

const StatCard = ({
    title,
    subtitle,
    value,
    badgeValue,
    onPress,
    isCurrency = false,
    cardBg,
    textColor
}: {
    title: string;
    subtitle: string;
    value: string | number;
    badgeValue?: string;
    onPress?: () => void;
    isCurrency?: boolean;
    cardBg: string;
    textColor: string;
}) => (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.statCard, { backgroundColor: cardBg }]}>
        <View style={styles.statHeader}>
            <Text style={[styles.statTitle, { color: textColor }]}>{title}</Text>
            {badgeValue && (
                <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{badgeValue}</Text>
                </View>
            )}
        </View>

        <Text style={[styles.statSubtitle, { color: textColor }]}>{subtitle}</Text>

        <View style={styles.chartPlaceholder}>
            {/* Improved arrow visibility: Light orange always visible but subtle */}
            <Ionicons name="trending-up-outline" size={48} color="rgba(242, 124, 34, 0.4)" />
        </View>

        <View style={styles.statFooter}>
            {isCurrency && (
                <View style={[styles.currencyIcon, { borderColor: textColor }]}>
                    <Text style={[styles.nairaSymbol, { color: textColor }]}>₦</Text>
                </View>
            )}
            <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
        </View>
    </TouchableOpacity>
);

const DeliveryCard = ({ item, textColor, cardBg }: { item: any, textColor: string, cardBg: string }) => {
    const isCompleted = item.status === 'delivered';
    const statusColor = isCompleted ? '#22C55E' : (item.status === 'cancelled' ? '#EF4444' : '#F59E0B');
    const statusText = item.status === 'delivered' ? 'Completed' : (item.status === 'cancelled' ? 'Cancelled' : 'In Progress');

    return (
        <View style={[styles.deliveryCard, { backgroundColor: cardBg }]}>
            <View style={styles.deliveryRow}>
                {/* Icon & ID */}
                <View style={styles.deliveryLeft}>
                    <View style={[styles.iconBox, { backgroundColor: isCompleted ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)' }]}>
                        <Ionicons
                            name={isCompleted ? "checkmark-circle" : "time"}
                            size={20}
                            color={statusColor}
                        />
                    </View>
                    <View>
                        <Text style={[styles.deliveryId, { color: textColor }]}>ID: #{item.id.substring(0, 6).toUpperCase()}</Text>
                        <Text style={styles.deliveryDate}>{new Date(item.updated_at).toLocaleDateString()} • {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                </View>

                {/* Price */}
                <View>
                    <Text style={[styles.deliveryPrice, { color: textColor }]}>₦{Number(item.final_price || 0).toLocaleString()}</Text>
                </View>
            </View>

            <View style={[styles.divider, { backgroundColor: textColor, opacity: 0.05 }]} />

            <View style={styles.deliveryLocations}>
                <View style={styles.locationItem}>
                    <View style={[styles.dot, { backgroundColor: '#F27C22' }]} />
                    <Text numberOfLines={1} style={[styles.addressText, { color: textColor }]}>{item.pickup_address || 'Pickup Point'}</Text>
                </View>
                <View style={[styles.locationLine, { borderColor: textColor }]} />
                <View style={styles.locationItem}>
                    <View style={[styles.dot, { backgroundColor: '#22C55E' }]} />
                    <Text numberOfLines={1} style={[styles.addressText, { color: textColor }]}>{item.dropoff_address || 'Dropoff Point'}</Text>
                </View>
            </View>

            <View style={styles.deliveryFooter}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusText}>{statusText}</Text>
                </View>
                <TouchableOpacity style={styles.detailsBtn}>
                    <Text style={styles.detailsText}>View Details</Text>
                    <Ionicons name="chevron-forward" size={14} color="#6B7280" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default function RiderDashboard() {
    const router = useRouter();
    const { session } = useAuth();
    const { openMenu } = useRiderMenu();
    const { riderWallet, refreshWallet } = useWallet();
    const { unreadMessages, pendingDeliveries, pendingFoodInvites, unreadAlerts } = useRiderNotifications();

    // Theme Hooks
    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#121212' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1E1E1E' }, 'background'); // Slightly lighter dark card
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const iconColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const statusBarStyle = useThemeColor({ light: 'dark-content', dark: 'light-content' }, 'text') as any;

    // Animation
    const toggleAnim = React.useRef(new Animated.Value(0)).current;

    // State
    const [isOnline, setIsOnline] = useState(false);
    const [riderData, setRiderData] = useState<any>(null);
    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [todaysEarnings, setTodaysEarnings] = useState(0);
    const [todaysTrips, setTodaysTrips] = useState(0);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    const [averageRating, setAverageRating] = useState(0);

    const navigation = useNavigation();

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchAllData();
        });
        return unsubscribe;
    }, [navigation]);

    const fetchAllData = async () => {
        if (!session?.user.id) return;

        try {
            await refreshWallet();

            // Fetch Rider Data First to get ID
            const { data: rider } = await supabase
                .from('riders')
                .select('*')
                .eq('user_id', session.user.id)
                .single();

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (rider) {
                setRiderData(rider);
                setIsOnline(rider.is_online);
                setAverageRating(rider.average_rating || 0);

                // Initialize toggle animation
                Animated.timing(toggleAnim, {
                    toValue: rider.is_online ? 1 : 0,
                    duration: 0,
                    useNativeDriver: true
                }).start();

                await fetchStats(rider.id);
            }

            if (profile) {
                setProfileData(profile);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async (riderId: string) => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data: todayJobs } = await supabase
            .from('delivery_requests')
            .select('final_price')
            .eq('rider_id', riderId)
            .eq('status', 'delivered')
            .gte('updated_at', startOfDay.toISOString());

        if (todayJobs) {
            const sum = todayJobs.reduce((acc, job) => acc + (Number(job.final_price) || 0), 0);
            setTodaysEarnings(sum);
            setTodaysTrips(todayJobs.length);
        }

        const { data: history } = await supabase
            .from('delivery_requests')
            .select('*')
            .eq('rider_id', riderId)
            .in('status', ['delivered', 'cancelled', 'picked_up'])
            .order('updated_at', { ascending: false })
            .limit(5);

        if (history) setRecentActivity(history);
    };



    const toggleOnline = async () => {
        const newVal = !isOnline;
        setIsOnline(newVal);

        Animated.timing(toggleAnim, {
            toValue: newVal ? 1 : 0,
            duration: 300,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
            useNativeDriver: true,
        }).start();

        if (session?.user.id) {
            await supabase.from('riders').update({ is_online: newVal }).eq('user_id', session.user.id);
        }
    };

    const avatarUrl = riderData?.rider_photo || profileData?.profile_picture_url;

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }]}>
                <LottieLoader size={120} />
            </View>
        );
    }

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            <StatusBar barStyle={statusBarStyle} backgroundColor={bgColor} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu} style={styles.menuIcon}>
                    <Ionicons name="menu" size={28} color={iconColor} />
                </TouchableOpacity>

                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.notificationBtn}>
                        <Ionicons name="notifications-outline" size={26} color={iconColor} />
                        {unreadAlerts > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationText}>{unreadAlerts}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={[styles.profileContainer, { borderColor: textColor }]}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.profileImage} />
                        ) : (
                            <View style={[styles.profileImage, { backgroundColor: '#F27C22', justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{session?.user?.email?.charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            <ScrollView bounces={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* 1. Go Online Toggle */}
                <View style={styles.toggleContainer}>
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={toggleOnline}
                        style={[
                            styles.onlineButton,
                            {
                                backgroundColor: isOnline ? '#009A49' : (textColor === '#FFFFFF' ? '#333' : '#E5E7EB'),
                                overflow: 'hidden'
                            }
                        ]}
                    >
                        <Animated.Text style={[
                            styles.onlineButtonText,
                            {
                                color: isOnline ? '#fff' : textColor,
                                opacity: toggleAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1] // Adjust if needed
                                })
                            }
                        ]}>
                            {isOnline ? 'You are Online' : 'You are Offline'}
                        </Animated.Text>

                        <View style={styles.toggleTrack}>
                            <Animated.View style={[
                                styles.toggleCircle,
                                {
                                    backgroundColor: '#fff',
                                    transform: [{
                                        translateX: toggleAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0, 132] // 180 total width - 8 padding - 40 circle width = 132 travel
                                        })
                                    }]
                                }
                            ]} />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* 2. Sliding Stats Cards */}
                <View style={styles.statsContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.statsScrollContent}
                    >
                        <StatCard
                            title="Insights"
                            subtitle="View Analytics"
                            value="Analytics"
                            onPress={() => router.push('/rider/analytics')}
                            cardBg={cardBg}
                            textColor={textColor}
                        />

                        <StatCard
                            title="Activity"
                            subtitle="Total Earnings today"
                            value={todaysEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            isCurrency
                            onPress={() => router.push('/rider/wallet')}
                            cardBg={cardBg}
                            textColor={textColor}
                        />

                        <StatCard
                            title="Activity"
                            subtitle="Total delivery today"
                            value={todaysTrips.toString()}
                            onPress={() => router.push('/rider/deliveries?tab=history')}
                            cardBg={cardBg}
                            textColor={textColor}
                        />

                        <StatCard
                            title="Wallet"
                            subtitle="Available Balance"
                            value={riderWallet?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                            isCurrency
                            onPress={() => router.push('/rider/wallet')}
                            cardBg={cardBg}
                            textColor={textColor}
                        />

                        <StatCard
                            title="Performance"
                            subtitle="Average Rating"
                            value={averageRating.toFixed(1)}
                            badgeValue="★"
                            onPress={() => router.push('/rider/reviews')}
                            cardBg={cardBg}
                            textColor={textColor}
                        />

                        <StatCard
                            title="Communication"
                            subtitle="Unread Messages"
                            value={unreadMessages.toString()}
                            badgeValue={unreadMessages > 0 ? "NEW" : undefined}
                            onPress={() => router.push('/rider/messages')}
                            cardBg={cardBg}
                            textColor={textColor}
                        />

                        <StatCard
                            title="Food Orders"
                            subtitle="Restaurant Invites"
                            value={pendingFoodInvites.toString()}
                            badgeValue={pendingFoodInvites > 0 ? "NEW" : undefined}
                            onPress={() => router.push('/rider/deliveries?tab=food')}
                            cardBg={cardBg}
                            textColor={textColor}
                        />

                        <StatCard
                            title="Logistics"
                            subtitle="Pending Requests"
                            value={pendingDeliveries.toString()}
                            onPress={() => router.push('/rider/deliveries')}
                            cardBg={cardBg}
                            textColor={textColor}
                        />
                    </ScrollView>
                </View>

                {/* 3. CTA */}
                <View style={styles.ctaContainer}>
                    <TouchableOpacity
                        style={styles.ctaButton}
                        activeOpacity={0.8}
                        onPress={() => router.push('/rider/deliveries')}
                    >
                        <Text style={styles.ctaText}>View new delivery request</Text>
                    </TouchableOpacity>
                </View>

                {/* 4. Recent Deliveries (Supercharged) */}
                <View style={styles.recentSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: textColor }]}>Recent Deliveries</Text>
                        <TouchableOpacity onPress={() => router.push('/rider/deliveries?tab=history')}>
                            <Text style={styles.seeAllText}>See All</Text>
                        </TouchableOpacity>
                    </View>

                    {recentActivity.length === 0 ? (
                        <View style={[styles.emptyContainer, { backgroundColor: cardBg }]}>
                            <Ionicons name="cube-outline" size={40} color="#9CA3AF" />
                            <Text style={styles.emptyText}>No recent deliveries found</Text>
                        </View>
                    ) : (
                        <View style={{ gap: 16 }}>
                            {recentActivity.map(item => (
                                <DeliveryCard
                                    key={item.id}
                                    item={item}
                                    textColor={textColor}
                                    cardBg={cardBg}
                                />
                            ))}
                        </View>
                    )}
                </View>

            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        marginBottom: 20,
    },
    menuIcon: { padding: 8 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    notificationBtn: { position: 'relative', padding: 4 },
    notificationBadge: {
        position: 'absolute', top: 0, right: 0, backgroundColor: 'red',
        width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', zIndex: 10,
    },
    notificationText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    profileContainer: {
        width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 2,
    },
    profileImage: { width: '100%', height: '100%' },

    // Toggle
    toggleContainer: { paddingHorizontal: 26, marginBottom: 30 },
    onlineButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 4, paddingVertical: 4, width: 180, height: 50, borderRadius: 50,
        position: 'relative'
    },
    onlineButtonText: {
        fontFamily: 'OpenSans_600SemiBold',
        fontSize: 14,
        position: 'absolute',
        width: '100%',
        textAlign: 'center',
        zIndex: 1
    },
    toggleTrack: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
    },
    toggleCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2.5,
        elevation: 4
    },

    // Stats
    statsContainer: { marginBottom: 30 },
    statsScrollContent: { paddingHorizontal: 23 },
    statCard: {
        width: 220, height: 216, borderRadius: 12, padding: 20, marginRight: 14, justifyContent: 'space-between',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    },
    statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    statTitle: { fontFamily: 'Montserrat_600SemiBold', fontSize: 19 },
    badgeContainer: { backgroundColor: '#A0A2F1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    badgeText: { color: '#fff', fontFamily: 'Montserrat_500Medium', fontSize: 12 },
    statSubtitle: { fontFamily: 'Montserrat_400Regular', fontSize: 15, opacity: 0.7, marginTop: 4 },
    chartPlaceholder: { height: 60, justifyContent: 'center', marginVertical: 10 },
    statFooter: { flexDirection: 'row', alignItems: 'center' },
    currencyIcon: {
        width: 32, height: 32, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderRadius: 8,
    },
    nairaSymbol: { fontSize: 16, fontWeight: 'bold' },
    statValue: { fontFamily: 'Montserrat_600SemiBold', fontSize: 24 },

    // CTA
    ctaContainer: { paddingHorizontal: 26, marginBottom: 30 },
    ctaButton: {
        backgroundColor: '#F27C22', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
        shadowColor: '#F27C22', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    ctaText: { color: '#fff', fontFamily: 'OpenSans_700Bold', fontSize: 16 },

    // Recent Section
    recentSection: { paddingHorizontal: 24, paddingBottom: 40 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontFamily: 'Montserrat_700Bold', fontSize: 18 },
    seeAllText: { color: '#F27C22', fontFamily: 'OpenSans_600SemiBold', fontSize: 14 },

    emptyContainer: {
        padding: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc'
    },
    emptyText: { marginTop: 12, color: '#9CA3AF', fontFamily: 'OpenSans_400Regular' },

    // Delivery Card
    deliveryCard: {
        borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    deliveryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    deliveryLeft: { flexDirection: 'row', gap: 12 },
    iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    deliveryId: { fontFamily: 'OpenSans_700Bold', fontSize: 14, marginBottom: 2 },
    deliveryDate: { fontFamily: 'OpenSans_400Regular', fontSize: 12, color: '#9CA3AF' },
    deliveryPrice: { fontFamily: 'Montserrat_700Bold', fontSize: 16 },

    divider: { height: 1, width: '100%', marginVertical: 12 },

    deliveryLocations: { gap: 0 },
    locationItem: { flexDirection: 'row', alignItems: 'center', height: 24 },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
    locationLine: { height: 20, width: 1, backgroundColor: '#ccc', marginLeft: 3.5, marginVertical: 2, opacity: 0.3 },
    addressText: { fontFamily: 'OpenSans_400Regular', fontSize: 13, flex: 1 },

    deliveryFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    statusText: { color: '#fff', fontSize: 11, fontFamily: 'OpenSans_700Bold', textTransform: 'uppercase' },
    detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    detailsText: { fontSize: 12, color: '#6B7280', fontFamily: 'OpenSans_600SemiBold' },
});
