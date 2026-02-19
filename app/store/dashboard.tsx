import FoodLoader from '@/components/FoodLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Dimensions,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const { width } = Dimensions.get('window');

// Figma Colors
const COLORS = {
    darkBg: '#1E2050', // Main Dark Blue
    cardDark: '#1B1B1B', // Card Background (Dark)
    cardWhite: '#FFFFFF', // Card Background (White)
    orange: '#FF8818', // Accent
    green: '#3CBD54', // Trend Green
    textWhite: '#FFFFFF',
    textDark: '#1B1B1B',
    textGrey: '#9ca3af',
    purplePill: '#A0A2F1', // Light Purple Pill
};

interface DashboardStats {
    totalRevenue: number;
    todayRevenue: number;
    yesterdayRevenue: number;
    totalOrders: number;
    pendingOrders: number;
    trendPercentage: number;
    averageRating: number;
    totalReviews: number;
}

export default function StoreDashboard() {
    const { openMenu } = useRestaurantMenu();
    const { user } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [restaurant, setRestaurant] = useState<any>(null);
    const [stats, setStats] = useState<DashboardStats>({
        totalRevenue: 0,
        todayRevenue: 0,
        yesterdayRevenue: 0,
        totalOrders: 0,
        pendingOrders: 0,
        trendPercentage: 0,
        averageRating: 0,
        totalReviews: 0,
    });
    const [isOpen, setIsOpen] = useState(false); // Local state for toggle

    const bgColor = useThemeColor({ light: '#F5F5F5', dark: '#121212' }, 'background');
    const iconColor = useThemeColor({ light: '#1E2050', dark: '#FFFFFF' }, 'text');

    useEffect(() => {
        if (user) fetchDashboardData();
    }, [user]);

    const fetchDashboardData = async () => {
        try {
            const { data: rest, error: restError } = await supabase
                .from('stores')
                .select('*')
                .eq('owner_id', user?.id)
                .single();

            if (restError) throw restError;
            setRestaurant(rest);
            setIsOpen(rest.is_open || false);

            if (rest) {
                // 1. Fetch orders
                const { data: orders } = await supabase
                    .from('orders')
                    .select('id, total_amount, status, created_at')
                    .eq('store_id', rest.id);

                // 2. Fetch reviews
                const { data: reviews } = await supabase
                    .from('food_order_reviews')
                    .select('restaurant_rating')
                    .eq('store_id', rest.id);

                const reviewsData = reviews || [];

                let avgRating = 0;
                let reviewCount = 0;
                if (reviewsData && reviewsData.length > 0) {
                    const sum = reviewsData.reduce((acc: number, r: any) => acc + (r.restaurant_rating || 0), 0);
                    avgRating = sum / reviewsData.length;
                    reviewCount = reviewsData.length;
                }

                if (orders) {
                    const now = new Date();
                    const todayDate = now.toDateString();
                    const yesterday = new Date(now);
                    yesterday.setDate(now.getDate() - 1);
                    const yesterdayDate = yesterday.toDateString();

                    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === todayDate);
                    const yesterdayOrders = orders.filter(o => new Date(o.created_at).toDateString() === yesterdayDate);

                    const revToday = todayOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
                    const revYesterday = yesterdayOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

                    // Simple Trend Calculation
                    let trend = 0;
                    if (revYesterday > 0) {
                        trend = ((revToday - revYesterday) / revYesterday) * 100;
                    } else if (revToday > 0) {
                        trend = 100;
                    }

                    setStats({
                        totalRevenue: orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
                        todayRevenue: revToday,
                        yesterdayRevenue: revYesterday,
                        totalOrders: orders.length,
                        pendingOrders: orders.filter(o => o.status === 'pending').length,
                        trendPercentage: Math.round(trend),
                        averageRating: avgRating,
                        totalReviews: reviewCount,
                    });
                }
            }
        } catch (error) {
            console.error("Dashboard fetch error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const toggleRestaurantStatus = async (value: boolean) => {
        setIsOpen(value); // Optimistic visual update
        try {
            const { error } = await supabase
                .from('stores')
                .update({ is_open: value })
                .eq('id', restaurant?.id);

            if (error) {
                setIsOpen(!value); // Revert on error
                console.error("Error updating status:", error);
            }
        } catch (err) {
            setIsOpen(!value);
            console.error("Error updating status:", err);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchDashboardData();
    }, []);

    if (loading) return <FoodLoader message="Loading dashboard..." />;

    // Helper for Trend Pill
    const TrendPill = ({ percent }: { percent: number }) => (
        <View style={styles.trendPill}>
            <ThemedText style={styles.trendText}>
                {percent > 0 ? '+' : ''}{percent}%
            </ThemedText>
        </View>
    );

    // SVG Graph Curve (Static decoration matching Figma)
    const GraphCurve = () => (
        <Svg width="100%" height="50" viewBox="0 0 173 59" style={styles.graph}>
            <Path
                d="M2 50 C 40 50, 60 10, 100 25 S 150 5, 171 2"
                stroke="white"
                strokeWidth="3"
                fill="none"
            />
        </Svg>
    );

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    {/* Header: Menu, Search (REMOVED), Notification, Status, Avatar */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={openMenu} style={styles.menuBtn}>
                            <Ionicons name="menu" size={32} color={iconColor} />
                        </TouchableOpacity>

                        <View style={styles.headerRight}>
                            {/* Status Toggle */}
                            <View style={styles.statusToggle}>
                                <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: isOpen ? COLORS.green : '#f44336' }}>
                                    {isOpen ? 'OPEN' : 'CLOSED'}
                                </ThemedText>
                                <Switch
                                    value={isOpen}
                                    onValueChange={toggleRestaurantStatus}
                                    trackColor={{ false: '#767577', true: COLORS.green }}
                                    thumbColor={'#f4f3f4'}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </View>

                            <TouchableOpacity
                                style={styles.iconBtn}
                                onPress={() => router.push('/notifications')}
                            >
                                <Ionicons name="notifications" size={26} color={iconColor} />
                                <View style={styles.notifBadge} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/store/settings')}>
                                <Image
                                    source={{ uri: restaurant?.logo_url || 'https://via.placeholder.com/60' }}
                                    style={styles.avatar}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Top Stats Cards (Dark) */}
                    <View style={styles.topStatsContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 15, paddingHorizontal: 20 }}>
                            {/* Activity Card */}
                            <TouchableOpacity
                                style={styles.darkCard}
                                onPress={() => router.push('/store/analytics')}
                            >
                                <View style={styles.cardHeader}>
                                    <ThemedText style={styles.cardTitle}>Activity</ThemedText>
                                    <TrendPill percent={stats.trendPercentage} />
                                </View>
                                <GraphCurve />
                                <View style={styles.cardFooter}>
                                    <ThemedText style={styles.cardSubtitle}>Total Sales today</ThemedText>
                                    <View style={styles.amountRow}>
                                        <Ionicons name="cash-outline" size={20} color="white" />
                                        <ThemedText style={styles.cardAmount}>
                                            ₦{stats.todayRevenue.toLocaleString()}
                                        </ThemedText>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* Profit Card */}
                            <TouchableOpacity
                                style={styles.darkCard}
                                onPress={() => router.push('/store/analytics')}
                            >
                                <View style={styles.cardHeader}>
                                    <ThemedText style={styles.cardTitle}>Profit</ThemedText>
                                    <TrendPill percent={stats.trendPercentage} />
                                </View>
                                <GraphCurve />
                                <View style={styles.cardFooter}>
                                    <ThemedText style={styles.cardSubtitle}>Total Profit today</ThemedText>
                                    <View style={styles.amountRow}>
                                        <Ionicons name="trending-up-outline" size={20} color="white" />
                                        <ThemedText style={styles.cardAmount}>
                                            ₦{(stats.todayRevenue * 0.2).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </ThemedText>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* Rating Card (NEW) */}
                            <View style={styles.darkCard}>
                                <View style={styles.cardHeader}>
                                    <ThemedText style={styles.cardTitle}>Rating</ThemedText>
                                    <View style={[styles.trendPill, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                                        <ThemedText style={styles.trendText}>Live</ThemedText>
                                    </View>
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center', marginVertical: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Ionicons name="star" size={32} color={COLORS.orange} />
                                        <ThemedText style={{ fontSize: 32, fontWeight: 'bold', color: 'white' }}>
                                            {stats.averageRating ? stats.averageRating.toFixed(1) : "0.0"}
                                        </ThemedText>
                                    </View>
                                </View>
                                <View style={styles.cardFooter}>
                                    <ThemedText style={styles.cardSubtitle}>Total Reviews</ThemedText>
                                    <View style={styles.amountRow}>
                                        <Ionicons name="people-outline" size={20} color="white" />
                                        <ThemedText style={styles.cardAmount}>
                                            {stats.totalReviews}
                                        </ThemedText>
                                    </View>
                                </View>
                            </View>

                        </ScrollView>
                    </View>

                    {/* Add New Item Button */}
                    <View style={styles.actionContainer}>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => router.push('/store/menu')}
                        >
                            <Ionicons name="add" size={24} color="white" />
                            <ThemedText style={styles.addButtonText}>Add new product</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {/* Bottom Stats Grid */}
                    <View style={styles.bottomSection}>
                        {[
                            { label: 'Total Orders', value: stats.totalOrders.toString(), trend: '+20%', link: '/store/orders' },
                            { label: 'Total Sales', value: `₦${stats.totalRevenue.toLocaleString()}`, trend: '+15%', link: null },
                            { label: 'Total Pending', value: stats.pendingOrders.toString(), trend: '-5%', link: '/store/orders' }
                        ].map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.whiteCard}
                                onPress={() => item.link ? router.push(item.link as any) : null}
                            >
                                <View style={styles.whiteCardTop}>
                                    <ThemedText style={styles.whiteCardValue}>{item.value}</ThemedText>
                                    <View style={styles.smallTrendPill}>
                                        <ThemedText style={styles.smallTrendText}>{item.trend}</ThemedText>
                                    </View>
                                </View>
                                <ThemedText style={styles.whiteCardLabel}>{item.label}</ThemedText>
                            </TouchableOpacity>
                        ))}
                    </View>

                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        marginBottom: 20,
        height: 60,
    },
    menuBtn: {
        padding: 5,
        marginRight: 15,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
        borderWidth: 1,
        borderColor: '#EEE',
    },
    searchInput: {
        flex: 1,
        marginRight: 10,
        color: '#000',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statusToggle: {
        alignItems: 'center',
        marginRight: 5,
    },
    iconBtn: {
        position: 'relative',
        padding: 5,
    },
    notifBadge: {
        position: 'absolute',
        top: 2,
        right: 4,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'red',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: COLORS.orange,
    },

    // Top Stats
    topStatsContainer: {
        marginBottom: 20,
    },
    darkCard: {
        width: width * 0.65,
        height: 200,
        backgroundColor: COLORS.cardDark,
        borderRadius: 16,
        padding: 20,
        justifyContent: 'space-between',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'SpaceMono',
    },
    trendPill: {
        backgroundColor: COLORS.purplePill,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    trendText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    graph: {
        marginVertical: 10,
    },
    cardFooter: {},
    cardSubtitle: {
        color: '#ccc',
        fontSize: 14,
        marginBottom: 5,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardAmount: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },

    // Action
    actionContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    addButton: {
        backgroundColor: COLORS.darkBg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    addButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },

    // Bottom Section
    bottomSection: {
        paddingHorizontal: 20,
        gap: 15,
    },
    whiteCard: {
        backgroundColor: COLORS.cardWhite,
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f0f0f0'
    },
    whiteCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    whiteCardValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    smallTrendPill: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    smallTrendText: {
        color: COLORS.green,
        fontSize: 12,
        fontWeight: 'bold',
    },
    whiteCardLabel: {
        fontSize: 15,
        color: COLORS.textGrey,
        fontWeight: '500',
    },

});
