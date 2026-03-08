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
import React, { useEffect, useMemo, useState } from 'react';
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
const formatCurrency = (amount: number) => `NGN ${Math.round(amount).toLocaleString()}`;

const formatMinutes = (minutes: number) => {
    if (!minutes || minutes <= 0) return 'No data yet';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
};

const generateLinePath = (data: number[], chartWidth: number, chartHeight: number, maxValue: number) => {
    if (data.length === 0) return '';
    const safeMax = Math.max(maxValue, 1);
    const stepX = chartWidth / (data.length - 1 || 1);
    let path = `M 0 ${chartHeight - (data[0] / safeMax) * chartHeight}`;
    for (let i = 1; i < data.length; i++) {
        const x = i * stepX;
        const y = chartHeight - (data[i] / safeMax) * chartHeight;
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
const DashboardStat = ({ icon, label, value, subtext, description, color, cardBg, textColor, subtleText }: any) => (
    <View style={[styles.dbStat, { backgroundColor: cardBg }]}>
        <View style={[styles.dbStatIcon, { backgroundColor: `${color}15` }]}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.dbStatLabel, { color: subtleText }]}>{label}</Text>
        <Text style={[styles.dbStatValue, { color: textColor }]}>{value}</Text>
        {subtext && <Text style={[styles.dbStatSub, { color: color }]}>{subtext}</Text>}
        {description && <Text style={[styles.dbStatDesc, { color: subtleText }]}>{description}</Text>}
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
    const [loadError, setLoadError] = useState<string | null>(null);
    const [stats, setStats] = useState({
        walletBalance: 0,
        totalEarnings: 0,
        previousEarnings: 0,
        completedJobs: 0,
        startedJobs: 0,
        cancelledJobs: 0,
        activeJobsNow: 0,
        completionRate: 0,
        cancellationRate: 0,
        avgRating: 0.0,
        avgCompletionMinutes: 0,
        avgEarningsPerJob: 0,
        activeDays: 0,
        streakDays: 0,
        performanceScore: 0,
        thirtyDayEarnings: [] as number[],
        peakHours: Array(24).fill(0),
        weeklyActivity: Array.from({ length: 7 }, () => ({ label: '', completed: 0, cancelled: 0 })),
        topHours: [] as Array<{ label: string; count: number }>,
        jobBreakdown: { deliveries: 0, orders: 0 },
        workMix: { rides: 0, packages: 0, food: 0, store: 0 },
        recentReviews: [] as any[],
    });

    useEffect(() => {
        fetchAdvancedAnalytics();
    }, [session?.user.id]);

    const fetchAdvancedAnalytics = async () => {
        if (!session?.user.id) return;
        try {
            setLoadError(null);
            setLoading(true);

            // Fetch Data Range
            const today = new Date();
            const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
            thirtyDaysAgo.setHours(0, 0, 0, 0);
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 59);
            sixtyDaysAgo.setHours(0, 0, 0, 0);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const [riderRes, walletRes, delRes, ordRes, reviewsRes] = await Promise.all([
                supabase.from('riders').select('average_rating').eq('user_id', session.user.id).maybeSingle(),
                supabase.from('wallets').select('id, balance').eq('user_id', session.user.id).eq('type', 'rider').maybeSingle(),
                supabase
                    .from('delivery_requests')
                    .select('status, created_at, updated_at, final_price, offered_price, request_type')
                    .eq('rider_id', session.user.id)
                    .gte('created_at', thirtyDaysAgo.toISOString()),
                supabase
                    .from('orders')
                    .select('status, created_at, updated_at, delivery_fee, store_id')
                    .eq('rider_id', session.user.id)
                    .gte('created_at', thirtyDaysAgo.toISOString()),
                supabase
                    .from('rider_reviews')
                    .select('id, rating, comment, created_at, reviewer_id')
                    .eq('rider_id', session.user.id)
                    .order('created_at', { ascending: false })
                    .limit(4)
            ]);

            if (delRes.error) throw delRes.error;
            if (ordRes.error) throw ordRes.error;
            if (reviewsRes.error) {
                console.warn('Rider reviews query failed:', reviewsRes.error);
            }

            const rider = riderRes.data;
            const wallet = walletRes.data;
            let transactions: any[] = [];
            if (wallet?.id) {
                const transRes = await supabase
                    .from('transactions')
                    .select('amount, created_at')
                    .eq('wallet_id', wallet.id)
                    .eq('type', 'credit')
                    .gte('created_at', sixtyDaysAgo.toISOString())
                    .order('created_at', { ascending: true });
                if (transRes.error) throw transRes.error;
                transactions = transRes.data || [];
            }
            const deliveries = delRes.data || [];
            const orders = ordRes.data || [];
            const reviews = reviewsRes.data || [];

            // 1. 30-day and previous 30-day earnings
            const previousWindowStart = sixtyDaysAgo.getTime();
            const thirtyWindowStart = thirtyDaysAgo.getTime();
            const thirtyWindowEnd = new Date(thirtyDaysAgo.getTime() + 30 * 24 * 60 * 60 * 1000).getTime();
            const currentPeriodTransactions = transactions.filter((t: any) => {
                const ms = new Date(t.created_at).getTime();
                return ms >= thirtyWindowStart && ms < thirtyWindowEnd;
            });
            const previousPeriodTransactions = transactions.filter((t: any) => {
                const ms = new Date(t.created_at).getTime();
                return ms >= previousWindowStart && ms < thirtyWindowStart;
            });
            const currentPeriodEarnings = currentPeriodTransactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
            const previousPeriodEarnings = previousPeriodTransactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

            // 2. Process 30-day earnings trend
            const dailyEarnings = Array(30).fill(0);
            currentPeriodTransactions.forEach((t: any) => {
                const date = new Date(t.created_at);
                const diff = Math.floor((dayStart - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / (1000 * 60 * 60 * 24));
                if (diff >= 0 && diff < 30) dailyEarnings[29 - diff] += Number(t.amount);
            });

            // 3. Build normalized job stream
            const normalizedJobs = [
                ...deliveries.map((job: any) => ({
                    status: (job.status || '').toLowerCase(),
                    createdAt: new Date(job.created_at),
                    updatedAt: job.updated_at ? new Date(job.updated_at) : new Date(job.created_at),
                    earnings: Number(job.final_price ?? job.offered_price ?? 0),
                    kind: job.request_type === 'ride' ? 'ride' : 'package',
                })),
                ...orders.map((job: any) => ({
                    status: (job.status || '').toLowerCase(),
                    createdAt: new Date(job.created_at),
                    updatedAt: job.updated_at ? new Date(job.updated_at) : new Date(job.created_at),
                    earnings: Number(job.delivery_fee ?? 0),
                    kind: job.store_id ? 'store' : 'food',
                })),
            ];

            const isCompleted = (status: string) => ['delivered', 'completed'].includes(status);
            const isCancelled = (status: string) => ['cancelled', 'rejected', 'declined'].includes(status);
            const isStarted = (status: string) => !['pending', 'invited', 'expired'].includes(status);

            const completedJobs = normalizedJobs.filter(j => isCompleted(j.status));
            const cancelledJobs = normalizedJobs.filter(j => isCancelled(j.status));
            const startedJobs = normalizedJobs.filter(j => isStarted(j.status));
            const activeJobsNow = normalizedJobs.filter(j => ['accepted', 'picked_up', 'with_rider', 'out_for_delivery', 'ready', 'preparing'].includes(j.status)).length;

            // 4. Peak Hours (0-23)
            const hourStats = Array(24).fill(0);
            startedJobs.forEach(j => {
                const hour = j.createdAt.getHours();
                hourStats[hour] += 1;
            });

            const topHours = hourStats
                .map((count, hour) => ({ count, hour }))
                .filter(h => h.count > 0)
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
                .map(h => ({
                    label: `${h.hour.toString().padStart(2, '0')}:00 - ${(h.hour + 1).toString().padStart(2, '0')}:00`,
                    count: h.count,
                }));

            // 5. Efficiency and rates
            const validDurations = completedJobs
                .map(j => (j.updatedAt.getTime() - j.createdAt.getTime()) / (1000 * 60))
                .filter((mins: number) => mins > 0 && mins <= 720);
            const avgCompletionMinutes = validDurations.length > 0
                ? validDurations.reduce((sum: number, mins: number) => sum + mins, 0) / validDurations.length
                : 0;

            const completionRate = startedJobs.length > 0 ? (completedJobs.length / startedJobs.length) * 100 : 0;
            const cancellationRate = startedJobs.length > 0 ? (cancelledJobs.length / startedJobs.length) * 100 : 0;
            const avgEarningsPerJob = completedJobs.length > 0
                ? (currentPeriodEarnings > 0
                    ? currentPeriodEarnings / completedJobs.length
                    : completedJobs.reduce((sum: number, j: any) => sum + j.earnings, 0) / completedJobs.length)
                : 0;

            // 6. Consistency metrics (active days + streak)
            const activeDaySet = new Set<number>();
            [...currentPeriodTransactions, ...completedJobs].forEach((item: any) => {
                const date = new Date(item.created_at || item.createdAt || item.updatedAt);
                activeDaySet.add(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime());
            });
            const activeDays = activeDaySet.size;
            let streakDays = 0;
            for (let i = 0; i < 30; i += 1) {
                const day = dayStart - i * 24 * 60 * 60 * 1000;
                if (activeDaySet.has(day)) streakDays += 1;
                else break;
            }

            // 7. Weekly activity
            const weeklyActivity = Array.from({ length: 7 }, (_, idx) => {
                const day = new Date(sevenDaysAgo.getTime() + idx * 24 * 60 * 60 * 1000);
                return {
                    label: day.toLocaleDateString('en-US', { weekday: 'short' }),
                    completed: 0,
                    cancelled: 0,
                };
            });
            startedJobs.forEach((job: any) => {
                const created = job.createdAt;
                if (created < sevenDaysAgo) return;
                const diff = Math.floor((dayStart - new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime()) / (24 * 60 * 60 * 1000));
                const index = 6 - diff;
                if (index < 0 || index > 6) return;
                if (isCompleted(job.status)) weeklyActivity[index].completed += 1;
                else if (isCancelled(job.status)) weeklyActivity[index].cancelled += 1;
            });

            // 8. Work mix
            const workMix = { rides: 0, packages: 0, food: 0, store: 0 };
            completedJobs.forEach((job: any) => {
                if (job.kind === 'ride') workMix.rides += 1;
                else if (job.kind === 'package') workMix.packages += 1;
                else if (job.kind === 'store') workMix.store += 1;
                else workMix.food += 1;
            });

            // 9. Composite performance score
            const ratingScore = Math.min(100, Math.max(0, ((Number(rider?.average_rating || 0) / 5) * 100)));
            const completionScore = Math.min(100, Math.max(0, completionRate));
            const consistencyScore = Math.min(100, Math.max(0, (activeDays / 30) * 100));
            const speedScore = avgCompletionMinutes > 0 ? Math.min(100, Math.max(20, 100 - (avgCompletionMinutes - 25) * 1.2)) : 50;
            const performanceScore = Math.round(
                completionScore * 0.4 +
                ratingScore * 0.25 +
                consistencyScore * 0.2 +
                speedScore * 0.15
            );

            const reviewerIds = [...new Set(
                reviews
                    .map((review: any) => review.reviewer_id)
                    .filter((id: any) => typeof id === 'string' && id.length > 0)
            )] as string[];
            let reviewerProfileMap: Record<string, { first_name?: string; last_name?: string }> = {};
            if (reviewerIds.length > 0) {
                const { data: profileRows, error: profileErr } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name')
                    .in('id', reviewerIds);
                if (profileErr) {
                    console.warn('Reviewer profiles query failed:', profileErr);
                } else {
                    reviewerProfileMap = (profileRows || []).reduce((acc: any, profile: any) => {
                        acc[profile.id] = { first_name: profile.first_name, last_name: profile.last_name };
                        return acc;
                    }, {});
                }
            }

            const normalizedReviews = reviews.map((review: any) => {
                const profile = reviewerProfileMap[review.reviewer_id] || null;
                return {
                    ...review,
                    reviewerName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Customer',
                };
            });

            setStats({
                walletBalance: Number(wallet?.balance) || 0,
                totalEarnings: currentPeriodEarnings,
                previousEarnings: previousPeriodEarnings,
                completedJobs: completedJobs.length,
                startedJobs: startedJobs.length,
                cancelledJobs: cancelledJobs.length,
                activeJobsNow,
                completionRate,
                cancellationRate,
                avgRating: Number(rider?.average_rating || 0),
                avgCompletionMinutes,
                avgEarningsPerJob,
                activeDays,
                streakDays,
                performanceScore,
                thirtyDayEarnings: dailyEarnings,
                peakHours: hourStats,
                weeklyActivity,
                topHours,
                jobBreakdown: {
                    deliveries: workMix.rides + workMix.packages,
                    orders: workMix.food + workMix.store,
                },
                workMix,
                recentReviews: normalizedReviews,
            });

        } catch (error) {
            console.error('Advanced Analytics Error:', error);
            setLoadError('Could not load rider analytics right now. Pull to refresh and try again.');
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
    const maxWeeklyJobs = Math.max(
        ...stats.weeklyActivity.map((day: any) => day.completed + day.cancelled),
        1
    );
    const workMixTotal = stats.workMix.rides + stats.workMix.packages + stats.workMix.food + stats.workMix.store;
    const earningsDelta = stats.previousEarnings > 0
        ? ((stats.totalEarnings - stats.previousEarnings) / stats.previousEarnings) * 100
        : (stats.totalEarnings > 0 ? 100 : 0);
    const performanceBand = useMemo(() => {
        if (stats.performanceScore >= 85) return 'Excellent';
        if (stats.performanceScore >= 70) return 'Strong';
        if (stats.performanceScore >= 55) return 'Growing';
        return 'Needs focus';
    }, [stats.performanceScore]);
    const performanceColor = stats.performanceScore >= 85 ? SUCCESS : stats.performanceScore >= 70 ? '#84CC16' : stats.performanceScore >= 55 ? '#F59E0B' : ERROR;
    const earningsDeltaLabel = `${earningsDelta >= 0 ? '+' : ''}${earningsDelta.toFixed(1)}%`;

    if (loading) return <View style={[styles.centerContainer, { backgroundColor: bgColor }]}><LottieLoader size={120} /></View>;

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bgColor} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu} style={styles.headerIcon}>
                    <Ionicons name="grid-outline" size={24} color={textColor} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <ThemedText style={styles.headerTitle}>Rider Analytics</ThemedText>
                    <Text style={[styles.headerSub, { color: subtleText }]}>Clear metrics for smarter work decisions</Text>
                </View>
                <TouchableOpacity onPress={onRefresh} style={styles.headerIcon}>
                    <Ionicons name="stats-chart" size={24} color={PRIMARY} />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />}
            >
                {loadError && (
                    <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FFE9E9' }]}>
                        <Ionicons name="alert-circle-outline" size={18} color={ERROR} />
                        <Text style={[styles.errorText, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>{loadError}</Text>
                    </View>
                )}

                {/* 1. Performance Summary */}
                <LinearGradient colors={[isDark ? '#1F2050' : '#2C2E60', '#121338']} style={styles.mainCard}>
                    <View style={styles.cardHighlight} />
                    <View style={styles.mainCardTop}>
                        <View style={styles.mainCardTopLeft}>
                            <Text style={styles.mainCardLabel}>Performance Score</Text>
                            <Text style={styles.mainCardValue}>{stats.performanceScore}/100</Text>
                            <Text style={styles.mainCardExplain}>
                                Based on completion rate, customer rating, delivery speed, and consistency over the last 30 days.
                            </Text>
                        </View>
                        <View style={[styles.mainCardChip, { backgroundColor: `${performanceColor}22` }]}>
                            <Text style={[styles.chipText, { color: performanceColor }]}>{performanceBand}</Text>
                        </View>
                    </View>
                    <View style={styles.mainCardBottom}>
                        <View style={styles.miniStat}>
                            <Ionicons name="flash" size={12} color={GOLD} />
                            <Text style={styles.miniStatText}>
                                {stats.activeJobsNow} active now. Streak: {stats.streakDays} day{stats.streakDays === 1 ? '' : 's'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.withdrawBtn}
                            onPress={() => router.push('/rider/wallet')}
                        >
                            <Text style={styles.withdrawText}>{formatCurrency(stats.walletBalance)}</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* 2. Key Metrics */}
                <View style={styles.statsGrid}>
                    <DashboardStat
                        icon="checkmark-done-outline"
                        label="Completion Rate"
                        value={`${stats.completionRate.toFixed(1)}%`}
                        subtext={`${stats.completedJobs}/${stats.startedJobs} started jobs completed`}
                        description="Shows how reliably you finish accepted jobs."
                        color={PRIMARY}
                        cardBg={cardBg}
                        textColor={textColor}
                        subtleText={subtleText}
                    />
                    <DashboardStat
                        icon="close-circle-outline"
                        label="Cancellation Rate"
                        value={`${stats.cancellationRate.toFixed(1)}%`}
                        subtext={`${stats.cancelledJobs} jobs cancelled`}
                        description="Tracks cancelled jobs after you started them."
                        color={ERROR}
                        cardBg={cardBg}
                        textColor={textColor}
                        subtleText={subtleText}
                    />
                    <DashboardStat
                        icon="timer-outline"
                        label="Avg Completion Time"
                        value={formatMinutes(stats.avgCompletionMinutes)}
                        subtext="From pickup to completion"
                        description="Lower time usually means more jobs per day."
                        color={SUCCESS}
                        cardBg={cardBg}
                        textColor={textColor}
                        subtleText={subtleText}
                    />
                    <DashboardStat
                        icon="cash-outline"
                        label="Average Earnings / Job"
                        value={formatCurrency(stats.avgEarningsPerJob)}
                        subtext={`${formatCurrency(stats.totalEarnings)} earned in last 30 days`}
                        description="Helps estimate revenue quality of accepted jobs."
                        color={GOLD}
                        cardBg={cardBg}
                        textColor={textColor}
                        subtleText={subtleText}
                    />
                </View>

                {/* 3. Revenue Trend */}
                <View style={[styles.chartBox, { backgroundColor: cardBg }]}>
                    <View style={styles.chartBoxHeader}>
                        <Text style={[styles.chartBoxTitle, { color: textColor }]}>30-Day Revenue Trend</Text>
                        <Text style={styles.scrollHint}>Swipe for full range</Text>
                    </View>
                    <Text style={[styles.chartDescription, { color: subtleText }]}>
                        Daily payout movement from credits in your rider wallet over the last 30 days.
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
                        <Svg height={chartHeight + 40} width={trendChartWidth}>
                            <Defs>
                                <SvgGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor={PRIMARY} stopOpacity="0.3" />
                                    <Stop offset="1" stopColor={PRIMARY} stopOpacity="0.0" />
                                </SvgGradient>
                            </Defs>
                            <Path
                                d={generateAreaPath(stats.thirtyDayEarnings, trendChartWidth, chartHeight, maxEarning)}
                                fill="url(#grad)"
                                transform="translate(0, 10)"
                            />
                            <Path
                                d={generateLinePath(stats.thirtyDayEarnings, trendChartWidth, chartHeight, maxEarning)}
                                fill="none"
                                stroke={PRIMARY}
                                strokeWidth="3"
                                strokeLinecap="round"
                                transform="translate(0, 10)"
                            />
                            {stats.thirtyDayEarnings.map((_, i) => {
                                if (i % 5 !== 0) return null;
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
                    <View style={styles.kpiRow}>
                        <View style={[styles.kpiCard, { backgroundColor: glassBg }]}>
                            <Text style={[styles.kpiLabel, { color: subtleText }]}>30-day earnings</Text>
                            <Text style={[styles.kpiValue, { color: textColor }]}>{formatCurrency(stats.totalEarnings)}</Text>
                        </View>
                        <View style={[styles.kpiCard, { backgroundColor: glassBg }]}>
                            <Text style={[styles.kpiLabel, { color: subtleText }]}>Vs previous 30 days</Text>
                            <Text style={[styles.kpiValue, { color: earningsDelta >= 0 ? SUCCESS : ERROR }]}>{earningsDeltaLabel}</Text>
                        </View>
                    </View>
                </View>

                {/* 4. Demand Timing */}
                <View style={[styles.chartBox, { backgroundColor: cardBg }]}>
                    <Text style={[styles.chartBoxTitle, { color: textColor }]}>Demand by Hour</Text>
                    <Text style={[styles.chartDescription, { color: subtleText }]}>
                        Shows when you usually receive and start jobs so you can plan your online hours.
                    </Text>
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
                                : 'No activity data for the selected period.'}
                        </Text>
                    </View>
                    {stats.topHours.length > 0 && (
                        <View style={styles.topHoursRow}>
                            {stats.topHours.map((hour, idx) => (
                                <View key={`${hour.label}-${idx}`} style={[styles.topHourChip, { backgroundColor: glassBg }]}>
                                    <Text style={[styles.topHourLabel, { color: textColor }]}>{hour.label}</Text>
                                    <Text style={[styles.topHourCount, { color: PRIMARY }]}>{hour.count} jobs</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* 5. Work Mix */}
                <View style={[styles.chartBox, { backgroundColor: cardBg }]}>
                    <Text style={[styles.chartBoxTitle, { color: textColor }]}>Work Mix Breakdown</Text>
                    <Text style={[styles.chartDescription, { color: subtleText }]}>
                        Understand which job type contributes most to your completed work.
                    </Text>
                    {[
                        { key: 'rides', label: 'Passenger rides', value: stats.workMix.rides, color: '#3B82F6' },
                        { key: 'packages', label: 'Package delivery', value: stats.workMix.packages, color: '#8B5CF6' },
                        { key: 'food', label: 'Food orders', value: stats.workMix.food, color: '#F59E0B' },
                        { key: 'store', label: 'Store orders', value: stats.workMix.store, color: '#14B8A6' },
                    ].map((row) => {
                        const ratio = workMixTotal > 0 ? row.value / workMixTotal : 0;
                        const ratioWidth = `${ratio * 100}%` as `${number}%`;
                        return (
                            <View key={row.key} style={styles.mixRow}>
                                <View style={styles.mixHeader}>
                                    <Text style={[styles.mixLabel, { color: textColor }]}>{row.label}</Text>
                                    <Text style={[styles.mixValue, { color: subtleText }]}>
                                        {row.value} jobs ({(ratio * 100).toFixed(0)}%)
                                    </Text>
                                </View>
                                <View style={[styles.mixTrack, { backgroundColor: glassBg }]}>
                                    <View style={[styles.mixFill, { width: ratioWidth, backgroundColor: row.color }]} />
                                </View>
                            </View>
                        );
                    })}
                    {workMixTotal === 0 && (
                        <Text style={[styles.mixEmpty, { color: subtleText }]}>
                            No completed jobs yet in this period, so work mix is still empty.
                        </Text>
                    )}
                </View>

                {/* 6. Weekly Reliability */}
                <View style={[styles.chartBox, { backgroundColor: cardBg }]}>
                    <Text style={[styles.chartBoxTitle, { color: textColor }]}>Weekly Reliability</Text>
                    <Text style={[styles.chartDescription, { color: subtleText }]}>
                        Completed and cancelled job ratio by day for the most recent 7 days.
                    </Text>
                    {stats.weeklyActivity.map((day, idx) => {
                        const total = day.completed + day.cancelled;
                        const scaledWidth = (total > 0 ? `${Math.max(8, (total / maxWeeklyJobs) * 100)}%` : '0%') as `${number}%`;
                        const completedWidth = (total > 0 ? `${(day.completed / total) * 100}%` : '0%') as `${number}%`;
                        const cancelledWidth = (total > 0 ? `${(day.cancelled / total) * 100}%` : '0%') as `${number}%`;
                        return (
                            <View key={`weekly-${idx}-${day.label || 'unknown'}`} style={styles.weeklyRow}>
                                <View style={styles.weeklyMeta}>
                                    <Text style={[styles.weeklyDay, { color: textColor }]}>{day.label || `Day ${idx + 1}`}</Text>
                                    <Text style={[styles.weeklyCount, { color: subtleText }]}>
                                        {day.completed} done / {day.cancelled} cancelled
                                    </Text>
                                </View>
                                <View style={[styles.weeklyTrack, { backgroundColor: glassBg }]}>
                                    <View style={[styles.weeklyClip, { width: scaledWidth }]}>
                                        <View style={[styles.weeklyCompleted, { width: completedWidth }]} />
                                        <View style={[styles.weeklyCancelled, { width: cancelledWidth }]} />
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* 7. Recent Performance Signals */}
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
                                            <Text style={styles.avatarText}>{(review.reviewerName?.[0] || 'C').toUpperCase()}</Text>
                                        </View>
                                        <Text style={[styles.signalName, { color: textColor }]}>{review.reviewerName}</Text>
                                    </View>
                                    <View style={styles.signalRating}>
                                        <Ionicons name="star" size={12} color={GOLD} />
                                        <Text style={[styles.signalRatingText, { color: textColor }]}>{review.rating}</Text>
                                    </View>
                                </View>
                                <Text style={[styles.signalComment, { color: subtleText }]} numberOfLines={2}>
                                    "{review.comment || 'No written feedback yet.'}"
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
    headerSub: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: '600',
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
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
        gap: 8,
    },
    errorText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '600',
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
    mainCardTopLeft: {
        flex: 1,
        paddingRight: 12,
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
    mainCardExplain: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 12,
        lineHeight: 18,
        marginTop: 8,
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
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 12,
    },
    dbStat: {
        width: '48%',
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
    dbStatDesc: {
        fontSize: 11,
        lineHeight: 16,
        marginTop: 8,
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
        marginBottom: 10,
    },
    chartBoxTitle: {
        fontSize: 15,
        fontFamily: 'Montserrat_700Bold',
    },
    chartDescription: {
        fontSize: 12,
        lineHeight: 18,
        marginBottom: 14,
    },
    scrollHint: {
        fontSize: 10,
        color: PRIMARY,
        fontWeight: '600',
    },
    chartScroll: {
        marginHorizontal: -10,
    },
    kpiRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
    },
    kpiCard: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
    },
    kpiLabel: {
        fontSize: 10,
        marginBottom: 4,
    },
    kpiValue: {
        fontSize: 15,
        fontFamily: 'Montserrat_700Bold',
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
        flex: 1,
    },
    topHoursRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    topHourChip: {
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    topHourLabel: {
        fontSize: 10,
        fontWeight: '700',
    },
    topHourCount: {
        fontSize: 11,
        marginTop: 2,
        fontWeight: '700',
    },

    // Work Mix
    mixRow: {
        marginBottom: 14,
    },
    mixHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    mixLabel: {
        fontSize: 12,
        fontWeight: '700',
    },
    mixValue: {
        fontSize: 11,
        fontWeight: '600',
    },
    mixTrack: {
        height: 8,
        borderRadius: 999,
        overflow: 'hidden',
    },
    mixFill: {
        height: 8,
        borderRadius: 999,
    },
    mixEmpty: {
        marginTop: 6,
        fontSize: 11,
        lineHeight: 16,
    },

    // Weekly Reliability
    weeklyRow: {
        marginBottom: 12,
    },
    weeklyMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    weeklyDay: {
        fontSize: 12,
        fontWeight: '700',
    },
    weeklyCount: {
        fontSize: 11,
        fontWeight: '600',
    },
    weeklyTrack: {
        height: 9,
        borderRadius: 999,
        overflow: 'hidden',
    },
    weeklyClip: {
        height: 9,
        borderRadius: 999,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    weeklyCompleted: {
        backgroundColor: SUCCESS,
        height: 9,
    },
    weeklyCancelled: {
        backgroundColor: ERROR,
        height: 9,
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
