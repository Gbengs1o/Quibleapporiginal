import GlitchLogo from '@/components/GlitchLogo'; // The new component
import LogoLoader from '@/components/LogoLoader';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// ============ QUIBLE THEME ============
const NAVY = '#1F2050';
const NAVY_LIGHT = 'rgba(31, 32, 80, 0.05)';
const NAVY_MEDIUM = 'rgba(31, 32, 80, 0.1)';
const ACCENT = '#F27C22'; // Orange accent for small details

const SUPPORT_OPTIONS = [
  {
    id: 'live-chat',
    title: 'Live Chat',
    subtitle: 'Talk to an agent instantly',
    icon: 'chatbubbles-outline',
    action: 'route',
    path: '/live-chat'
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp Support',
    subtitle: 'Chat with us on WhatsApp',
    icon: 'logo-whatsapp',
    action: 'link',
    url: 'https://wa.me/1234567890'
  },
  {
    id: 'email',
    title: 'Email Us',
    subtitle: 'Get a response within 24h',
    icon: 'mail-outline',
    action: 'link',
    url: 'mailto:support@quible.com'
  },
  {
    id: 'call',
    title: 'Call Center',
    subtitle: 'Speak with a representative',
    icon: 'call-outline',
    action: 'link',
    url: 'tel:+1234567890'
  },
];

const FAQS = [
  { id: 1, question: 'Where is my order?', answer: 'You can track your order in real-time from the "Orders" tab.' },
  { id: 2, question: 'How do I change my address?', answer: 'Go to Profile > Saved Addresses to manage your locations.' },
  { id: 3, question: 'Payment/Refund issues?', answer: 'Please contact Live Chat for immediate assistance with payments.' },
];





export default function SupportScreen() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('support_config')
        .select('*')
        .single();

      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error('Error fetching support config:', error);
    } finally {
      setLoading(false);
    }
  };

  const colors = {
    bg: isDark ? '#0A0A0F' : '#FFFFFF',
    card: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : NAVY,
    textSec: isDark ? '#8E8E93' : '#6B7280',
    border: isDark ? 'rgba(255,255,255,0.1)' : NAVY_MEDIUM,
    iconBg: isDark ? 'rgba(255,255,255,0.1)' : NAVY_LIGHT,
  };

  const dynamicOptions = [
    {
      id: 'live-chat',
      title: 'Live Chat',
      subtitle: 'Talk to an agent instantly',
      icon: 'chatbubbles-outline',
      action: 'route',
      path: '/live-chat',
      enabled: config?.live_chat_enabled ?? true
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp Support',
      subtitle: 'Chat with us on WhatsApp',
      icon: 'logo-whatsapp',
      action: 'link',
      url: `https://wa.me/${config?.whatsapp_number?.replace(/\D/g, '')}`,
      enabled: config?.whatsapp_enabled ?? true
    },
    {
      id: 'email',
      title: 'Email Us',
      subtitle: 'Get a response within 24h',
      icon: 'mail-outline',
      action: 'link',
      url: `mailto:${config?.email_address || 'support@quible.com'}`,
      enabled: config?.email_enabled ?? true
    },
    {
      id: 'call',
      title: 'Call Center',
      subtitle: 'Speak with a representative',
      icon: 'call-outline',
      action: 'link',
      url: `tel:${config?.call_center_number?.replace(/\D/g, '')}`,
      enabled: config?.call_center_enabled ?? false
    },
  ].filter(opt => opt.enabled);

  const handleAction = (option: any) => {
    if (option.action === 'route' && option.path) {
      router.push(option.path as any);
    } else if (option.action === 'link' && option.url) {
      Linking.openURL(option.url);
    }
  };



  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <LogoLoader size={80} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Area with Glitch Logo */}
        <View style={styles.heroSection}>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Help Center</ThemedText>
          <ThemedText style={[styles.headerSub, { color: colors.textSec }]}>We're here to help you 24/7</ThemedText>

          <View style={styles.logoContainer}>
            <GlitchLogo />
          </View>
        </View>

        {/* Support Options Grid */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.optionsGrid}>
          {dynamicOptions.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleAction(option)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
                <Ionicons name={option.icon as any} size={24} color={isDark ? '#FFF' : NAVY} />
              </View>
              <ThemedText style={[styles.optionTitle, { color: colors.text }]}>{option.title}</ThemedText>
              <ThemedText style={[styles.optionSub, { color: colors.textSec }]}>{option.subtitle}</ThemedText>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* FAQ Section */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.faqSection}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Frequently Asked Questions</ThemedText>
          {FAQS.map((faq, index) => (
            <View key={faq.id} style={[styles.faqCard, { borderBottomColor: colors.border }]}>
              <ThemedText style={[styles.faqQuestion, { color: colors.text }]}>{faq.question}</ThemedText>
              <ThemedText style={[styles.faqAnswer, { color: colors.textSec }]}>{faq.answer}</ThemedText>
            </View>
          ))}
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Increased to clear tab bar
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 30,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  headerSub: {
    fontSize: 16,
    marginBottom: 30,
  },
  logoContainer: {
    height: 180, // Enough space for the glitch logo
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 15,
  },
  optionCard: {
    width: (width - 55) / 2, // 2 columns with gap
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    textAlign: 'center',
  },
  optionSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  faqSection: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  faqCard: {
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
});
