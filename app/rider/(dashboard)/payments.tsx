import LottieLoader from '@/components/LottieLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useWallet } from '@/contexts/wallet';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

// --- Components ---

const HeroCard = ({ title, value, subtitle, icon, color, gradientColors }: any) => {
    return (
        <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
        >
            <View style={styles.heroContent}>
                <View style={[styles.heroIconContainer, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <Ionicons name={icon} size={24} color="#fff" />
                </View>
                <View>
                    <ThemedText style={styles.heroTitle}>{title}</ThemedText>
                    <ThemedText style={styles.heroValue}>₦{value}</ThemedText>
                    {subtitle && <ThemedText style={styles.heroSubtitle}>{subtitle}</ThemedText>}
                </View>
            </View>
            {/* Decorative circles */}
            <View style={[styles.circle, { width: 100, height: 100, top: -30, right: -30, opacity: 0.1 }]} />
            <View style={[styles.circle, { width: 60, height: 60, bottom: -20, left: 20, opacity: 0.1 }]} />
        </LinearGradient>
    );
};

const TransactionItem = ({ item, type, icon, color, textColor, cardBg }: any) => {
    const isCredit = type === 'credit';
    const amountColor = isCredit ? '#22c55e' : '#ef4444';
    const bgColor = isCredit ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';

    return (
        <View style={[styles.transactionItem, { backgroundColor: cardBg }]}>
            <View style={[styles.txIconContainer, { backgroundColor: bgColor }]}>
                <Ionicons name={icon} size={20} color={amountColor} />
            </View>
            <View style={styles.txContent}>
                <ThemedText style={[styles.txTitle, { color: textColor }]}>{item.description || (type === 'credit' ? 'Delivery Earning' : 'Withdrawal')}</ThemedText>
                <ThemedText style={[styles.txDate, { color: textColor, opacity: 0.6 }]}>
                    {new Date(item.created_at || item.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} • {new Date(item.created_at || item.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <ThemedText style={[styles.txAmount, { color: amountColor }]}>
                    {isCredit ? '+' : '-'}₦{(item.amount || item.final_price || 0).toLocaleString()}
                </ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'processed' || item.status === 'delivered' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)' }]}>
                    <ThemedText style={[styles.statusText, { color: item.status === 'processed' || item.status === 'delivered' ? '#22c55e' : '#f59e0b' }]}>
                        {item.status === 'processed' ? 'Success' : item.status}
                    </ThemedText>
                </View>
            </View>
        </View>
    );
};


export default function RiderPaymentsPage() {
    const router = useRouter();
    const { openMenu } = useRiderMenu();
    const { session } = useAuth();
    const { riderWallet, refreshWallet } = useWallet();

    // Theme
    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#121212' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1E1E1E' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const iconColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');

    // State
    const [todaysEarnings, setTodaysEarnings] = useState(0);
    const [weeklyEarnings, setWeeklyEarnings] = useState(0);
    const [pendingPayouts, setPendingPayouts] = useState(0);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (session?.user.id && riderWallet?.rider_id) {
            fetchData();
        }
    }, [session?.user.id, riderWallet?.rider_id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            await refreshWallet();

            if (!riderWallet?.rider_id) return;

            // 1. Today's Earnings
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const { data: todayJobs } = await supabase
                .from('delivery_requests')
                .select('final_price')
                .eq('rider_id', riderWallet.rider_id)
                .eq('status', 'delivered')
                .gte('updated_at', startOfDay.toISOString());

            if (todayJobs) {
                const sum = todayJobs.reduce((acc, job) => acc + (Number(job.final_price) || 0), 0);
                setTodaysEarnings(sum);
            }

            // 2. Weekly Earnings (Last 7 Days)
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - 7); // Rolling 7 days
            startOfWeek.setHours(0, 0, 0, 0);

            const { data: weekJobs } = await supabase
                .from('delivery_requests')
                .select('final_price')
                .eq('rider_id', riderWallet.rider_id)
                .eq('status', 'delivered')
                .gte('updated_at', startOfWeek.toISOString());

            if (weekJobs) {
                const sum = weekJobs.reduce((acc, job) => acc + (Number(job.final_price) || 0), 0);
                setWeeklyEarnings(sum);
            }

            // 3. Pending Payouts & Recent Activity
            // Fetch recent wallet transactions (both credits and debits if possible, but for now focusing on withdrawals and earnings)

            // Fetch recent earnings
            const { data: earnings } = await supabase
                .from('delivery_requests')
                .select('id, final_price, status, updated_at')
                .eq('rider_id', riderWallet.rider_id)
                .in('status', ['delivered'])
                .order('updated_at', { ascending: false })
                .limit(10);

            // Fetch recent withdrawals (debits)
            const { data: withdrawals } = await supabase
                .from('transactions')
                .select('*')
                .eq('wallet_id', riderWallet?.id)
                .eq('type', 'debit')
                .order('created_at', { ascending: false })
                .limit(10);

            // Calculate pending payouts
            if (withdrawals) {
                const pendingSum = withdrawals
                    .filter((w: any) => w.status === 'pending')
                    .reduce((acc, w) => acc + (Number(w.amount) || 0), 0);
                setPendingPayouts(pendingSum);
            }

            // Merge and sort transactions for the list
            const combined = [
                ...(earnings?.map(e => ({ ...e, type: 'credit', description: `Order #${e.id.substring(0, 5).toUpperCase()}` })) || []),
                ...(withdrawals?.map(w => ({ ...w, type: 'debit', description: 'Withdrawal Request' })) || [])
            ].sort((a, b) => new Date(b.created_at || b.updated_at).getTime() - new Date(a.created_at || a.updated_at).getTime())
                .slice(0, 20);

            setRecentTransactions(combined);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    }

    if (loading && !riderWallet && !refreshing) {
        return (
            <View style={[styles.center, { backgroundColor: bgColor }]}>
                <LottieLoader size={120} />
            </View>
        );
    }

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu} style={styles.headerBtn}>
                    <Ionicons name="menu-outline" size={28} color={textColor} />
                </TouchableOpacity>
                <ThemedText style={styles.headerTitle}>Payments</ThemedText>
                <TouchableOpacity onPress={() => router.push('/rider/wallet')} style={styles.headerBtn}>
                    <Ionicons name="wallet-outline" size={24} color={textColor} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f27c22" />}
            >

                {/* Hero Stats Carousel */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselContent}
                    decelerationRate="fast"
                    snapToInterval={width * 0.85 + 16}
                >
                    <View style={styles.cardWrapper}>
                        <HeroCard
                            title="Total Balance"
                            value={riderWallet?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                            icon="wallet"
                            gradientColors={['#1F2050', '#4a4b8a']}
                            subtitle="Available for withdrawal"
                        />
                    </View>
                    <View style={styles.cardWrapper}>
                        <HeroCard
                            title="Today's Earnings"
                            value={todaysEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            icon="sunny"
                            gradientColors={['#f97316', '#fb923c']}
                            subtitle="Earned so far today"
                        />
                    </View>
                    <View style={styles.cardWrapper}>
                        <HeroCard
                            title="Weekly Earnings"
                            value={weeklyEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            icon="calendar"
                            gradientColors={['#3b82f6', '#60a5fa']}
                            subtitle="Last 7 days performance"
                        />
                    </View>
                    <View style={styles.cardWrapper}>
                        <HeroCard
                            title="Pending Payouts"
                            value={pendingPayouts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            icon="time"
                            gradientColors={['#ef4444', '#f87171']}
                            subtitle="Processing withdrawals"
                        />
                    </View>
                </ScrollView>

                {/* Quick Actions */}
                <View style={styles.actionSection}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: cardBg }]}
                        onPress={() => router.push('/rider/wallet')} // Open withdraw modal via wallet page for now
                    >
                        <LinearGradient
                            colors={['rgba(242, 124, 34, 0.1)', 'rgba(242, 124, 34, 0.05)']}
                            style={styles.actionIconContainer}
                        >
                            <Ionicons name="arrow-up-circle" size={28} color="#f27c22" />
                        </LinearGradient>
                        <View style={styles.actionTextContainer}>
                            <ThemedText style={[styles.actionTitle, { color: textColor }]}>Withdraw Funds</ThemedText>
                            <ThemedText style={styles.actionSubtitle}>Transfer to bank account</ThemedText>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={textColor} style={{ opacity: 0.5 }} />
                    </TouchableOpacity>
                </View>

                {/* Recent Activity */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Recent Activity</ThemedText>
                        <TouchableOpacity onPress={() => router.push('/rider/wallet')}>
                            <ThemedText style={styles.seeAllText}>View All</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {recentTransactions.map((item, index) => (
                        <TransactionItem
                            key={`${item.id}-${index}`}
                            item={item}
                            type={item.type}
                            icon={item.type === 'credit' ? "bicycle" : "card"}
                            color={textColor}
                            textColor={textColor}
                            cardBg={cardBg}
                        />
                    ))}

                    {recentTransactions.length === 0 && (
                        <View style={styles.emptyState}>
                            <Ionicons name="receipt-outline" size={48} color={textColor} style={{ opacity: 0.2 }} />
                            <ThemedText style={{ color: textColor, opacity: 0.5, marginTop: 10 }}>No recent transactions</ThemedText>
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />

            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    headerBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(120,120,120,0.1)',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    carouselContent: {
        paddingHorizontal: 20,
        paddingVertical: 20,
        gap: 16,
    },
    cardWrapper: {
        width: width * 0.85,
    },
    heroCard: {
        borderRadius: 24,
        padding: 24,
        height: 160,
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    heroContent: {
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    heroIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    heroTitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginBottom: 4,
        fontWeight: '600',
    },
    heroValue: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 4,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    circle: {
        position: 'absolute',
        borderRadius: 999,
        backgroundColor: '#fff',
    },

    // Actions
    actionSection: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    actionIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    actionTextContainer: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    actionSubtitle: {
        fontSize: 12,
        color: '#666',
        opacity: 0.7,
    },

    // Recent Activity
    section: {
        paddingHorizontal: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    seeAllText: {
        color: '#f27c22',
        fontWeight: '600',
        fontSize: 14,
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    txIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    txContent: {
        flex: 1,
    },
    txTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    txDate: {
        fontSize: 12,
    },
    txAmount: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    }
});
