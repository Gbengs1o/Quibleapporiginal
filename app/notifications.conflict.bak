import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';

type NotificationRole = 'personal' | 'business';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  recipient_role: NotificationRole;
  created_at: string;
  meta_data?: any;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<NotificationRole>('personal');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
  const secondaryText = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
  const accentColor = '#f27c22';

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, activeTab]);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user?.id)
      .eq('recipient_role', activeTab)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotifications(data as Notification[]);
    }
    setLoading(false);
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={item.type === 'new_order' ? 'restaurant' : (item.type === 'cancelled' ? 'close-circle' : 'notifications')}
          size={24}
          color={accentColor}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.row}>
          <ThemedText style={styles.title}>{item.title}</ThemedText>
          <ThemedText style={styles.date}>
            {new Date(item.created_at).toLocaleDateString()}
          </ThemedText>
        </View>
        <ThemedText style={[styles.message, { color: secondaryText }]}>
          {item.message}
        </ThemedText>
      </View>
      {!item.is_read && <View style={styles.unreadDot} />}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.header}>Notifications</ThemedText>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'personal' && styles.activeTab]}
          onPress={() => setActiveTab('personal')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'personal' && styles.activeTabText]}>Personal</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'business' && styles.activeTab]}
          onPress={() => setActiveTab('business')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'business' && styles.activeTabText]}>Business</ThemedText>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchNotifications} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color={secondaryText} />
              <ThemedText style={{ color: secondaryText, marginTop: 10 }}>No notifications yet.</ThemedText>
            </View>
          ) : null
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { paddingHorizontal: 20, marginBottom: 20 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 15 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)' },
  activeTab: { backgroundColor: '#f27c22' },
  tabText: { fontWeight: '600', color: '#666' },
  activeTabText: { color: '#fff' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { flexDirection: 'row', padding: 16, borderRadius: 16, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(242, 124, 34, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontWeight: 'bold', fontSize: 15 },
  date: { fontSize: 11, color: '#999' },
  message: { fontSize: 13, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f27c22', marginLeft: 10 },
  emptyState: { alignItems: 'center', marginTop: 100 }
});
