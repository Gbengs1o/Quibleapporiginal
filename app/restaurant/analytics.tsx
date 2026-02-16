import FoodLoader from '@/components/FoodLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

// Colors
const COLORS = {
    green: '#3CBD54',
    orange: '#FF8818',
    purple: '#A0A2F1',
    blue: '#4A90D9',
    red: '#E74C3C',
    yellow: '#F1C40F',
    dark: '#1B1B1B',
};

// Data Interfaces
interface TopItem {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
}

interface AnalyticsData {
    topItems: TopItem[];
    peakTimes: { labels: string[], datasets: { data: number[] }[] };
    weeklyRevenue: { labels: string[], datasets: { data: number[] }[] };
    dayOfWeek: { labels: string[], datasets: { data: number[] }[] };
    orderStatus: { name: string, count: number, color: string, legendFontColor: string, legendFontSize: number }[];
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    completedOrders: number;
    pendingOrders: number;
}

export default function AnalyticsScreen() {
    const navigation = useNavigation();
    const { openMenu } = useRestaurantMenu();
    const { user } = useAuth();
    const iconColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const chartBg = useThemeColor({ light: '#fff', dark: '#1B1B1B' }, 'background');
    const cardBgLight = useThemeColor({ light: '#F8F9FA', dark: '#2A2A2A' }, 'background');

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<AnalyticsData>({
        topItems: [],
        peakTimes: { labels: [], datasets: [{ data: [0] }] },
        weeklyRevenue: { labels: [], datasets: [{ data: [0] }] },
        dayOfWeek: { labels: [], datasets: [{ data: [0] }] },
        orderStatus: [],
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        completedOrders: 0,
        pendingOrders: 0,
    });

    useEffect(() => {
        if (user) fetchAnalytics();
    }, [user]);

    const fetchAnalytics = async () => {
        try {
            // 1. Get Restaurant ID
            const { data: rest } = await supabase.from('restaurants').select('id').eq('owner_id', user?.id).single();
            if (!rest) return;

            // 2. Fetch Orders (with status for breakdown)
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('id, created_at, total_amount, status')
                .eq('restaurant_id', rest.id);

            if (ordersError) throw ordersError;

            // 3. Fetch Order Items (for Top Items)
            const orderIds = orders?.map(o => o.id) || [];
            const { data: items } = await supabase
                .from('order_items')
                .select('menu_item_id, quantity, price_at_time')
                .in('order_id', orderIds);

            // 4. Fetch Menu Item Names
            const menuItemIds = [...new Set(items?.map(i => i.menu_item_id) || [])];
            const { data: menuItems } = await supabase
                .from('menu_items')
                .select('id, name')
                .in('id', menuItemIds.length > 0 ? menuItemIds : ['none']);

            // --- PROCESS DATA ---

            // A. Top Selling Items
            const itemMap = new Map<string, TopItem>();
            items?.forEach(item => {
                const existing = itemMap.get(item.menu_item_id) || { id: item.menu_item_id, name: 'Unknown', quantity: 0, revenue: 0 };
                existing.quantity += (item.quantity || 0);
                existing.revenue += (item.quantity || 0) * (item.price_at_time || 0);
                itemMap.set(item.menu_item_id, existing);
            });
            menuItems?.forEach(m => {
                if (itemMap.has(m.id)) itemMap.get(m.id)!.name = m.name;
            });
            const topItems = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

            // B. Peak Times (By Hour)
            const hours = new Array(24).fill(0);
            orders?.forEach(o => { hours[new Date(o.created_at).getHours()]++; });
            const peakLabels = [], peakData = [];
            for (let i = 8; i <= 22; i++) {
                peakLabels.push(i > 12 ? `${i - 12}P` : (i === 12 ? '12P' : `${i}A`));
                peakData.push(hours[i]);
            }

            // C. Weekly Revenue (Last 7 Days)
            const last7Days: { label: string, rev: number }[] = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayStr = d.toDateString();
                const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
                const dayRev = orders?.filter(o => new Date(o.created_at).toDateString() === dayStr)
                    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;
                last7Days.push({ label: dayLabel, rev: dayRev });
            }

            // D. Day of Week Performance (Aggregated All Time)
            const dowCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun to Sat
            orders?.forEach(o => { dowCounts[new Date(o.created_at).getDay()]++; });

            // E. Order Status Breakdown
            const statusCounts = { pending: 0, completed: 0, cancelled: 0, other: 0 };
            orders?.forEach(o => {
                if (o.status === 'pending') statusCounts.pending++;
                else if (o.status === 'completed' || o.status === 'delivered') statusCounts.completed++;
                else if (o.status === 'cancelled') statusCounts.cancelled++;
                else statusCounts.other++;
            });
            const orderStatusData = [
                { name: 'Completed', count: statusCounts.completed, color: COLORS.green, legendFontColor: '#7F7F7F', legendFontSize: 12 },
                { name: 'Pending', count: statusCounts.pending, color: COLORS.orange, legendFontColor: '#7F7F7F', legendFontSize: 12 },
                { name: 'Cancelled', count: statusCounts.cancelled, color: COLORS.red, legendFontColor: '#7F7F7F', legendFontSize: 12 },
            ].filter(s => s.count > 0);

            // F. Totals
            const totalRev = orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;
            const totalOrd = orders?.length || 0;
            const avgOrd = totalOrd > 0 ? totalRev / totalOrd : 0;

            setData({
                topItems,
                peakTimes: { labels: peakLabels, datasets: [{ data: peakData.length > 0 ? peakData : [0] }] },
                weeklyRevenue: { labels: last7Days.map(d => d.label), datasets: [{ data: last7Days.map(d => d.rev).length > 0 ? last7Days.map(d => d.rev) : [0] }] },
                dayOfWeek: { labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], datasets: [{ data: dowCounts }] },
                orderStatus: orderStatusData.length > 0 ? orderStatusData : [{ name: 'No Data', count: 1, color: '#ccc', legendFontColor: '#7F7F7F', legendFontSize: 12 }],
                totalOrders: totalOrd,
                totalRevenue: totalRev,
                avgOrderValue: avgOrd,
                completedOrders: statusCounts.completed,
                pendingOrders: statusCounts.pending,
            });

        } catch (error) {
            console.error("Analytics Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => { setRefreshing(true); fetchAnalytics(); };

    if (loading) return <FoodLoader message="Gathering insights..." />;

    const chartConfig = {
        backgroundColor: chartBg,
        backgroundGradientFrom: chartBg,
        backgroundGradientTo: chartBg,
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(60, 189, 84, ${opacity})`,
        labelColor: () => '#888',
        barPercentage: 0.5,
        propsForBackgroundLines: { strokeWidth: 0.5, stroke: "#e3e3e3" },
    };

    return (
        <ThemedView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={openMenu}>
                        <Ionicons name="menu" size={28} color={iconColor} />
                    </TouchableOpacity>
                    <ThemedText type="title" style={{ fontSize: 24 }}>Analytics</ThemedText>
                    <View style={{ width: 28 }} />
                </View>

                {/* Quick Stats Cards */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: COLORS.green }]}>
                        <Ionicons name="cart-outline" size={24} color="white" />
                        <ThemedText style={styles.statValue}>{data.totalOrders}</ThemedText>
                        <ThemedText style={styles.statLabel}>Total Orders</ThemedText>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: COLORS.blue }]}>
                        <Ionicons name="cash-outline" size={24} color="white" />
                        <ThemedText style={styles.statValue}>₦{data.totalRevenue.toLocaleString()}</ThemedText>
                        <ThemedText style={styles.statLabel}>Total Revenue</ThemedText>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: COLORS.purple }]}>
                        <Ionicons name="wallet-outline" size={24} color="white" />
                        <ThemedText style={styles.statValue}>₦{data.avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</ThemedText>
                        <ThemedText style={styles.statLabel}>Avg Order Value</ThemedText>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: COLORS.orange }]}>
                        <Ionicons name="checkmark-done-outline" size={24} color="white" />
                        <ThemedText style={styles.statValue}>{data.completedOrders}</ThemedText>
                        <ThemedText style={styles.statLabel}>Completed</ThemedText>
                    </View>
                </ScrollView>

                {/* Weekly Revenue Trend */}
                <View style={[styles.card, { backgroundColor: chartBg }]}>
                    <ThemedText style={styles.cardTitle}>📈 Revenue Trend (Last 7 Days)</ThemedText>
                    <LineChart
                        data={data.weeklyRevenue}
                        width={width - 60}
                        height={180}
                        yAxisLabel="₦"
                        yAxisSuffix=""
                        chartConfig={{ ...chartConfig, color: () => COLORS.blue }}
                        bezier
                        style={{ marginTop: 10, borderRadius: 8 }}
                    />
                </View>

                {/* Peak Times Chart */}
                <View style={[styles.card, { backgroundColor: chartBg }]}>
                    <ThemedText style={styles.cardTitle}>⏰ Peak Business Hours</ThemedText>
                    <ThemedText style={styles.cardSubtitle}>When your orders come in</ThemedText>
                    <BarChart
                        data={data.peakTimes}
                        width={width - 60}
                        height={200}
                        yAxisLabel=""
                        yAxisSuffix=""
                        chartConfig={chartConfig}
                        showValuesOnTopOfBars
                        fromZero
                        style={{ marginTop: 10, borderRadius: 8 }}
                    />
                </View>

                {/* Day of Week Performance */}
                <View style={[styles.card, { backgroundColor: chartBg }]}>
                    <ThemedText style={styles.cardTitle}>📅 Day of Week Performance</ThemedText>
                    <ThemedText style={styles.cardSubtitle}>Your busiest days</ThemedText>
                    <BarChart
                        data={data.dayOfWeek}
                        width={width - 60}
                        height={180}
                        yAxisLabel=""
                        yAxisSuffix=""
                        chartConfig={{ ...chartConfig, color: () => COLORS.purple }}
                        showValuesOnTopOfBars
                        fromZero
                        style={{ marginTop: 10, borderRadius: 8 }}
                    />
                </View>

                {/* Order Status Breakdown */}
                <View style={[styles.card, { backgroundColor: chartBg }]}>
                    <ThemedText style={styles.cardTitle}>📊 Order Status</ThemedText>
                    <ThemedText style={styles.cardSubtitle}>Breakdown of your orders</ThemedText>
                    <View style={{ alignItems: 'center', marginTop: 10 }}>
                        <PieChart
                            data={data.orderStatus}
                            width={width - 60}
                            height={180}
                            chartConfig={chartConfig}
                            accessor={"count"}
                            backgroundColor={"transparent"}
                            paddingLeft={"15"}
                            absolute
                        />
                    </View>
                </View>

                {/* Top Items List */}
                <View style={[styles.card, { backgroundColor: chartBg }]}>
                    <ThemedText style={styles.cardTitle}>🏆 Top Selling Items</ThemedText>
                    <ThemedText style={styles.cardSubtitle}>Your most popular dishes</ThemedText>
                    <View style={styles.listContainer}>
                        {data.topItems.length === 0 ? (
                            <ThemedText style={{ color: '#999', padding: 20 }}>No sales data yet.</ThemedText>
                        ) : (
                            data.topItems.map((item, index) => (
                                <View key={item.id} style={styles.listItem}>
                                    <View style={[styles.rankBadge, { backgroundColor: index === 0 ? COLORS.orange : '#F5F5F5' }]}>
                                        <ThemedText style={[styles.rankText, { color: index === 0 ? 'white' : '#555' }]}>#{index + 1}</ThemedText>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <ThemedText style={styles.itemName} numberOfLines={1}>{item.name}</ThemedText>
                                        <ThemedText style={styles.itemRevenue}>₦{item.revenue.toLocaleString()} revenue</ThemedText>
                                    </View>
                                    <View style={styles.qtyBadge}>
                                        <ThemedText style={styles.qtyText}>{item.quantity} Sold</ThemedText>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>

                <View style={{ height: 60 }} />
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { paddingBottom: 40 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        marginBottom: 15,
    },
    statsRow: {
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 20,
    },
    statCard: {
        width: 130,
        height: 110,
        borderRadius: 16,
        padding: 15,
        justifyContent: 'space-between',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    statLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.8)',
    },
    card: {
        marginHorizontal: 20,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#999',
    },
    listContainer: { marginTop: 10 },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    rankBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: { fontWeight: 'bold', fontSize: 12 },
    itemName: { fontSize: 15, fontWeight: '600' },
    itemRevenue: { fontSize: 12, color: '#3CBD54', marginTop: 2 },
    qtyBadge: {
        backgroundColor: '#FFF0E0',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    qtyText: { color: '#FF8818', fontWeight: 'bold', fontSize: 12 },
});
