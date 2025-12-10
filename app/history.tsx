import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useWallet } from '@/contexts/wallet';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const BRAND_DARK = '#1F2050';
const PRIMARY_ORANGE = '#f27c22';
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function HistoryScreen() {
  const { transactions, isLoading, refreshWallet } = useWallet();

  // State
  const [activeTab, setActiveTab] = useState<'transactions' | 'analytics'>('transactions');
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [selectedTx, setSelectedTx] = useState<any>(null);

  // Date Filter State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Theme Colors
  const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
  const secondaryText = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
  const inputBg = useThemeColor({ light: '#f5f5f5', dark: '#2c2c2e' }, 'background');
  const sectionHeaderBg = useThemeColor({ light: '#fff', dark: '#000' }, 'background');

  const formatCurrency = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // --- Filtering Logic ---
  const getFilteredTransactions = () => {
    let filtered = transactions;

    if (filterType === 'Credit') filtered = filtered.filter(tx => tx.type === 'credit');
    else if (filterType === 'Debit') filtered = filtered.filter(tx => tx.type === 'debit');

    if (selectedDate) {
      filtered = filtered.filter(tx => {
        const txDate = new Date(tx.created_at);
        return (
          txDate.getDate() === selectedDate.getDate() &&
          txDate.getMonth() === selectedDate.getMonth() &&
          txDate.getFullYear() === selectedDate.getFullYear()
        );
      });
    }

    if (searchText) {
      filtered = filtered.filter(tx =>
        tx.description.toLowerCase().includes(searchText.toLowerCase()) ||
        tx.amount.toString().includes(searchText) ||
        (tx.location?.address && tx.location.address.toLowerCase().includes(searchText.toLowerCase()))
      );
    }
    return filtered;
  };

  const filteredTx = getFilteredTransactions();

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

  const groupedTx = groupTransactions(filteredTx);

  // --- Analytics Data ---
  const analyticsData = useMemo(() => {
    // Generate data for the last 6 months or based on filteredTx if we want dynamic
    // Let's do a simple aggregation of the filtered transactions for the chart
    // If no filter, show last 6 months.

    // Group by month
    const months: any = {};
    const labels: string[] = [];
    const incomeData: number[] = [];
    const expenseData: number[] = [];

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString('default', { month: 'short' });
      months[key] = { income: 0, expense: 0 };
      labels.push(key);
    }

    transactions.forEach(tx => {
      const d = new Date(tx.created_at);
      const key = d.toLocaleString('default', { month: 'short' });
      if (months[key]) {
        if (tx.type === 'credit') months[key].income += Number(tx.amount);
        else months[key].expense += Number(tx.amount);
      }
    });

    labels.forEach(l => {
      incomeData.push(months[l].income);
      expenseData.push(months[l].expense);
    });

    return { labels, incomeData, expenseData };
  }, [transactions]);

  // --- PDF Export ---
  const exportPDF = async () => {
    try {
      let htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 20px; }
              h1 { color: #1F2050; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }
              th { background-color: #f2f2f2; color: #1F2050; }
              .credit { color: green; }
              .debit { color: red; }
            </style>
          </head>
          <body>
            <h1>Transaction History</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <table>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Location</th>
              </tr>
      `;

      filteredTx.forEach(tx => {
        htmlContent += `
          <tr>
            <td>${new Date(tx.created_at).toLocaleDateString()} ${new Date(tx.created_at).toLocaleTimeString()}</td>
            <td>${tx.description}</td>
            <td class="${tx.type}">${tx.type.toUpperCase()}</td>
            <td class="${tx.type}">${tx.type === 'credit' ? '+' : '-'}${formatCurrency(tx.amount)}</td>
            <td>${tx.location?.address || 'N/A'}</td>
          </tr>
        `;
      });

      htmlContent += `
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      console.error("PDF Error", error);
    }
  };

  // --- Date Picker Logic ---
  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  // --- Render Components ---

  const renderAnalytics = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <View style={[styles.chartCard, { backgroundColor: cardBg }]}>
        <ThemedText style={[styles.chartTitle, { color: textColor }]}>Income Stream</ThemedText>
        <LineChart
          data={{
            labels: analyticsData.labels,
            datasets: [{ data: analyticsData.incomeData, color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})` }]
          }}
          width={SCREEN_WIDTH - 60}
          height={220}
          yAxisLabel="₦"
          chartConfig={{
            backgroundColor: cardBg,
            backgroundGradientFrom: cardBg,
            backgroundGradientTo: cardBg,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
            labelColor: (opacity = 1) => secondaryText,
            propsForDots: { r: "4", strokeWidth: "2", stroke: "#22c55e" }
          }}
          bezier
          style={{ borderRadius: 16, marginVertical: 8 }}
        />
      </View>

      <View style={[styles.chartCard, { backgroundColor: cardBg, marginTop: 20 }]}>
        <ThemedText style={[styles.chartTitle, { color: textColor }]}>Spending Analysis</ThemedText>
        <LineChart
          data={{
            labels: analyticsData.labels,
            datasets: [{ data: analyticsData.expenseData, color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})` }]
          }}
          width={SCREEN_WIDTH - 60}
          height={220}
          yAxisLabel="₦"
          chartConfig={{
            backgroundColor: cardBg,
            backgroundGradientFrom: cardBg,
            backgroundGradientTo: cardBg,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
            labelColor: (opacity = 1) => secondaryText,
            propsForDots: { r: "4", strokeWidth: "2", stroke: "#ef4444" }
          }}
          bezier
          style={{ borderRadius: 16, marginVertical: 8 }}
        />
      </View>
    </ScrollView>
  );

  const renderTransaction = ({ item: tx }: { item: any }) => {
    const isCredit = tx.type === 'credit';
    const isTransfer = tx.description.toLowerCase().includes('transfer');

    let iconName: any = isCredit ? "arrow-down" : "arrow-up";
    let iconColor = isCredit ? "#22c55e" : "#ef4444";
    let bg = isCredit ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)";

    if (isTransfer) {
      iconName = "paper-plane";
      if (!isCredit) {
        iconColor = "#3b82f6";
        bg = "rgba(59, 130, 246, 0.1)";
      }
    }

    return (
      <TouchableOpacity
        style={[styles.transactionCard, { backgroundColor: cardBg }]}
        onPress={() => setSelectedTx(tx)}
      >
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
            {new Date(tx.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </ThemedText>
          {tx.location?.address && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Ionicons name="location-outline" size={10} color={secondaryText} />
              <ThemedText style={{ fontSize: 10, color: secondaryText, marginLeft: 2 }}>Unknown Location</ThemedText>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText style={[styles.txAmount, { color: isCredit ? "#22c55e" : textColor }]}>
            {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header with Tabs */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20 }}>
        <ThemedText type="title" style={{ color: textColor, marginBottom: 20 }}>History</ThemedText>
        <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => setActiveTab('transactions')} style={[styles.tab, activeTab === 'transactions' && styles.activeTab]}>
            <ThemedText style={[styles.tabText, activeTab === 'transactions' && styles.activeTabText]}>Transactions</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('analytics')} style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}>
            <ThemedText style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>Analytics</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'analytics' ? renderAnalytics() : (
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
            <View style={styles.listHeader}>
              {/* Filters & Export */}
              <View style={styles.filterRow}>
                <TouchableOpacity onPress={() => setFilterType('All')} style={[styles.filterChip, filterType === 'All' && { backgroundColor: BRAND_DARK }]}>
                  <ThemedText style={[styles.filterText, filterType === 'All' && { color: '#fff' }]}>All</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFilterType('Credit')} style={[styles.filterChip, filterType === 'Credit' && { backgroundColor: BRAND_DARK }]}>
                  <ThemedText style={[styles.filterText, filterType === 'Credit' && { color: '#fff' }]}>Income</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFilterType('Debit')} style={[styles.filterChip, filterType === 'Debit' && { backgroundColor: BRAND_DARK }]}>
                  <ThemedText style={[styles.filterText, filterType === 'Debit' && { color: '#fff' }]}>Expense</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.searchRow}>
                <View style={[styles.searchContainer, { backgroundColor: inputBg, flex: 1 }]}>
                  <Ionicons name="search" size={20} color={secondaryText} />
                  <TextInput
                    style={[styles.searchInput, { color: textColor }]}
                    placeholder="Search date, location, amount..."
                    placeholderTextColor={secondaryText}
                    value={searchText}
                    onChangeText={setSearchText}
                  />
                </View>

                <TouchableOpacity style={styles.iconButton} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar" size={24} color={BRAND_DARK} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.iconButton} onPress={exportPDF}>
                  <Ionicons name="print" size={24} color={BRAND_DARK} />
                </TouchableOpacity>
              </View>

              {selectedDate && (
                <View style={styles.dateBadge}>
                  <ThemedText style={{ color: '#fff', fontSize: 12 }}>{selectedDate.toLocaleDateString()}</ThemedText>
                  <TouchableOpacity onPress={() => setSelectedDate(null)}>
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={secondaryText} />
              <ThemedText style={[styles.emptyText, { color: secondaryText }]}>No documentation found</ThemedText>
            </View>
          }
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshWallet} tintColor={PRIMARY_ORANGE} />}
        />
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
        />
      )}

      {/* Detail Modal */}
      {selectedTx && (
        <Modal visible={true} transparent animationType="slide" onRequestClose={() => setSelectedTx(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.detailCard, { backgroundColor: cardBg }]}>
              <View style={styles.detailHeader}>
                <ThemedText style={styles.detailTitle}>Transaction Details</ThemedText>
                <TouchableOpacity onPress={() => setSelectedTx(null)}>
                  <Ionicons name="close" size={24} color={textColor} />
                </TouchableOpacity>
              </View>

              <View style={styles.amountContainer}>
                <ThemedText style={[styles.detailAmount, { color: selectedTx.type === 'credit' ? '#22c55e' : textColor }]}>
                  {selectedTx.type === 'credit' ? '+' : '-'}{formatCurrency(selectedTx.amount)}
                </ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                  <ThemedText style={{ color: '#22c55e', fontWeight: 'bold', fontSize: 12 }}>SUCCESSFUL</ThemedText>
                </View>
              </View>

              <ScrollView>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Description</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: textColor }]}>{selectedTx.description}</ThemedText>
                </View>
                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Date & Time</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: textColor }]}>
                    {new Date(selectedTx.created_at).toLocaleString()}
                  </ThemedText>
                </View>
                <View style={styles.divider} />

                {selectedTx.location && (
                  <>
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Location</ThemedText>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="location" size={16} color={BRAND_DARK} />
                        <ThemedText style={[styles.detailValue, { color: textColor, marginLeft: 5 }]}>
                          {selectedTx.location.lat ? `${selectedTx.location.lat.toFixed(4)}, ${selectedTx.location.long.toFixed(4)}` : 'Location Captured'}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.divider} />
                  </>
                )}

                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Reference ID</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: secondaryText, fontSize: 12 }]}>{selectedTx.id}</ThemedText>
                </View>
              </ScrollView>

              <TouchableOpacity style={[styles.closeButton, { backgroundColor: BRAND_DARK }]} onPress={() => setSelectedTx(null)}>
                <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Close</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContent: { padding: 20, paddingTop: 60, paddingBottom: 10 },
  listHeader: { padding: 20 },

  // Tabs
  tabContainer: { flexDirection: 'row', marginBottom: 10, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontWeight: '600', color: '#666' },
  activeTabText: { color: BRAND_DARK },

  // Filters
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  filterChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)' },
  filterText: { fontWeight: '600', fontSize: 14, color: '#666' },

  searchRow: { flexDirection: 'row', gap: 10 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  iconButton: { padding: 12, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  dateBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND_DARK, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 10, gap: 8 },

  sectionHeader: { fontSize: 14, fontWeight: '600', paddingVertical: 8, paddingHorizontal: 20, textTransform: 'uppercase', letterSpacing: 1 },

  transactionCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 20, marginBottom: 12, borderRadius: 16 },
  txIconContainer: { marginRight: 16 },
  txIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  txDetails: { flex: 1 },
  txDescription: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  txDate: { fontSize: 12 },
  txAmount: { fontSize: 16, fontWeight: '700' },

  emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { fontSize: 16 },

  // Charts
  chartCard: { padding: 16, borderRadius: 24, marginHorizontal: 20 },
  chartTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  detailCard: { width: '100%', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, maxHeight: '80%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  detailTitle: { fontSize: 20, fontWeight: 'bold' },
  amountContainer: { alignItems: 'center', marginBottom: 32 },
  detailAmount: { fontSize: 36, fontWeight: '800', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  detailRow: { marginBottom: 16 },
  detailLabel: { fontSize: 12, color: '#888', marginBottom: 4, textTransform: 'uppercase' },
  detailValue: { fontSize: 16, fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: 16 },
  closeButton: { padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 }
});
