import LogoLoader from '@/components/LogoLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  buildReferralShareMessage,
  DEFAULT_REFERRAL_SETTINGS,
  mergeReferralSettings,
  ReferralSystemSettings,
} from '@/utils/referral';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const InviteAFriendScreen = () => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({ light: '#F4F5F9', dark: '#0D0D1A' }, 'background');
  const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'background');
  const textColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');
  const subtextColor = useThemeColor({ light: '#6B7280', dark: '#A0A0B0' }, 'text');
  const borderColor = useThemeColor({ light: '#E0E0E0', dark: '#3D3D5C' }, 'background');

  const [referralCode, setReferralCode] = useState<string>('');
  const [stats, setStats] = useState({ totalReferred: 0, totalEarned: 0, pendingEarned: 0 });
  const [settings, setSettings] = useState<ReferralSystemSettings>(DEFAULT_REFERRAL_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Load referral settings
      const { data: settingData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'referral_system')
        .single();

      const mergedSettings = mergeReferralSettings(settingData?.value);
      setSettings(mergedSettings);

      // 2. Ensure user has a referral code
      const { data: profileData } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      let code = (profileData?.referral_code || '').trim().toUpperCase();
      if (!code) {
        const { data: ensured } = await supabase.rpc('ensure_my_referral_code');
        if ((ensured as any)?.success) {
          code = String((ensured as any)?.referral_code || '').trim().toUpperCase();
        }
      }
      setReferralCode(code);

      // 3. Get stats
      const { count: referredCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by_id', user.id);

      const { data: earnings } = await supabase
        .from('referral_earnings')
        .select('amount, status')
        .eq('referrer_id', user.id);

      const totalEarned = earnings?.filter(e => e.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      const pendingEarned = earnings?.filter(e => e.status !== 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

      setStats({
        totalReferred: Number(referredCount || 0),
        totalEarned,
        pendingEarned
      });
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard.');
  };

  const handleShare = async () => {
    try {
      if (!referralCode) {
        Alert.alert('Referral', 'Your referral code is still loading. Please try again.');
        return;
      }

      const shareMessage = buildReferralShareMessage(settings, referralCode);
      await Share.share({
        message: shareMessage,
        title: 'Invite Friends to Quible'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <LogoLoader size={60} />
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <ThemedView style={[styles.loadingContainer, { backgroundColor }]}>
        <ThemedText style={{ color: textColor, fontSize: 16, fontWeight: '600' }}>
          Sign in to use referrals.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Header Section */}
        <LinearGradient
          colors={['#1F2050', '#3D3D5C']}
          style={[styles.header, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.headerTop}>
            <Animated.View entering={FadeInUp.duration(600)} style={styles.headerTitleRow}>
              <LogoLoader size={50} color="#F27C22" />
              <View style={styles.headerTitleTextWrapper}>
                <ThemedText style={styles.headerTitle}>Invite & Earn</ThemedText>
                <ThemedText style={styles.headerSubtitle}>
                  {settings.banner_subtitle}
                </ThemedText>
              </View>
            </Animated.View>
          </View>

          {/* Banner Image Placeholder/Illustration */}
          {settings.enabled && settings.is_banner_visible && (
            <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.bannerContainer}>
              <LinearGradient
                colors={['rgba(242,124,34,0.1)', 'rgba(242,124,34,0.05)']}
                style={styles.bannerBackground}
              >
                <Ionicons name="gift" size={80} color="#F27C22" style={styles.bannerIcon} />
                <View style={styles.bannerTextContainer}>
                  <ThemedText style={styles.bannerTitle}>{settings.banner_title}</ThemedText>
                  <ThemedText style={styles.bannerDesc}>
                    Earn {settings.reward_type === 'percentage' ? `${settings.reward_value}%` : `N${settings.reward_value}`} when your friend qualifies.
                  </ThemedText>
                </View>
              </LinearGradient>
            </Animated.View>
          )}
        </LinearGradient>

        <View style={styles.content}>
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={[styles.statLabel, { color: subtextColor }]}>Total Referred</ThemedText>
              <ThemedText style={[styles.statValue, { color: textColor }]}>{stats.totalReferred}</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={[styles.statLabel, { color: subtextColor }]}>Total Earned</ThemedText>
              <ThemedText style={[styles.statValue, { color: '#22C55E' }]}>N{stats.totalEarned.toLocaleString()}</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={[styles.statLabel, { color: subtextColor }]}>Pending</ThemedText>
              <ThemedText style={[styles.statValue, { color: '#F27C22' }]}>N{stats.pendingEarned.toLocaleString()}</ThemedText>
            </View>
          </View>

          {/* Referral Code Selection */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={[styles.codeSection, { backgroundColor: cardBg }]}>
            <ThemedText style={[styles.sectionTitle, { color: subtextColor }]}>{settings.popup_code_label}</ThemedText>
            <View style={styles.codeWrapper}>
              <View style={[styles.codeDisplay, { backgroundColor, borderColor }]}>
                <ThemedText style={[styles.codeText, { color: textColor }]}>{referralCode}</ThemedText>
              </View>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                <Ionicons name="copy-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Share Button */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <LinearGradient
              colors={['#F27C22', '#E86A10']}
              style={styles.shareBtnGradient}
            >
              <Ionicons name="share-social" size={24} color="#fff" style={{ marginRight: 10 }} />
              <ThemedText style={styles.shareBtnText}>{settings.banner_cta_text}</ThemedText>
            </LinearGradient>
          </TouchableOpacity>

          {/* Information Section */}
          <View style={[styles.infoSection, { backgroundColor: cardBg }]}>
            <ThemedText style={[styles.infoTitle, { color: textColor }]}>How it works</ThemedText>
            <View style={styles.infoItem}>
              <View style={styles.infoIconWrapper}>
                <ThemedText style={styles.infoStep}>1</ThemedText>
              </View>
              <View style={styles.infoTextWrapper}>
                <ThemedText style={[styles.infoItemTitle, { color: textColor }]}>Share your code</ThemedText>
                <ThemedText style={[styles.infoItemDesc, { color: subtextColor }]}>Send your unique referral code to your friends.</ThemedText>
              </View>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoIconWrapper}>
                <ThemedText style={styles.infoStep}>2</ThemedText>
              </View>
              <View style={styles.infoTextWrapper}>
                <ThemedText style={[styles.infoItemTitle, { color: textColor }]}>Friend signs up</ThemedText>
                <ThemedText style={[styles.infoItemDesc, { color: subtextColor }]}>Your friend signs up using your referral code.</ThemedText>
              </View>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoIconWrapper}>
                <ThemedText style={styles.infoStep}>3</ThemedText>
              </View>
              <View style={styles.infoTextWrapper}>
                <ThemedText style={[styles.infoItemTitle, { color: textColor }]}>Earn rewards</ThemedText>
                <ThemedText style={[styles.infoItemDesc, { color: subtextColor }]}>
                  Receive your reward when they complete their first {settings.min_order_amount ? `N${settings.min_order_amount}+` : ''} order.
                </ThemedText>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F5F9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  headerTitleTextWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  adminBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 10,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  bannerContainer: {
    marginTop: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bannerBackground: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(242,124,34,0.2)',
  },
  bannerIcon: {
    marginRight: 16,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F27C22',
  },
  bannerDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  content: {
    paddingHorizontal: 24,
    marginTop: -20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    width: (width - 64) / 3,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2050',
  },
  codeSection: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  codeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeDisplay: {
    flex: 1,
    backgroundColor: '#F8F9FC',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  codeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2050',
    letterSpacing: 4,
  },
  copyBtn: {
    backgroundColor: '#1F2050',
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  shareBtn: {
    marginBottom: 32,
  },
  shareBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#F27C22',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  shareBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  infoSection: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 24,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2050',
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  infoIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(242,124,34,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoStep: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F27C22',
  },
  infoTextWrapper: {
    flex: 1,
  },
  infoItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2050',
    marginBottom: 4,
  },
  infoItemDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});

export default InviteAFriendScreen;
