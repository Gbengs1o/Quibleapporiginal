import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useWallet } from '@/contexts/wallet';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getBanks, verifyBankAccount } from '@/utils/monnify';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function WalletScreen() {
  const {
    personalWallet,
    businessWallet,
    riderWallet,
    activeWallet,
    transactions,
    isLoading,
    switchWallet,
    refreshWallet,
    fundWallet,
    getCurrentLocation
  } = useWallet();

  // Modals
  const [showFundModal, setShowFundModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showP2PModal, setShowP2PModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showBankList, setShowBankList] = useState(false);

  // UI State
  const [hideBalance, setHideBalance] = useState(false);
  const [txSearch, setTxSearch] = useState('');
  const [bankSearch, setBankSearch] = useState('');

  // Forms
  const [fundingAmount, setFundingAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  // P2P
  const [p2pEmail, setP2pEmail] = useState('');
  const [p2pAmount, setP2pAmount] = useState('');
  const [recipientDetails, setRecipientDetails] = useState<any>(null);
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);

  // Withdrawal
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [bankList, setBankList] = useState<any[]>([]);
  const [accountNumber, setAccountNumber] = useState('');
  const [verifiedAccountName, setVerifiedAccountName] = useState('');
  const [isVerifyingAccount, setIsVerifyingAccount] = useState(false);

  // Theme
  const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
  const secondaryText = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
  const inputBg = useThemeColor({ light: '#f5f5f5', dark: '#2c2c2e' }, 'background');
  const sectionHeaderBg = useThemeColor({ light: '#fff', dark: '#000' }, 'background');

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    const banks = await getBanks();
    setBankList(banks);
  };

  // Removed forceful reset to Personal wallet to allow user to view Rider wallet if desired.

  // --- Actions ---

  const handleFundWallet = async () => {
    const amount = parseFloat(fundingAmount);
    if (!amount || amount < 100) {
      Alert.alert('Invalid Amount', 'Minimum top up is ₦100');
      return;
    }
    setShowFundModal(false);
    await fundWallet(amount);
    setFundingAmount('');
  };

  const handleInternalTransfer = async () => {
    if (!businessWallet || !personalWallet) return;
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) return Alert.alert('Invalid Amount', 'Please enter a valid amount');
    if (amount > businessWallet.balance) return Alert.alert('Insufficient Balance', 'Cannot transfer more than balance');

    try {
      const { error } = await supabase.rpc('transfer_internal', {
        from_wallet_id: businessWallet.id,
        to_wallet_id: personalWallet.id,
        amount: amount
      });
      if (error) throw error;
      Alert.alert('Success', 'Funds transferred to Personal Wallet');
      setShowTransferModal(false);
      setTransferAmount('');
      refreshWallet();
    } catch (error: any) {
      Alert.alert('Transfer Failed', error.message);
    }
  };

  const checkRecipient = async () => {
    if (!p2pEmail || !p2pEmail.includes('@')) return;
    setIsCheckingRecipient(true);
    setRecipientDetails(null);
    try {
      const { data, error } = await supabase.rpc('get_recipient_details', { p_email: p2pEmail.toLowerCase().trim() });
      if (error) throw error;
      setRecipientDetails(data && data.found ? data : { found: false });
    } catch (error) {
      setRecipientDetails({ found: false });
    } finally {
      setIsCheckingRecipient(false);
    }
  };

  const handleP2PTransfer = async () => {
    const amount = parseFloat(p2pAmount);
    if (!amount || amount <= 0) return Alert.alert('Invalid Amount', 'Please check amount');
    if (!recipientDetails?.found) return Alert.alert('Invalid Recipient', 'Verify recipient first');

    try {
      const location = await getCurrentLocation();
      const { data, error } = await supabase.rpc('transfer_p2p', {
        recipient_email: p2pEmail.toLowerCase().trim(),
        amount: amount,
        p_location: location
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.message);

      Alert.alert('Success', `Sent ₦${amount} to ${recipientDetails.first_name}`);
      setShowP2PModal(false);
      setP2pAmount('');
      setP2pEmail('');
      setRecipientDetails(null);
      refreshWallet();
    } catch (error: any) {
      Alert.alert('Transfer Failed', error.message);
    }
  };

  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      verifyAccount();
    } else {
      setVerifiedAccountName('');
    }
  }, [accountNumber, selectedBank]);

  const verifyAccount = async () => {
    setIsVerifyingAccount(true);
    const details = await verifyBankAccount(accountNumber, selectedBank.code);
    setVerifiedAccountName(details ? details.accountName : '');
    if (!details && accountNumber.length === 10) Alert.alert("Error", "Could not verify account name");
    setIsVerifyingAccount(false);
  };

  const handleWithdrawal = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return Alert.alert('Invalid Amount', 'Check amount');
    if (!verifiedAccountName) return Alert.alert('Missing Details', 'Account not verified');

    try {
      const location = await getCurrentLocation();
      const { data, error } = await supabase.rpc('request_withdrawal', {
        p_amount: amount,
        p_bank_name: selectedBank.name,
        p_account_number: accountNumber,
        p_account_name: verifiedAccountName,
        p_location: location
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.message);

      Alert.alert('Success', 'Withdrawal request submitted.');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setAccountNumber('');
      setVerifiedAccountName('');
      refreshWallet();
    } catch (error: any) {
      Alert.alert('Request Failed', error.message);
    }
  };

  // --- Helpers ---
  const formatCurrency = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getFilteredTransactions = () => {
    if (!txSearch) return transactions;
    return transactions.filter(tx =>
      tx.description.toLowerCase().includes(txSearch.toLowerCase()) ||
      tx.amount.toString().includes(txSearch)
    );
  };

  const groupTransactions = (txs: any[]) => {
    const groups: { title: string, data: any[] }[] = [];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    txs.forEach(tx => {
      const date = new Date(tx.created_at).toDateString();
      let title = date;
      if (date === today) title = 'Today';
      else if (date === yesterday) title = 'Yesterday';

      let group = groups.find(g => g.title === title);
      if (!group) {
        group = { title, data: [] };
        groups.push(group);
      }
      group.data.push(tx);
    });
    return groups;
  };

  const filteredTx = getFilteredTransactions();
  const groupedTx = groupTransactions(filteredTx);

  const getFilteredBanks = () => {
    if (!bankSearch) return bankList;
    return bankList.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));
  };

  const renderTransaction = ({ item: tx }: { item: any }) => {
    const isCredit = tx.type === 'credit';
    const isTransfer = tx.description.toLowerCase().includes('transfer');
    const isWithdrawal = tx.description.toLowerCase().includes('withdrawal');

    let iconName: any = isCredit ? "arrow-down" : "arrow-up";
    let iconColor = isCredit ? "#22c55e" : "#ef4444";
    let bg = isCredit ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)";

    if (isTransfer) {
      iconName = "paper-plane";
      iconColor = "#3b82f6";
      bg = "rgba(59, 130, 246, 0.1)";
    } else if (isWithdrawal) {
      iconName = "cash";
      iconColor = "#f59e0b";
      bg = "rgba(245, 158, 11, 0.1)";
    }

    return (
      <View style={[styles.transactionCard, { backgroundColor: cardBg }]}>
        <View style={styles.txIconContainer}>
          <View style={[styles.txIcon, { backgroundColor: bg }]}>
            <Ionicons name={iconName} size={20} color={iconColor} />
          </View>
        </View>
        <View style={styles.txDetails}>
          <ThemedText style={[styles.txDescription, { color: textColor }]} numberOfLines={1}>
            {tx.description}
          </ThemedText>
          <ThemedText style={[styles.txDate, { color: secondaryText }]}>
            {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </ThemedText>
        </View>
        <ThemedText style={[styles.txAmount, { color: isCredit ? "#22c55e" : textColor }]}>
          {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
        </ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Search Header for History - Sticky? No, let's keep it simple in ScrollView or switch to SectionList as main */}

      <SectionList
        sections={groupedTx}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        renderSectionHeader={({ section: { title } }) => (
          <ThemedText style={[styles.sectionHeader, { color: secondaryText, backgroundColor: sectionHeaderBg }]}>
            {title}
          </ThemedText>
        )}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {/* Header & Switch */}
            <View style={styles.topRow}>
              <ThemedText type="title" style={[styles.title, { color: textColor }]}>Wallet</ThemedText>
              {(businessWallet || riderWallet) && (
                <TouchableOpacity style={styles.switchButton} onPress={switchWallet}>
                  <Ionicons name="swap-horizontal" size={20} color="#f27c22" />
                  <ThemedText style={styles.switchText}>
                    {activeWallet?.type === 'personal' ? (businessWallet ? 'Business' : riderWallet ? 'Rider' : '') :
                      activeWallet?.type === 'business' ? (riderWallet ? 'Rider' : 'Personal') :
                        'Personal'}
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* Premium Gradient Card - Updated with #1F2050 */}
            <LinearGradient
              colors={['#1F2050', '#f27c22']} // Dark Blue to Orange
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceCard}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.balanceLabel}>
                  {activeWallet?.type === 'business' ? 'Business Balance' :
                    activeWallet?.type === 'rider' ? 'Rider Balance' :
                      'Personal Balance'}
                </Text>
                <TouchableOpacity onPress={() => setHideBalance(!hideBalance)}>
                  <Ionicons name={hideBalance ? "eye-off" : "eye"} size={20} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>

              <View style={styles.balanceRow}>
                <Text
                  style={styles.balanceValue}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                >
                  {activeWallet ? (hideBalance ? '••••••' : formatCurrency(activeWallet.balance)) : '---'}
                </Text>
              </View>

              <View style={styles.actionRow}>
                {activeWallet?.type === 'personal' ? (
                  <>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setShowFundModal(true)}>
                      <View style={styles.actionIcon}><Ionicons name="add" size={24} color="#f27c22" /></View>
                      <Text style={styles.actionText}>Top Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setShowP2PModal(true)}>
                      <View style={styles.actionIcon}><Ionicons name="paper-plane" size={24} color="#f27c22" /></View>
                      <Text style={styles.actionText}>Send</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setShowWithdrawModal(true)}>
                      <View style={styles.actionIcon}><Ionicons name="cash" size={24} color="#f27c22" /></View>
                      <Text style={styles.actionText}>Withdraw</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => setShowTransferModal(true)}>
                    <View style={styles.actionIcon}><Ionicons name="arrow-forward" size={24} color="#f27c22" /></View>
                    <Text style={styles.actionText}>To Personal</Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: inputBg }]}>
              <Ionicons name="search" size={20} color={secondaryText} />
              <TextInput
                style={[styles.searchInput, { color: textColor }]}
                placeholder="Search transactions..."
                placeholderTextColor={secondaryText}
                value={txSearch}
                onChangeText={setTxSearch}
              />
              {txSearch.length > 0 && (
                <TouchableOpacity onPress={() => setTxSearch('')}>
                  <Ionicons name="close-circle" size={18} color={secondaryText} />
                </TouchableOpacity>
              )}
            </View>

            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Recent Activity</ThemedText>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={secondaryText} />
            <ThemedText style={[styles.emptyText, { color: secondaryText }]}>No transactions found</ThemedText>
          </View>
        }
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshWallet} tintColor="#f27c22" />}
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      {/* --- MODALS --- */}

      {/* Fund */}
      <Modal visible={showFundModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textColor }]}>Top Up Wallet</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
              placeholder="Amount (e.g. 500)"
              placeholderTextColor={secondaryText}
              keyboardType="numeric"
              value={fundingAmount}
              onChangeText={setFundingAmount}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowFundModal(false)}>
                <ThemedText style={{ color: secondaryText }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleFundWallet}>
                <ThemedText style={styles.confirmText}>Pay Now</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Internal Transfer */}
      <Modal visible={showTransferModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textColor }]}>Transfer to Personal</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
              placeholder="Amount"
              placeholderTextColor={secondaryText}
              keyboardType="numeric"
              value={transferAmount}
              onChangeText={setTransferAmount}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowTransferModal(false)}>
                <ThemedText style={{ color: secondaryText }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleInternalTransfer}>
                <ThemedText style={styles.confirmText}>Transfer</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* P2P */}
      <Modal visible={showP2PModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textColor }]}>Send Money</ThemedText>

            <View style={{ marginBottom: 16 }}>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: textColor, marginBottom: 8 }]}
                placeholder="Recipient Email"
                placeholderTextColor={secondaryText}
                keyboardType="email-address"
                autoCapitalize="none"
                value={p2pEmail}
                onChangeText={setP2pEmail}
                onBlur={checkRecipient}
              />
              {isCheckingRecipient && <ActivityIndicator size="small" color="#f27c22" />}

              {recipientDetails?.found && (
                <View style={styles.recipientCard}>
                  {recipientDetails.profile_picture_url ? (
                    <Image source={{ uri: recipientDetails.profile_picture_url }} style={styles.recipientAvatar} />
                  ) : (
                    <View style={[styles.recipientAvatar, { backgroundColor: '#ccc' }]} />
                  )}
                  <View>
                    <ThemedText style={[styles.recipientName, { color: textColor }]}>
                      {recipientDetails.first_name} {recipientDetails.last_name}
                    </ThemedText>
                    <ThemedText style={{ color: '#22c55e', fontSize: 12 }}>Verified User</ThemedText>
                  </View>
                </View>
              )}
              {recipientDetails && !recipientDetails.found && (
                <ThemedText style={{ color: '#ef4444', fontSize: 12 }}>User not found</ThemedText>
              )}
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
              placeholder="Amount"
              placeholderTextColor={secondaryText}
              keyboardType="numeric"
              value={p2pAmount}
              onChangeText={setP2pAmount}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowP2PModal(false)}>
                <ThemedText style={{ color: secondaryText }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { opacity: recipientDetails?.found ? 1 : 0.5 }]}
                onPress={handleP2PTransfer}
                disabled={!recipientDetails?.found}
              >
                <ThemedText style={styles.confirmText}>Send</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Withdrawal */}
      <Modal visible={showWithdrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg, maxHeight: '80%' }]}>
            <ThemedText style={[styles.modalTitle, { color: textColor }]}>Withdraw</ThemedText>

            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
              placeholder="Amount"
              placeholderTextColor={secondaryText}
              keyboardType="numeric"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
            />

            {/* Bank Select */}
            <TouchableOpacity
              style={[styles.input, { backgroundColor: inputBg, justifyContent: 'center' }]}
              onPress={() => setShowBankList(true)}
            >
              <ThemedText style={{ color: selectedBank ? textColor : secondaryText }}>
                {selectedBank ? selectedBank.name : "Select Bank"}
              </ThemedText>
              <Ionicons name="chevron-down" size={20} color={secondaryText} style={{ position: 'absolute', right: 16 }} />
            </TouchableOpacity>

            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
              placeholder="Account Number"
              placeholderTextColor={secondaryText}
              keyboardType="numeric"
              value={accountNumber}
              onChangeText={setAccountNumber}
              maxLength={10}
            />

            {isVerifyingAccount && <ActivityIndicator size="small" color="#f27c22" />}

            {verifiedAccountName ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <ThemedText style={{ color: textColor, fontWeight: 'bold' }}>{verifiedAccountName}</ThemedText>
              </View>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowWithdrawModal(false)}>
                <ThemedText style={{ color: secondaryText }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { opacity: verifiedAccountName ? 1 : 0.5 }]}
                onPress={handleWithdrawal}
                disabled={!verifiedAccountName}
              >
                <ThemedText style={styles.confirmText}>Withdraw</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bank List Modal with Search */}
      <Modal visible={showBankList} animationType="slide">
        <ThemedView style={{ flex: 1, paddingTop: 60 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 }}>
            <TouchableOpacity onPress={() => setShowBankList(false)}>
              <Ionicons name="close" size={28} color={textColor} />
            </TouchableOpacity>
            <ThemedText type="subtitle" style={{ marginLeft: 20 }}>Select Bank</ThemedText>
          </View>

          {/* Bank Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: inputBg, marginHorizontal: 20, marginBottom: 10 }]}>
            <Ionicons name="search" size={20} color={secondaryText} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search banks..."
              placeholderTextColor={secondaryText}
              value={bankSearch}
              onChangeText={setBankSearch}
            />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            {getFilteredBanks().map((bank: any) => (
              <TouchableOpacity
                key={bank.code}
                style={{ paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: secondaryText }}
                onPress={() => {
                  setSelectedBank(bank);
                  setShowBankList(false);
                  setBankSearch(''); // Reset search
                }}
              >
                <ThemedText style={{ color: textColor, fontSize: 16 }}>{bank.name}</ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </ThemedView>
      </Modal>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContent: { padding: 20, paddingTop: 60 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '800' },
  switchButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(242, 124, 34, 0.1)', padding: 8, borderRadius: 20 },
  switchText: { color: '#f27c22', fontWeight: '700', fontSize: 12 },

  balanceCard: { borderRadius: 24, padding: 24, marginBottom: 24, shadowColor: '#f27c22', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  balanceLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500' },
  balanceRow: { marginBottom: 24, paddingRight: 10 },
  balanceValue: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },

  actionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 10 },
  actionBtn: { alignItems: 'center', gap: 8, flex: 1 },
  actionIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 20 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },

  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  sectionHeader: { fontSize: 14, fontWeight: '600', paddingVertical: 8, paddingHorizontal: 20, textTransform: 'uppercase', letterSpacing: 1 },

  transactionCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 20, marginBottom: 12, borderRadius: 16 },
  txIconContainer: { marginRight: 16 },
  txIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  txDetails: { flex: 1 },
  txDescription: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  txDate: { fontSize: 12 },
  txAmount: { fontSize: 16, fontWeight: '700' },

  emptyState: { alignItems: 'center', marginTop: 40, gap: 10 },
  emptyText: { fontSize: 16 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { padding: 16, borderRadius: 16, fontSize: 18, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelButton: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 16, backgroundColor: 'rgba(150,150,150,0.1)' },
  confirmButton: { flex: 1, backgroundColor: '#f27c22', padding: 16, alignItems: 'center', borderRadius: 16 },
  confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  recipientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(100,100,100,0.05)', padding: 12, borderRadius: 16, marginBottom: 16, gap: 12 },
  recipientAvatar: { width: 44, height: 44, borderRadius: 22 },
  recipientName: { fontWeight: 'bold', fontSize: 16 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: 12, borderRadius: 16, marginBottom: 16 }
});
