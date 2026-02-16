import LottieLoader from '@/components/LottieLoader';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useWallet } from '@/contexts/wallet';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

// --- Components ---

const StatCard = ({ title, value, badgeText, cardStyle, textColor, useGradient }: any) => {
    return (
        <View style={[styles.statCard, cardStyle, useGradient && styles.gradientCard]}>
            <Text style={[styles.statTitle, { color: textColor }]}>{title}</Text>
            <View style={styles.statValueRow}>
                <View style={[styles.nairaIcon, { borderColor: textColor }]}>
                    <Text style={[styles.nairaText, { color: textColor }]}>₦</Text>
                </View>
                <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
            </View>

            {badgeText && (
                <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{badgeText}</Text>
                </View>
            )}

            {/* Simple accent line for "hero" gradient text if we wanted, but sticking to clean cards */}
            {useGradient && <View style={styles.activeBorder} />}
        </View>
    );
};

const EarningsRow = ({ item, textColor }: { item: any, textColor: string }) => (
    <View style={styles.tableRow}>
        <Text style={[styles.cellDate, { color: textColor }]}>
            {new Date(item.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
        </Text>
        <Text style={[styles.cellId, { color: textColor }]}>#{item.id.substring(0, 5).toUpperCase()}</Text>
        <Text style={[styles.cellAmount, { color: textColor }]}>{item.final_price?.toLocaleString() || '0'}</Text>
        <Text style={[styles.cellStatus,
        item.status === 'delivered' ? styles.textGreen : (item.status === 'cancelled' ? styles.textRed : styles.textOrange)
        ]}>
            {item.status === 'delivered' ? 'Completed' : item.status}
        </Text>
    </View>
);

const WithdrawalRow = ({ item, textColor }: { item: any, textColor: string }) => (
    <View style={styles.tableRow}>
        <Text style={[styles.cellDate, { color: textColor }]}>
            {new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
        </Text>
        <Text style={[styles.cellAmount, { color: textColor }]}>{item.amount?.toLocaleString()}</Text>
        <Text style={[styles.cellStatus,
        item.status === 'processed' ? styles.textGreen : (item.status === 'failed' ? styles.textRed : styles.textOrange)
        ]}>
            {item.status === 'processed' ? 'Paid' : 'Pending'}
        </Text>
        <Text style={[styles.cellMethod, { color: textColor }]}>Bank transfer</Text>
    </View>
);

export default function RiderPaymentsPage() {
    const router = useRouter();
    const { openMenu } = useRiderMenu();
    const { session } = useAuth();
    const { riderWallet, refreshWallet } = useWallet();

    // Theme
    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#121212' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1E1E1E' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const primary = '#F27C22';

    // State
    const [todaysEarnings, setTodaysEarnings] = useState(0);
    const [pendingPayouts, setPendingPayouts] = useState(0);
    const [earningsHistory, setEarningsHistory] = useState<any[]>([]);
    const [withdrawalHistory, setWithdrawalHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session?.user.id) {
            fetchData();
        }
    }, [session?.user.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            await refreshWallet();

            // 1. Today's Earnings
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const { data: todayJobs } = await supabase
                .from('delivery_requests')
                .select('final_price')
                .eq('rider_id', session?.user.id)
                .eq('status', 'delivered')
                .gte('updated_at', startOfDay.toISOString());

            if (todayJobs) {
                const sum = todayJobs.reduce((acc, job) => acc + (Number(job.final_price) || 0), 0);
                setTodaysEarnings(sum);
            }

            // 2. Earnings Breakdown (Last 20)
            const { data: jobs } = await supabase
                .from('delivery_requests')
                .select('*')
                .eq('rider_id', session?.user.id)
                .in('status', ['delivered', 'cancelled'])
                .order('updated_at', { ascending: false })
                .limit(20);
            setEarningsHistory(jobs || []);

            // 3. Withdrawal History
            const { data: withdrawals } = await supabase
                .from('wallet_transactions') // Assuming this table exists, or standard transactions table
                .select('*')
                .eq('wallet_id', riderWallet?.id)
                .eq('type', 'withdrawal')
                .order('created_at', { ascending: false })
                .limit(20);

            setWithdrawalHistory(withdrawals || []);

            // 4. Pending Payouts (Mock logic or sum of pending withdrawals)
            if (withdrawals) {
                const pendingSum = withdrawals
                    .filter(w => w.status === 'pending')
                    .reduce((acc, w) => acc + (Number(w.amount) || 0), 0);
                setPendingPayouts(pendingSum);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !riderWallet) {
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
                <TouchableOpacity onPress={openMenu}>
                    <Ionicons name="menu" size={28} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Payments and earning</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* 1. Top Cards Carousel */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel} contentContainerStyle={{ paddingHorizontal: 20 }}>
                    <StatCard
                        title="Total Balance"
                        value={riderWallet?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                        cardStyle={{ backgroundColor: cardBg }}
                        textColor={textColor}
                        useGradient={true}
                    />
                    <StatCard
                        title="Today’s Earnings"
                        value={todaysEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        cardStyle={{ backgroundColor: cardBg }}
                        textColor={textColor}
                    />
                    <StatCard
                        title="Pending payouts"
                        value={pendingPayouts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        badgeText="Still Pending"
                        cardStyle={{ backgroundColor: cardBg }}
                        textColor={textColor}
                    />
                </ScrollView>

                {/* 2. Balance & Payouts Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>Balance & Payouts</Text>

                    <View style={styles.balanceContainer}>
                        <Text style={[styles.labelAvailable, { color: textColor, opacity: 0.7 }]}>Available Balance</Text>
                        <Text style={[styles.bigBalance, { color: textColor }]}>
                            ₦ {riderWallet?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                        </Text>
                    </View>
                </View>

                {/* 3. Earnings Breakdown */}
                <View style={styles.section}>
                    <Text style={[styles.subTitle, { color: textColor }]}>Earnings Breakdown</Text>

                    <View style={[styles.tableHeader, { borderBottomColor: textColor + '20' }]}>
                        <Text style={[styles.th, styles.colDate, { color: textColor, opacity: 0.6 }]}>Date</Text>
                        <Text style={[styles.th, styles.colId, { color: textColor, opacity: 0.6 }]}>Order ID</Text>
                        <Text style={[styles.th, styles.colAmount, { color: textColor, opacity: 0.6 }]}>Amount</Text>
                        <Text style={[styles.th, styles.colStatus, { color: textColor, opacity: 0.6 }]}>Status</Text>
                    </View>

                    {earningsHistory.map(item => (
                        <EarningsRow key={item.id} item={item} textColor={textColor} />
                    ))}
                    {earningsHistory.length === 0 && <Text style={{ color: textColor, opacity: 0.5, marginTop: 10, textAlign: 'center' }}>No recent earnings.</Text>}
                </View>

                {/* 4. Withdrawal History */}
                <View style={styles.section}>
                    <Text style={[styles.subTitle, { color: textColor, marginVertical: 20 }]}>Withdrawal History</Text>

                    <View style={[styles.tableHeader, { borderBottomColor: textColor + '20' }]}>
                        <Text style={[styles.th, styles.colDate, { color: textColor, opacity: 0.6 }]}>Date</Text>
                        <Text style={[styles.th, styles.colAmount, { color: textColor, opacity: 0.6 }]}>Amount</Text>
                        <Text style={[styles.th, styles.colStatus, { color: textColor, opacity: 0.6 }]}>Status</Text>
                        <Text style={[styles.th, styles.colMethod, { color: textColor, opacity: 0.6 }]}>Means</Text>
                    </View>

                    {withdrawalHistory.map(item => (
                        <WithdrawalRow key={item.id} item={item} textColor={textColor} />
                    ))}
                    {withdrawalHistory.length === 0 && <Text style={{ color: textColor, opacity: 0.5, marginTop: 10, textAlign: 'center' }}>No withdrawals found.</Text>}
                </View>


                {/* Withdraw Action */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity
                        style={[styles.withdrawBtn, { borderColor: primary }]}
                        onPress={() => router.push('/rider/wallet')}
                    >
                        <Text style={[styles.withdrawText, { color: primary }]}>Withdraw Earnings</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 50 }} />


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
        paddingBottom: 20,
    },
    headerTitle: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 25,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    carousel: {
        marginBottom: 30,
    },
    statCard: {
        width: 182,
        height: 117,
        borderRadius: 12,
        padding: 16,
        justifyContent: 'space-between',
        // Shadow for depth
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    gradientCard: {
        borderWidth: 1,
        borderColor: 'rgba(242, 124, 34, 0.3)', // Subtle orange border for the "Hero" card
    },
    activeBorder: {
        position: 'absolute',
        bottom: 0,
        left: 16,
        right: 16,
        height: 3,
        backgroundColor: '#F27C22',
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
    },
    statTitle: {
        fontFamily: 'Montserrat_500Medium',
        fontSize: 14,
        opacity: 0.8,
    },
    statValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nairaIcon: {
        borderWidth: 1.5,
        borderRadius: 4,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    nairaText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    statValue: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 22,
    },
    pendingBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(242, 124, 34, 0.15)', // Light Orange
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    pendingBadgeText: {
        fontFamily: 'OpenSans_600SemiBold',
        fontSize: 10,
        color: '#F27C22',
    },

    // Sections
    section: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    sectionTitle: {
        fontFamily: 'OpenSans_600SemiBold',
        fontSize: 22,
        marginBottom: 20,
    },
    labelAvailable: {
        fontFamily: 'OpenSans_400Regular',
        fontSize: 20,
        marginBottom: 8,
    },
    bigBalance: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 23,
        marginBottom: 24,
    },
    balanceContainer: {
        marginTop: 10,
    },
    subTitle: {
        fontFamily: 'OpenSans_600SemiBold',
        fontSize: 20,
        marginBottom: 10,
    },



    // Table
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: 12,
        marginBottom: 12,
        borderBottomWidth: 1,
    },
    th: {
        fontFamily: 'OpenSans_600SemiBold',
        fontSize: 13,
    },
    divider: {
        height: 1,
        width: '100%',
        opacity: 0.2,
        marginBottom: 12,
    },
    tableRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },

    // Columns
    colDate: { width: '22%' },
    colId: { width: '20%' },
    colAmount: { width: '30%' },
    colStatus: { width: '28%', textAlign: 'right' },
    colMethod: { width: '28%', textAlign: 'right' },

    // Cell Styles
    cellDate: { fontFamily: 'OpenSans_400Regular', fontSize: 13 },
    cellId: { fontFamily: 'OpenSans_400Regular', fontSize: 13 },
    cellAmount: { fontFamily: 'Montserrat_600SemiBold', fontSize: 13 },
    cellStatus: { fontFamily: 'OpenSans_600SemiBold', fontSize: 13, textAlign: 'right' },
    cellMethod: { fontFamily: 'OpenSans_400Regular', fontSize: 13, textAlign: 'right' },

    textGreen: { color: '#22C55E' },
    textOrange: { color: '#F59E0B' },
    textRed: { color: '#EF4444' },

    // Action
    actionContainer: {
        paddingHorizontal: 20,
        marginTop: 10,
    },
    withdrawBtn: {
        borderWidth: 1,
        borderColor: '#F27C22',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        width: 230,
    },
    withdrawText: {
        color: '#F27C22',
        fontFamily: 'OpenSans_600SemiBold',
        fontSize: 17,
    },
});
