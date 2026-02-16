import LottieLoader from '@/components/LottieLoader';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');

// --- Helper: Generate SVG Path for a smooth line chart ---
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

// --- Sub-component: Stat Card (Redesigned) ---
const StatCard = ({ icon, iconBg, label, value, trend, trendUp, cardBg, textColor, subtleText, borderColor }: any) => (
    <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: borderColor || 'transparent' }]}>
        <View style={styles.statCardTop}>
            <View style={[styles.statIconContainer, { backgroundColor: iconBg }]}>
                <Ionicons name={icon} size={18} color="#fff" />
            </View>
            {trend !== undefined && (
                <View style={[styles.trendBadge, { backgroundColor: trendUp ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                    <Ionicons name={trendUp ? 'arrow-up' : 'arrow-down'} size={10} color={trendUp ? '#22C55E' : '#EF4444'} />
                    <Text style={{ color: trendUp ? '#22C55E' : '#EF4444', fontSize: 10, fontFamily: 'OpenSans_600SemiBold' }}>{trend}%</Text>
                </View>
            )}
        </View>
        <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: subtleText }]}>{label}</Text>
    </View>
);

export default function RiderAnalytics() {
    const { session } = useAuth();
    const { openMenu } = useRiderMenu();

    // Theme
    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#0A0A0A' }, 'background');
    const isDark = bgColor === '#0A0A0A';
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1B1B1B' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const subtleText = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');
    const chartLineColor = useThemeColor({ light: '#F27C22', dark: '#FF9F43' }, 'text');
    const chartGridColor = useThemeColor({ light: 'rgba(0,0,0,0.05)', dark: 'rgba(255,255,255,0.1)' }, 'text');

    // State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        totalEarnings: 0,
        completedTrips: 0,
        cancelledTrips: 0,
        avgRating: 0.0,
        totalReviews: 0,
        weeklyEarnings: [0, 0, 0, 0, 0, 0, 0], // Mon-Sun
        dailyTrips: [0, 0, 0, 0, 0, 0, 0],
    });

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        if (!session?.user.id) return;
        try {
            // 1. Rider Profile (Rating)
            const { data: rider } = await supabase.from('riders').select('average_rating').eq('user_id', session.user.id).single();

            // 2. Trips Stats
            const { data: trips } = await supabase
                .from('delivery_requests')
                .select('status, final_price, created_at')
                .eq('rider_id', session.user.id);

            // 3. Reviews Count
            const { count: reviewCount } = await supabase
                .from('reviews')
                .select('id', { count: 'exact', head: true })
                .eq('reviewee_id', session.user.id);

            if (trips && rider) {
                const completed = trips.filter(t => t.status === 'delivered');
                const cancelled = trips.filter(t => t.status === 'cancelled');
                const earnings = completed.reduce((acc, t) => acc + (Number(t.final_price) || 0), 0);

                // Calculate weekly data (last 7 days)
                const now = new Date();
                const weeklyEarnings = [0, 0, 0, 0, 0, 0, 0];
                const dailyTrips = [0, 0, 0, 0, 0, 0, 0];

                completed.forEach(trip => {
                    const tripDate = new Date(trip.created_at);
                    const daysAgo = Math.floor((now.getTime() - tripDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysAgo >= 0 && daysAgo < 7) {
                        const dayIndex = 6 - daysAgo; // 0 = 6 days ago, 6 = today
                        weeklyEarnings[dayIndex] += Number(trip.final_price) || 0;
                        dailyTrips[dayIndex] += 1;
                    }
                });

                setStats({
                    totalEarnings: earnings,
                    completedTrips: completed.length,
                    cancelledTrips: cancelled.length,
                    avgRating: rider.average_rating || 0.0,
                    totalReviews: reviewCount || 0,
                    weeklyEarnings,
                    dailyTrips,
                });
            }
        } catch (error) {
            console.error('Analytics fetch error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchAnalytics();
    };

    // Chart dimensions
    const chartWidth = width - 80;
    const chartHeight = 150;
    const maxEarning = Math.max(...stats.weeklyEarnings, 1000);
    const maxTrips = Math.max(...stats.dailyTrips, 5);

    // Pie chart data
    const totalTrips = stats.completedTrips + stats.cancelledTrips || 1;
    const completedPercent = (stats.completedTrips / totalTrips) * 100;
    const cancelledPercent = (stats.cancelledTrips / totalTrips) * 100;

    if (loading) {
        return (
            <View style={[styles.centerContainer, { backgroundColor: bgColor }]}>
                <LottieLoader size={120} />
            </View>
        );
    }

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bgColor} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu}>
                    <Ionicons name="menu" size={28} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Analytics</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <Ionicons name="refresh" size={24} color={textColor} />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F27C22']} />}
            >
                {/* 1. Premium Earnings Card */}
                <LinearGradient colors={['#1F2050', '#2C2E60']} style={styles.earningsCard}>
                    <View style={styles.earningsHeader}>
                        <Text style={styles.earningsLabel}>Total Earnings</Text>
                        <View style={styles.periodBadge}>
                            <Text style={styles.periodText}>All Time</Text>
                        </View>
                    </View>
                    <Text style={styles.earningsValue}>₦{stats.totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    <View style={styles.earningsFooter}>
                        <View style={styles.growthBadge}>
                            <Ionicons name="trending-up" size={14} color="#22C55E" />
                            <Text style={styles.growthText}>+12% this week</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* 2. Stats Grid */}
                <Text style={[styles.sectionTitle, { color: textColor }]}>Performance Overview</Text>
                <View style={styles.statsGrid}>
                    <StatCard
                        icon="checkmark-circle"
                        iconBg="#22C55E"
                        label="Completed"
                        value={stats.completedTrips}
                        trend={8}
                        trendUp={true}
                        cardBg={cardBg}
                        textColor={textColor}
                        subtleText={subtleText}
                    />
                    <StatCard
                        icon="close-circle"
                        iconBg="#EF4444"
                        label="Cancelled"
                        value={stats.cancelledTrips}
                        trend={2}
                        trendUp={false}
                        cardBg={cardBg}
                        textColor={textColor}
                        subtleText={subtleText}
                    />
                    <StatCard
                        icon="star"
                        iconBg="#F59E0B"
                        label="Avg Rating"
                        value={stats.avgRating.toFixed(1)}
                        cardBg={cardBg}
                        textColor={textColor}
                        subtleText={subtleText}
                    />
                    <StatCard
                        icon="chatbubbles"
                        iconBg="#3B82F6"
                        label="Reviews"
                        value={stats.totalReviews}
                        cardBg={cardBg}
                        textColor={textColor}
                        subtleText={subtleText}
                    />
                </View>

                {/* 3. Revenue Line Chart */}
                <View style={[styles.chartContainer, { backgroundColor: cardBg }]}>
                    <View style={styles.chartHeader}>
                        <Text style={[styles.chartTitle, { color: textColor }]}>Weekly Earnings</Text>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: chartLineColor }]} />
                            <Text style={[styles.legendText, { color: subtleText }]}>Earnings</Text>
                        </View>
                    </View>
                    <Svg height={chartHeight + 30} width={chartWidth + 50}>
                        {/* Grid Lines */}
                        {[0, 1, 2, 3, 4].map(i => (
                            <Line
                                key={i}
                                x1="40"
                                y1={10 + (i * chartHeight) / 4}
                                x2={chartWidth + 40}
                                y2={10 + (i * chartHeight) / 4}
                                stroke={chartGridColor}
                                strokeWidth="1"
                            />
                        ))}
                        {/* Y-Axis Labels */}
                        {[0, 1, 2, 3, 4].map(i => (
                            <SvgText
                                key={i}
                                x="5"
                                y={15 + (i * chartHeight) / 4}
                                fill={subtleText}
                                fontSize="10"
                            >
                                {Math.round(maxEarning - (i * maxEarning) / 4)}
                            </SvgText>
                        ))}
                        {/* Line Path */}
                        <Path
                            d={generateLinePath(stats.weeklyEarnings, chartWidth, chartHeight, maxEarning)}
                            fill="none"
                            stroke={chartLineColor}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            transform="translate(40, 10)"
                        />
                        {/* Data Points */}
                        {stats.weeklyEarnings.map((val, i) => (
                            <Circle
                                key={i}
                                cx={40 + (i * chartWidth) / 6}
                                cy={10 + chartHeight - (val / maxEarning) * chartHeight}
                                r="4"
                                fill={chartLineColor}
                            />
                        ))}
                        {/* X-Axis Labels */}
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                            <SvgText
                                key={day}
                                x={40 + (i * chartWidth) / 6}
                                y={chartHeight + 25}
                                fill={subtleText}
                                fontSize="10"
                                textAnchor="middle"
                            >
                                {day}
                            </SvgText>
                        ))}
                    </Svg>
                </View>

                {/* 4. Delivery Breakdown (Pie Chart) */}
                <View style={[styles.chartContainer, { backgroundColor: cardBg }]}>
                    <Text style={[styles.chartTitle, { color: textColor, marginBottom: 16 }]}>Delivery Breakdown</Text>
                    <View style={styles.pieRow}>
                        <Svg height="120" width="120">
                            <G rotation="-90" origin="60, 60">
                                {/* Cancelled (Red) */}
                                <Circle
                                    cx="60"
                                    cy="60"
                                    r="50"
                                    stroke="#EF4444"
                                    strokeWidth="20"
                                    fill="none"
                                    strokeDasharray={`${(cancelledPercent / 100) * 314} 314`}
                                />
                                {/* Completed (Green) */}
                                <Circle
                                    cx="60"
                                    cy="60"
                                    r="50"
                                    stroke="#22C55E"
                                    strokeWidth="20"
                                    fill="none"
                                    strokeDasharray={`${(completedPercent / 100) * 314} 314`}
                                    strokeDashoffset={-((cancelledPercent / 100) * 314)}
                                />
                            </G>
                            <SvgText x="60" y="65" textAnchor="middle" fill={textColor} fontSize="16" fontWeight="bold">
                                {totalTrips}
                            </SvgText>
                        </Svg>
                        <View style={styles.pieLegend}>
                            <View style={styles.pieLegendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
                                <Text style={[styles.legendText, { color: subtleText }]}>Completed ({completedPercent.toFixed(0)}%)</Text>
                            </View>
                            <View style={styles.pieLegendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                                <Text style={[styles.legendText, { color: subtleText }]}>Cancelled ({cancelledPercent.toFixed(0)}%)</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 5. Daily Trips Bar Chart */}
                <View style={[styles.chartContainer, { backgroundColor: cardBg, marginBottom: 30 }]}>
                    <Text style={[styles.chartTitle, { color: textColor, marginBottom: 16 }]}>Daily Trips (Last 7 Days)</Text>
                    <Svg height={chartHeight + 30} width={chartWidth}>
                        {/* Bars */}
                        {stats.dailyTrips.map((val, i) => {
                            const barHeight = (val / maxTrips) * chartHeight;
                            const barWidth = (chartWidth / 7) - 10;
                            return (
                                <React.Fragment key={i}>
                                    <Rect
                                        x={5 + i * (chartWidth / 7)}
                                        y={chartHeight - barHeight}
                                        width={barWidth}
                                        height={barHeight || 2}
                                        fill="#F27C22"
                                        rx="4"
                                    />
                                    <SvgText
                                        x={5 + i * (chartWidth / 7) + barWidth / 2}
                                        y={chartHeight + 20}
                                        fill={subtleText}
                                        fontSize="10"
                                        textAnchor="middle"
                                    >
                                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                                    </SvgText>
                                </React.Fragment>
                            );
                        })}
                    </Svg>
                </View>

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
        paddingTop: 50,
        paddingBottom: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Montserrat_600SemiBold',
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },

    // Earnings Card
    earningsCard: {
        padding: 24,
        borderRadius: 20,
        marginBottom: 24,
    },
    earningsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    earningsLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        fontFamily: 'OpenSans_400Regular',
    },
    periodBadge: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    periodText: {
        color: '#fff',
        fontSize: 11,
        fontFamily: 'OpenSans_600SemiBold',
    },
    earningsValue: {
        color: '#fff',
        fontSize: 36,
        fontFamily: 'Montserrat_700Bold',
        marginBottom: 12,
    },
    earningsFooter: {
        flexDirection: 'row',
    },
    growthBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    growthText: {
        color: '#22C55E',
        fontSize: 12,
        fontFamily: 'OpenSans_600SemiBold',
    },

    // Section Title
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Montserrat_600SemiBold',
        marginBottom: 16,
    },

    // Stats Grid
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    statCard: {
        width: (width - 52) / 2,
        padding: 16,
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)',
    },
    statCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    statIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statValue: {
        fontSize: 26,
        fontFamily: 'Montserrat_700Bold',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 13,
        fontFamily: 'OpenSans_400Regular',
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 2,
    },

    // Chart Container
    chartContainer: {
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    chartTitle: {
        fontSize: 16,
        fontFamily: 'Montserrat_600SemiBold',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 11,
        fontFamily: 'OpenSans_400Regular',
    },

    // Pie Chart
    pieRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    pieLegend: {
        gap: 12,
    },
    pieLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
});
