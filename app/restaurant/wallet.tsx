import FoodLoader from '@/components/FoodLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useWallet } from '@/contexts/wallet';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function WalletScreen() {
    const router = useRouter();
    const { openMenu } = useRestaurantMenu();
    const { businessWallet, transactions, isLoading, refreshWallet, fundWallet, transferFunds, requestPayout, activateWallet, resolveRecipient } = useWallet();

    // UI State
    const [showBalance, setShowBalance] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Modal State
    const [showFundModal, setShowFundModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);

    // Form State
    const [fundAmount, setFundAmount] = useState('');
    const [transferData, setTransferData] = useState({ email: '', amount: '' });
    const [recipientName, setRecipientName] = useState<string | null>(null);
    const [isResolvingRecipient, setIsResolvingRecipient] = useState(false);
    const [withdrawData, setWithdrawData] = useState({ amount: '', bankName: '', accountNumber: '', accountName: '' });

    const iconColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
    const bgColor = useThemeColor({ light: '#f8f9fc', dark: '#000' }, 'background');
    const inputBg = useThemeColor({ light: '#f5f5f5', dark: '#2c2c2e' }, 'background');
    const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const secondaryText = useThemeColor({ light: '#666', dark: '#888' }, 'text');

    useEffect(() => {
        activateWallet('business'); // Enforce business context
        refreshWallet();
    }, []);

    // --- Recipient Resolution ---
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (transferData.email && transferData.email.includes('@') && transferData.email.length > 5) {
                setIsResolvingRecipient(true);
                setRecipientName(null);
                const result = await resolveRecipient(transferData.email);
                setIsResolvingRecipient(false);
                if (result.success && result.data) {
                    setRecipientName(result.data.name);
                }
            } else {
                setRecipientName(null);
            }
        }, 800); // 800ms debounce

        return () => clearTimeout(timeoutId);
    }, [transferData.email]);


    // --- Handlers ---

    const handleFund = async () => {
        const amount = parseFloat(fundAmount);
        if (isNaN(amount) || amount <= 0) return;
        setShowFundModal(false);
        await fundWallet(amount);
        setFundAmount('');
    };

    const handleTransfer = async () => {
        const amount = parseFloat(transferData.amount);
        if (isNaN(amount) || amount <= 0 || !transferData.email) {
            Alert.alert('Error', 'Please enter a valid amount and email.');
            return;
        }
        if (!recipientName) {
            Alert.alert('Error', 'Please wait for recipient verification.');
            return;
        }

        setIsProcessing(true);
        const result = await transferFunds(amount, transferData.email);
        setIsProcessing(false);

        if (result.success) {
            Alert.alert('Success', result.message);
            setShowTransferModal(false);
            setTransferData({ email: '', amount: '' });
            setRecipientName(null);
        } else {
            Alert.alert('Error', result.message);
        }
    };

    const handleWithdraw = async () => {
        const amount = parseFloat(withdrawData.amount);
        if (isNaN(amount) || amount <= 0 || !withdrawData.bankName || !withdrawData.accountNumber || !withdrawData.accountName) {
            Alert.alert('Error', 'Please fill in all withdrawal details.');
            return;
        }

        setIsProcessing(true);
        const result = await requestPayout(amount, {
            bankName: withdrawData.bankName,
            accountNumber: withdrawData.accountNumber,
            accountName: withdrawData.accountName
        });
        setIsProcessing(false);

        if (result.success) {
            Alert.alert('Success', result.message);
            setShowWithdrawModal(false);
            setWithdrawData({ amount: '', bankName: '', accountNumber: '', accountName: '' });
        } else {
            Alert.alert('Error', result.message);
        }
    };

    // Quick amount buttons
    const quickAmounts = [1000, 5000, 10000, 25000];

    // Stats
    const totalCredits = transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
    const totalDebits = transactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);

    if (isLoading && !businessWallet) {
        return <FoodLoader message="Loading wallet..." />;
    }

    const renderTransaction = ({ item }: { item: any }) => (
        <TouchableOpacity activeOpacity={0.7} style={[styles.transactionCard, { backgroundColor: cardBg }]}>
            <View style={[styles.iconContainer, { backgroundColor: item.type === 'credit' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons
                    name={item.type === 'credit' ? "arrow-down" : "arrow-up"}
                    size={20}
                    color={item.type === 'credit' ? "#22c55e" : "#ef4444"}
                />
            </View>
            <View style={styles.txDetails}>
                <ThemedText style={styles.txTitle} numberOfLines={1}>{item.description}</ThemedText>
                <ThemedText style={[styles.txDate, { color: secondaryText }]}>
                    {new Date(item.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })} • {new Date(item.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
            </View>
            <View style={styles.txAmountContainer}>
                <ThemedText style={[styles.txAmount, { color: item.type === 'credit' ? "#22c55e" : "#ef4444" }]}>
                    {item.type === 'credit' ? '+' : '-'}₦{item.amount.toLocaleString()}
                </ThemedText>
                <View style={[styles.txBadge, { backgroundColor: item.type === 'credit' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                    <ThemedText style={[styles.txBadgeText, { color: item.type === 'credit' ? "#22c55e" : "#ef4444" }]}>
                        {item.type === 'credit' ? 'Credit' : 'Debit'}
                    </ThemedText>
                </View>
            </View>
        </TouchableOpacity>
    );

    // Dynamic Balance Font Size - More aggressive scaling
    const getBalanceFontSize = (balance: number) => {
        const balStr = balance.toLocaleString();
        if (balStr.length > 15) return 20;
        if (balStr.length > 12) return 24;
        if (balStr.length > 9) return 28;
        return 34; // Reduced max size slightly
    };

    const balanceFontSize = getBalanceFontSize(businessWallet?.balance || 0);

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu} style={styles.headerBtn}>
                    <Ionicons name="menu" size={24} color={iconColor} />
                </TouchableOpacity>
                <ThemedText type="title" style={styles.headerTitle}>Wallet</ThemedText>
                <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/history')}>
                    <Ionicons name="time-outline" size={24} color={iconColor} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={transactions}
                renderItem={renderTransaction}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshWallet} tintColor="#f27c22" />}
                ListHeaderComponent={
                    <>
                        {/* Restaurant Identity Card */}
                        {businessWallet?.restaurant && (
                            <View style={[styles.identityCard, { backgroundColor: cardBg }]}>
                                <View style={styles.identityRow}>
                                    {businessWallet.restaurant.logo_url ? (
                                        <Image source={{ uri: businessWallet.restaurant.logo_url }} style={styles.restaurantLogo} />
                                    ) : (
                                        <LinearGradient colors={['#f27c22', '#ff9a56']} style={styles.restaurantLogo}>
                                            <Ionicons name="restaurant" size={24} color="#fff" />
                                        </LinearGradient>
                                    )}
                                    <View style={styles.identityInfo}>
                                        <ThemedText style={styles.restaurantName}>{businessWallet.restaurant.name}</ThemedText>
                                        <View style={styles.verifiedBadge}>
                                            <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                                            <ThemedText style={styles.verifiedText}>Business Account</ThemedText>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Main Balance Card */}
                        <LinearGradient
                            colors={['#1a1a2e', '#16213e', '#0f3460']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.balanceCard}
                        >
                            {/* Card Pattern */}
                            <View style={styles.cardPattern}>
                                <View style={[styles.patternCircle, styles.patternCircle1]} />
                                <View style={[styles.patternCircle, styles.patternCircle2]} />
                            </View>

                            {/* Card Header */}
                            <View style={styles.cardHeader}>
                                <View style={styles.chipContainer}>
                                    <MaterialCommunityIcons name="integrated-circuit-chip" size={32} color="#FFD700" />
                                </View>
                                <TouchableOpacity onPress={() => setShowBalance(!showBalance)} style={styles.eyeBtn}>
                                    <Ionicons name={showBalance ? "eye" : "eye-off"} size={20} color="rgba(255,255,255,0.7)" />
                                </TouchableOpacity>
                            </View>

                            {/* Balance */}
                            <View style={styles.balanceSection}>
                                <ThemedText style={styles.balanceLabel}>Available Balance</ThemedText>
                                {/* Adjusted styles to ensure containment */}
                                <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <ThemedText
                                        style={[
                                            styles.balanceAmount,
                                            { fontSize: balanceFontSize, lineHeight: balanceFontSize * 1.2 }
                                        ]}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        {showBalance ? `₦${(businessWallet?.balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : '₦••••••••'}
                                    </ThemedText>
                                </View>
                            </View>

                            {/* Card Actions */}
                            <View style={styles.cardActions}>
                                <TouchableOpacity style={styles.cardActionBtn} onPress={() => setShowFundModal(true)}>
                                    <View style={styles.cardActionIcon}>
                                        <Ionicons name="add-circle" size={22} color="#22c55e" />
                                    </View>
                                    <ThemedText style={styles.cardActionText}>Fund</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.cardActionBtn} onPress={() => setShowWithdrawModal(true)}>
                                    <View style={styles.cardActionIcon}>
                                        <Ionicons name="arrow-up-circle" size={22} color="#f27c22" />
                                    </View>
                                    <ThemedText style={styles.cardActionText}>Withdraw</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.cardActionBtn} onPress={() => setShowTransferModal(true)}>
                                    <View style={styles.cardActionIcon}>
                                        <Ionicons name="swap-horizontal" size={22} color="#3b82f6" />
                                    </View>
                                    <ThemedText style={styles.cardActionText}>Transfer</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.cardActionBtn} onPress={() => router.push('/history')}>
                                    <View style={styles.cardActionIcon}>
                                        <Ionicons name="stats-chart" size={22} color="#a855f7" />
                                    </View>
                                    <ThemedText style={styles.cardActionText}>History</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>

                        {/* Stats Row */}
                        <View style={styles.statsRow}>
                            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                                <View style={[styles.statIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                                    <Ionicons name="trending-up" size={18} color="#22c55e" />
                                </View>
                                <ThemedText style={[styles.statLabel, { color: secondaryText }]}>Total Income</ThemedText>
                                <ThemedText style={styles.statValue}>₦{totalCredits.toLocaleString()}</ThemedText>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                                <View style={[styles.statIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                                    <Ionicons name="trending-down" size={18} color="#ef4444" />
                                </View>
                                <ThemedText style={[styles.statLabel, { color: secondaryText }]}>Total Expenses</ThemedText>
                                <ThemedText style={styles.statValue}>₦{totalDebits.toLocaleString()}</ThemedText>
                            </View>
                        </View>

                        {/* Transactions Header */}
                        <View style={styles.sectionHeader}>
                            <ThemedText style={styles.sectionTitle}>Recent Transactions</ThemedText>
                            <TouchableOpacity style={styles.seeAllBtn} onPress={() => router.push('/history')}>
                                <ThemedText style={styles.seeAllText}>See All</ThemedText>
                                <Ionicons name="chevron-forward" size={16} color="#f27c22" />
                            </TouchableOpacity>
                        </View>
                    </>
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconContainer}>
                            <Ionicons name="receipt-outline" size={48} color="#f27c22" />
                        </View>
                        <ThemedText style={styles.emptyTitle}>No transactions yet</ThemedText>
                        <ThemedText style={[styles.emptySubtitle, { color: secondaryText }]}>
                            Your transaction history will appear here
                        </ThemedText>
                    </View>
                }
            />

            {/* Fund Modal */}
            <Modal visible={showFundModal} transparent animationType="slide" onRequestClose={() => setShowFundModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText type="subtitle">Fund Wallet</ThemedText>
                            <TouchableOpacity onPress={() => setShowFundModal(false)}>
                                <Ionicons name="close" size={24} color={iconColor} />
                            </TouchableOpacity>
                        </View>
                        <View style={[styles.amountInputContainer, { backgroundColor: inputBg }]}>
                            <ThemedText style={styles.currencySymbol}>₦</ThemedText>
                            <TextInput
                                style={[styles.amountInput, { color: textColor }]}
                                placeholder="0.00"
                                placeholderTextColor="#999"
                                keyboardType="numeric"
                                value={fundAmount}
                                onChangeText={setFundAmount}
                            />
                        </View>
                        <ThemedText style={[styles.quickLabel, { color: secondaryText }]}>Quick Select</ThemedText>
                        <View style={styles.quickAmounts}>
                            {quickAmounts.map(amount => (
                                <TouchableOpacity
                                    key={amount}
                                    style={[styles.quickBtn, fundAmount === amount.toString() && styles.quickBtnActive]}
                                    onPress={() => setFundAmount(amount.toString())}
                                >
                                    <ThemedText style={[styles.quickBtnText, fundAmount === amount.toString() && styles.quickBtnTextActive]}>
                                        ₦{amount.toLocaleString()}
                                    </ThemedText>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity
                            style={[styles.payBtn, (!fundAmount || parseFloat(fundAmount) <= 0) && styles.payBtnDisabled]}
                            onPress={handleFund}
                            disabled={!fundAmount || parseFloat(fundAmount) <= 0}
                        >
                            <LinearGradient colors={['#f27c22', '#ff9a56']} style={styles.payBtnGradient}>
                                <Ionicons name="wallet" size={20} color="#fff" />
                                <ThemedText style={styles.payBtnText}>Pay Now</ThemedText>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Transfer Modal */}
            <Modal visible={showTransferModal} transparent animationType="slide" onRequestClose={() => setShowTransferModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText type="subtitle">Transfer Funds</ThemedText>
                            <TouchableOpacity onPress={() => setShowTransferModal(false)}>
                                <Ionicons name="close" size={24} color={iconColor} />
                            </TouchableOpacity>
                        </View>
                        <ThemedText style={[styles.inputLabel, { color: secondaryText }]}>Recipient Email</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                            placeholder="user@example.com"
                            placeholderTextColor="#999"
                            value={transferData.email}
                            onChangeText={text => setTransferData({ ...transferData, email: text })}
                            autoCapitalize="none"
                        />
                        {/* Recipient Verification Status */}
                        {isResolvingRecipient && (
                            <View style={styles.verificationRow}>
                                <ActivityIndicator size="small" color="#f27c22" />
                            </View>
                        )}
                        {recipientName && (
                            <View style={styles.verificationRow}>
                                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                                <ThemedText style={styles.verifiedRecipient}>{recipientName}</ThemedText>
                            </View>
                        )}
                        {!isResolvingRecipient && transferData.email.length > 5 && !recipientName && transferData.email.includes('@') && (
                            <View style={styles.verificationRow}>
                                <ThemedText style={styles.unverifiedRecipient}>User not found</ThemedText>
                            </View>
                        )}

                        <ThemedText style={[styles.inputLabel, { color: secondaryText }]}>Amount</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                            placeholder="0.00"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={transferData.amount}
                            onChangeText={text => setTransferData({ ...transferData, amount: text })}
                        />
                        <TouchableOpacity
                            style={[styles.primaryBtn, (isProcessing || !recipientName) && styles.btnDisabled]}
                            onPress={handleTransfer}
                            disabled={isProcessing || !recipientName}
                        >
                            {isProcessing ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryBtnText}>Transfer</ThemedText>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Withdraw Modal */}
            <Modal visible={showWithdrawModal} transparent animationType="slide" onRequestClose={() => setShowWithdrawModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText type="subtitle">Withdraw Funds</ThemedText>
                            <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                                <Ionicons name="close" size={24} color={iconColor} />
                            </TouchableOpacity>
                        </View>
                        <ThemedText style={[styles.inputLabel, { color: secondaryText }]}>Amount</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                            placeholder="0.00"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={withdrawData.amount}
                            onChangeText={text => setWithdrawData({ ...withdrawData, amount: text })}
                        />
                        <ThemedText style={[styles.inputLabel, { color: secondaryText }]}>Bank Name</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                            placeholder="e.g. GTBank"
                            placeholderTextColor="#999"
                            value={withdrawData.bankName}
                            onChangeText={text => setWithdrawData({ ...withdrawData, bankName: text })}
                        />
                        <ThemedText style={[styles.inputLabel, { color: secondaryText }]}>Account Number</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                            placeholder="0123456789"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={withdrawData.accountNumber}
                            onChangeText={text => setWithdrawData({ ...withdrawData, accountNumber: text })}
                        />
                        <ThemedText style={[styles.inputLabel, { color: secondaryText }]}>Account Name</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                            placeholder="Account Holder Name"
                            placeholderTextColor="#999"
                            value={withdrawData.accountName}
                            onChangeText={text => setWithdrawData({ ...withdrawData, accountName: text })}
                        />
                        <TouchableOpacity style={[styles.primaryBtn, isProcessing && styles.btnDisabled]} onPress={handleWithdraw} disabled={isProcessing}>
                            {isProcessing ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryBtnText}>Withdraw</ThemedText>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 50
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    listContent: { padding: 20, paddingTop: 0, paddingBottom: 100 },

    // Identity Card
    identityCard: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    identityRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    restaurantLogo: {
        width: 50,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    identityInfo: { marginLeft: 14, flex: 1 },
    restaurantName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    verifiedText: { fontSize: 12, color: '#22c55e', fontWeight: '500' },

    // Balance Card
    balanceCard: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
        overflow: 'hidden',
        shadowColor: '#1a1a2e',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    cardPattern: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    patternCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.03)' },
    patternCircle1: { width: 200, height: 200, top: -80, right: -60 },
    patternCircle2: { width: 150, height: 150, bottom: -50, left: -40 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    chipContainer: { opacity: 0.9 },
    eyeBtn: { padding: 8 },
    balanceSection: { marginBottom: 28 },
    balanceLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 8 },
    balanceAmount: { color: '#fff', fontWeight: '800', letterSpacing: 1 },
    cardActions: { flexDirection: 'row', justifyContent: 'space-between' },
    cardActionBtn: { alignItems: 'center', gap: 8 },
    cardActionIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cardActionText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },

    // Stats Row
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    statLabel: { fontSize: 12, marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: '700' },

    // Section Header
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '700' },
    seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    seeAllText: { color: '#f27c22', fontWeight: '600', fontSize: 14 },

    // Transaction Card
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    iconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    txDetails: { flex: 1 },
    txTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
    txDate: { fontSize: 12 },
    txAmountContainer: { alignItems: 'flex-end' },
    txAmount: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    txBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    txBadgeText: { fontSize: 10, fontWeight: '600' },

    // Empty State
    emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: 'rgba(242, 124, 34, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
    emptySubtitle: { fontSize: 14, textAlign: 'center' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 16,
        marginBottom: 20
    },
    currencySymbol: { fontSize: 28, fontWeight: '700', marginRight: 8, opacity: 0.5 },
    amountInput: { flex: 1, fontSize: 32, fontWeight: '700' },
    quickLabel: { fontSize: 14, marginBottom: 12 },
    quickAmounts: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    quickBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(242, 124, 34, 0.1)',
        alignItems: 'center'
    },
    quickBtnActive: { backgroundColor: '#f27c22' },
    quickBtnText: { color: '#f27c22', fontWeight: '600', fontSize: 14 },
    quickBtnTextActive: { color: '#fff' },
    payBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
    payBtnDisabled: { opacity: 0.5 },
    payBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 10 },
    payBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    securityText: { fontSize: 12 },

    // Inputs
    inputLabel: { marginBottom: 8, fontSize: 14 },
    input: { padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 16 },
    primaryBtn: { backgroundColor: '#f27c22', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
    primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    btnDisabled: { opacity: 0.7 },

    // Verification
    verificationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
    verifiedRecipient: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
    unverifiedRecipient: { color: '#ef4444', fontSize: 12 }
});
