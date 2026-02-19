import LottieLoader from '@/components/LottieLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Defs, G, Path, Rect, Stop, LinearGradient as SvgGradient, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');

// --- Quible Colors ---
const PRIMARY = '#F27C22';
const NAVY = '#1F2050';
const SUCCESS = '#22C55E';
const ERROR = '#EF4444';
const GOLD = '#D4AF37';

// --- Helper Functions ---
const generateLinePath = (data: number[], chartWidth: number, chartHeight: number, maxValue: number) => {
    if (data.length === 0) return '';
    const stepX = chartWidth / (data.length - 1 || 1);
    let path = `M 0 ${chartHeight - (data[0] / maxValue) * chartHeight}`;
    for (let i = 1; i < data.length; i++) {
        const x = i * stepX;
        const y = chartHeight - (data[i] / maxValue) * chartHeight;
        path += ` L ${x} ${y}`;
    }
    return path;
};

const generateAreaPath = (data: number[], chartWidth: number, chartHeight: number, maxValue: number) => {
    if (data.length === 0) return '';
    const linePath = generateLinePath(data, chartWidth, chartHeight, maxValue);
    return `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;
};

// --- Sub-component: Stat Card (Dashboard Style) ---
const DashboardStat = ({ icon, label, value, subtext, color, cardBg, textColor, subtleText }: any) => (
    <View style={[styles.dbStat, { backgroundColor: cardBg }]}>
        <View style={[styles.dbStatIcon, { backgroundColor: `${color}15` }]}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.dbStatLabel, { color: subtleText }]}>{label}</Text>
        <Text style={[styles.dbStatValue, { color: textColor }]}>{value}</Text>
        {subtext && <Text style={[styles.dbStatSub, { color: color }]}>{subtext}</Text>}
    </View>
);

export default function RiderAnalytics() {
    const { session } = useAuth();
    const { openMenu } = useRiderMenu();
    const { theme } = useTheme();
    // const router = useRouter(); // Removed to use imperative router
    const isDark = theme === 'dark';

    // Theme Colors
    const bgColor = isDark ? '#0F1117' : '#F4F7FE';
    const cardBg = isDark ? '#1C1F2E' : '#FFFFFF';
    const textColor = isDark ? '#FFFFFF' : '#1F2050';
    const subtleText = isDark ? '#8A92A6' : '#6B7280';
    const glassBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(31, 32, 80, 0.03)';

    // State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        walletBalance: 0,
        totalEarnings: 0,
        completedJobs: 0,
        avgRating: 0.0,
        efficiency: '0m', // Avg time to deliver
        thirtyDayEarnings: [] as number[],
        peakHours: Array(24).fill(0),
        jobBreakdown: { deliveries: 0, orders: 0 },
        recentReviews: [] as any[],
    });

    useEffect(() => {
        fetchAdvancedAnalytics();
    }, [session?.user.id]);

    const fetchAdvancedAnalytics = async () => {
        if (!session?.user.id) return;
        try {
            setLoading(true);

            // Fetch Data Range (30 Days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const [riderRes, walletRes, transRes, delRes, ordRes, reviewsRes] = await Promise.all([
                supabase.from('riders').select('*').eq('user_id', session.user.id).single(),
                supabase.from('wallets').select('*').eq('user_id', session.user.id).eq('type', 'rider').single(),
                supabase.from('transactions').select('*').eq('type', 'credit').gte('created_at', thirtyDaysAgo.toISOString()).order('created_at', { ascending: true }),
                supabase.from('delivery_requests').select('*').eq('rider_id', session.user.id).gte('created_at', thirtyDaysAgo.toISOString()),
                supabase.from('orders').select('*').eq('rider_id', session.user.id).gte('created_at', thirtyDaysAgo.toISOString()),
                supabase.from('rider_reviews').select('*, reviewer:profiles(first_name, last_name)').eq('rider_id', session.user.id).order('created_at', { ascending: false }).limit(3)
            ]);

            const rider = riderRes.data;
            const wallet = walletRes.data;
            const transactions = transRes.data || [];
            const deliveries = delRes.data || [];
            const orders = ordRes.data || [];

            // 1. Process 30-Day Earnings Trend
            const dailyEarnings = Array(30).fill(0);
            const now = new Date();
            transactions.forEach(t => {
                const date = new Date(t.created_at);
                const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                if (diff >= 0 && diff < 30) dailyEarnings[29 - diff] += Number(t.amount);
            });

            // 2. Peak Hours (0-23)
            const hourStats = Array(24).fill(0);
            [...deliveries, ...orders].forEach(j => {
                const hour = new Date(j.created_at).getHours();
                hourStats[hour] += 1;
            });

            // 3. Efficiency (Avg Time to Deliver)
            const completedJobs = [...deliveries, ...orders].filter(j => j.status === 'delivered');
            let totalTime = 0;
            completedJobs.forEach(j => {
                const start = new Date(j.created_at);
                const end = new Date(j.updated_at);
                totalTime += (end.getTime() - start.getTime()) / (1000 * 60); // minutes
            });
            const avgTime = completedJobs.length > 0 ? Math.round(totalTime / completedJobs.length) : 0;

            setStats({
                walletBalance: Number(wallet?.balance) || 0,
                totalEarnings: transactions.reduce((acc, t) => acc + Number(t.amount), 0),
                completedJobs: completedJobs.length,
                avgRating: rider?.average_rating || 5.0,
                efficiency: `${avgTime}m`,
                thirtyDayEarnings: dailyEarnings,
                peakHours: hourStats,
                jobBreakdown: {
                    deliveries: deliveries.filter(d => d.status === 'delivered').length,
                    orders: orders.filter(o => o.status === 'delivered').length
                },
                recentReviews: reviewsRes.data || [],
            });

        } catch (error) {
            console.error('Advanced Analytics Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchAdvancedAnalytics();
    };

    // Chart Dimensions
    const trendChartWidth = width * 2; // 30 days = extra width for scrolling
    const chartHeight = 180;
    const maxEarning = Math.max(...stats.thirtyDayEarnings, 1000);
    const maxHourJobs = Math.max(...stats.peakHours, 1);

    if (loading) return <View style={[styles.centerContainer, { backgroundColor: bgColor }]}><LottieLoader size={120} /></View>;

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bgColor} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu} style={styles.headerIcon}>
                    <Ionicons name="grid-outline" size={24} color={textColor} />
                </TouchableOpacity>
                <ThemedText style={styles.headerTitle}>Professional Insights</ThemedText>
                <TouchableOpacity onPress={onRefresh} style={styles.headerIcon}>
                    <Ionicons name="stats-chart" size={24} color={PRIMARY} />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />}
            >
                {/* 1. Main Wallet Card - High Fidelity */}
                <LinearGradient colors={[isDark ? '#1F2050' : '#2C2E60', '#121338']} style={styles.mainCard}>
                    <View style={styles.cardHighlight} />
                    <View style={styles.mainCardTop}>
                        <View>
                            <Text style={styles.mainCardLabel}>Performance Index</Text>
                            <Text style={styles.mainCardValue}>₦{stats.walletBalance.toLocaleString()}</Text>
                        </View>
                        <View style={styles.mainCardChip}>
                            <Text style={styles.chipText}>Live Balance</Text>
                        </View>
                    </View>
                    <View style={styles.mainCardBottom}>
                        <View style={styles.miniStat}>
                            <Ionicons name="flash" size={12} color={GOLD} />
                            <Text style={styles.miniStatText}>{stats.completedJobs} Jobs Finalized</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.withdrawBtn}
                            onPress={() => router.push('/rider/wallet')}
                        >
                            <Text style={styles.withdrawText}>Details</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* 2. Grid Stats - More Detailed */}
                <View style={styles.statsGrid}>
                    <DashboardStat
                        icon="time-outline"
                        label="Avg. Efficiency"
                        value={stats.efficiency}
                        subtext="Delivery speed"
                        color={PRIMARY}
                        cardBg={cardBg}
                        textColor={textColor}
                        subtleText={subtleText}
                    />
                    <DashboardStat
                        icon="star-outline"
                        label="Satisfaction"
                        value={stats.avgRating.toFixed(1)}
                        subtext={`${stats.recentReviews.length} new signals`}
                        color={GOLD}
                        cardBg={cardBg}
                        textColor={textColor}
                        subtleText={subtleText}
                    />
                </View>

                {/* 3. SCROLLABLE REVENUE TREND (30 DAYS) */}
                <View style={[styles.chartBox, { backgroundColor: cardBg }]}>
                    <View style={styles.chartBoxHeader}>
                        <Text style={[styles.chartBoxTitle, { color: textColor }]}>30-Day Revenue Trend</Text>
                        <Text style={styles.scrollHint}>← Swipe to see more →</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
                        <Svg height={chartHeight + 40} width={trendChartWidth}>
                            <Defs>
                                <SvgGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor={PRIMARY} stopOpacity="0.3" />
                                    <Stop offset="1" stopColor={PRIMARY} stopOpacity="0.0" />
                                </SvgGradient>
                            </Defs>
                            {/* Area Fill */}
                            <Path
                                d={generateAreaPath(stats.thirtyDayEarnings, trendChartWidth, chartHeight, maxEarning)}
                                fill="url(#grad)"
                                transform="translate(0, 10)"
                            />
                            {/* Line Path */}
                            <Path
                                d={generateLinePath(stats.thirtyDayEarnings, trendChartWidth, chartHeight, maxEarning)}
                                fill="none"
                                stroke={PRIMARY}
                                strokeWidth="3"
                                strokeLinecap="round"
                                transform="translate(0, 10)"
                            />
                            {/* Daily Markers & Labels */}
                            {stats.thirtyDayEarnings.map((_, i) => {
                                if (i % 5 !== 0) return null; // Show every 5 days
                                const x = (i * trendChartWidth) / 29;
                                return (
                                    <G key={i}>
                                        <Rect x={x - 0.5} y={10} width="1" height={chartHeight} fill={glassBg} />
                                        <SvgText x={x} y={chartHeight + 30} fill={subtleText} fontSize="10" textAnchor="middle">
                                            {`${30 - i}d`}
                                        </SvgText>
                                    </G>
                                );
                            })}
                        </Svg>
                    </ScrollView>
                </View>

                {/* 4. Peak Activity Analysis */}
                <View style={[styles.chartBox, { backgroundColor: cardBg }]}>
                    <Text style={[styles.chartBoxTitle, { color: textColor, marginBottom: 20 }]}>Peak Hub Activity (Hourly)</Text>
                    <View style={styles.peakBarContainer}>
                        {stats.peakHours.map((count, hour) => {
                            const barHeight = (count / maxHourJobs) * 80;
                            const isActive = count === maxHourJobs && count > 0;
                            return (
                                <View key={hour} style={styles.peakBarWrapper}>
                                    <View style={[styles.peakBar, { height: Math.max(barHeight, 4), backgroundColor: isActive ? PRIMARY : glassBg }]} />
                                    {hour % 4 === 0 && <Text style={[styles.hourLabel, { color: subtleText }]}>{hour}h</Text>}
                                </View>
                            );
                        })}
                    </View>
                    <View style={styles.insightBox}>
                        <Ionicons name="bulb-outline" size={16} color={GOLD} />
                        <Text style={[styles.insightText, { color: subtleText }]}>
                            {maxHourJobs > 0
                                ? `Your highest activity occurs around ${stats.peakHours.indexOf(maxHourJobs)}:00.`
                                : "No activity data for the selected period."}
                        </Text>
                    </View>
                </View>

                {/* 5. Recent Performance Signals */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionHeader, { color: textColor }]}>Recent Activity Signals</Text>
                    {stats.recentReviews.length > 0 && (
                        <TouchableOpacity>
                            <Text style={[styles.viewAllText, { color: PRIMARY }]}>View All</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {stats.recentReviews.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.signalScroll}>
                        {stats.recentReviews.map((review, idx) => (
                            <View key={idx} style={[styles.signalCard, { backgroundColor: cardBg, width: width * 0.75 }]}>
                                <View style={styles.signalTop}>
                                    <View style={styles.signalUser}>
                                        <View style={styles.userAvatar}>
                                            <Text style={styles.avatarText}>{review.reviewer?.first_name?.[0]}</Text>
                                        </View>
                                        <Text style={[styles.signalName, { color: textColor }]}>{review.reviewer?.first_name}</Text>
                                    </View>
                                    <View style={styles.signalRating}>
                                        <Ionicons name="star" size={12} color={GOLD} />
                                        <Text style={[styles.signalRatingText, { color: textColor }]}>{review.rating}</Text>
                                    </View>
                                </View>
                                <Text style={[styles.signalComment, { color: subtleText }]} numberOfLines={2}>
                                    "{review.comment}"
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                ) : (
                    <View style={[styles.emptySignalsCard, { backgroundColor: cardBg }]}>
                        <View style={[styles.emptySignalIcon, { backgroundColor: glassBg }]}>
                            <Ionicons name="notifications-off-outline" size={32} color={subtleText} />
                        </View>
                        <Text style={[styles.emptySignalTitle, { color: textColor }]}>No recent activity yet</Text>
                        <Text style={[styles.emptySignalSub, { color: subtleText }]}>
                            Complete more jobs to start receiving signals from customers.
                        </Text>
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Montserrat_700Bold',
        letterSpacing: -0.5,
    },
    headerIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(138, 146, 166, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },

    // Main Card
    mainCard: {
        padding: 24,
        borderRadius: 28,
        marginBottom: 24,
        overflow: 'hidden',
    },
    cardHighlight: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    mainCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    mainCardLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 13,
        marginBottom: 6,
    },
    mainCardValue: {
        color: '#fff',
        fontSize: 34,
        fontFamily: 'Montserrat_700Bold',
    },
    mainCardChip: {
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    chipText: {
        color: '#22C55E',
        fontSize: 11,
        fontWeight: 'bold',
    },
    mainCardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    miniStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    miniStatText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 12,
    },
    withdrawBtn: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    withdrawText: {
        color: NAVY,
        fontSize: 12,
        fontWeight: 'bold',
    },

    // Dash Stats
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 15,
    },
    dbStat: {
        flex: 1,
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(138, 146, 166, 0.1)',
    },
    dbStatIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    dbStatLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    dbStatValue: {
        fontSize: 22,
        fontFamily: 'Montserrat_700Bold',
        marginBottom: 4,
    },
    dbStatSub: {
        fontSize: 10,
        fontWeight: '600',
    },

    // Chart Box
    chartBox: {
        padding: 24,
        borderRadius: 28,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(138, 146, 166, 0.1)',
    },
    chartBoxHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    chartBoxTitle: {
        fontSize: 15,
        fontFamily: 'Montserrat_700Bold',
    },
    scrollHint: {
        fontSize: 10,
        color: PRIMARY,
        fontWeight: '600',
    },
    chartScroll: {
        marginHorizontal: -10,
    },

    // Peak Bars
    peakBarContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 100,
        paddingBottom: 20,
    },
    peakBarWrapper: {
        alignItems: 'center',
        flex: 1,
    },
    peakBar: {
        width: 4,
        borderRadius: 2,
    },
    hourLabel: {
        fontSize: 8,
        position: 'absolute',
        bottom: -18,
    },
    insightBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(212, 175, 55, 0.05)',
        padding: 12,
        borderRadius: 12,
        gap: 8,
        marginTop: 10,
    },
    insightText: {
        fontSize: 11,
        fontStyle: 'italic',
    },

    // Signals
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 10,
    },
    sectionHeader: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
    },
    viewAllText: {
        fontSize: 12,
        fontWeight: '700',
    },
    signalScroll: {
        marginHorizontal: -20,
        paddingLeft: 20,
    },
    signalCard: {
        padding: 16,
        borderRadius: 22,
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(138, 146, 166, 0.1)',
        height: 100,
        justifyContent: 'center',
    },
    signalTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    signalUser: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    userAvatar: {
        width: 28,
        height: 28,
        borderRadius: 10,
        backgroundColor: PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    signalName: {
        fontSize: 13,
        fontWeight: '700',
    },
    signalRating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    signalRatingText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    signalComment: {
        fontSize: 12,
        lineHeight: 16,
    },

    // Empty State
    emptySignalsCard: {
        padding: 30,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(138, 146, 166, 0.3)',
    },
    emptySignalIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptySignalTitle: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        marginBottom: 8,
    },
    emptySignalSub: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 20,
    },
});
