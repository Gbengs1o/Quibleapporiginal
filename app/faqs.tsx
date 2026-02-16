import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  icon: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    title: 'Order & Tracking',
    icon: 'time-outline',
    items: [
      {
        id: '1',
        question: 'How do I track my order?',
        answer: 'You can track your order in real-time by going to the "Orders" tab in the bottom navigation. Select your active order to see its current status and the rider\'s location on the map.',
      },
      {
        id: '2',
        question: 'Can I cancel my order?',
        answer: 'Orders can only be cancelled before the restaurant starts preparing your food. Once preparation has begun, cancellation is not possible to avoid food waste.',
      },
      {
        id: '3',
        question: 'What if my order is delayed?',
        answer: 'While we strive for speed, delays can happen due to traffic or weather. If your order is significantly delayed, please contact our support team through the "Help & Feedback" section.',
      },
    ],
  },
  {
    title: 'Payments & Refunds',
    icon: 'card-outline',
    items: [
      {
        id: '4',
        question: 'What payment methods do you accept?',
        answer: 'We accept Quible Wallet payments, Bank Transfers, and Card payments processed securely via Monnify.',
      },
      {
        id: '5',
        question: 'How do I get a refund?',
        answer: 'If your order was cancelled or unsuccessful but your wallet was debited, the amount will be automatically refunded to your Quible Wallet within minutes. For other issues, please contact support.',
      },
      {
        id: '6',
        question: 'Is it safe to save my card details?',
        answer: 'Yes, we do not store your card details on our servers. All transactions are processed through highly secure, bank-grade encrypted payment gateways.',
      },
    ],
  },
  {
    title: 'Riders & Deliveries',
    icon: 'bicycle-outline',
    items: [
      {
        id: '7',
        question: 'How much is the delivery fee?',
        answer: 'Delivery fees are calculated based on the distance between the restaurant and your location. The base fee is ₦500, with an additional ₦100 per kilometer.',
      },
      {
        id: '8',
        question: 'Can I change my delivery address?',
        answer: 'To ensure accuracy, the delivery address cannot be changed once an order is placed. Please verify your address carefully before confirming.',
      },
    ],
  },
  {
    title: 'Partners & Rider Program',
    icon: 'business-outline',
    items: [
      {
        id: '9',
        question: 'How can I become a Rider?',
        answer: 'You can sign up as a rider in the app by going to "Profile" and selecting "Become a Rider". You\'ll need to provide valid IDs and vehicle documentation.',
      },
      {
        id: '10',
        question: 'How do I register my restaurant?',
        answer: 'Restaurant partners can join by selecting "Join as Restaurant" in the profile settings. Our team will review your application and visit your location for verification.',
      },
    ],
  },
];

const AccordionItem = ({ item, expanded, onToggle }: { item: FAQItem; expanded: boolean; onToggle: () => void }) => {
  const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
  const secondaryText = useThemeColor({ light: '#666', dark: '#888' }, 'text');
  const borderColor = useThemeColor({ light: 'rgba(0,0,0,0.05)', dark: 'rgba(255,255,255,0.05)' }, 'background');

  return (
    <View style={[styles.accordionItem, { borderBottomColor: borderColor }]}>
      <TouchableOpacity onPress={onToggle} style={styles.accordionHeader} activeOpacity={0.7}>
        <ThemedText style={[styles.questionText, { color: textColor }]}>{item.question}</ThemedText>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#f27c22"
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.answerContainer}>
          <ThemedText style={[styles.answerText, { color: secondaryText }]}>{item.answer}</ThemedText>
        </View>
      )}
    </View>
  );
};

export default function FAQScreen() {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(FAQ_DATA[0].title);

  const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
  const secondaryText = useThemeColor({ light: '#666', dark: '#888' }, 'text');
  const inputBg = useThemeColor({ light: '#f5f5f5', dark: '#2c2c2e' }, 'background');

  const toggleAccordion = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const currentCategory = FAQ_DATA.find(c => c.title === activeCategory) || FAQ_DATA[0];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <View>
          <ThemedText type="title" style={styles.title}>FAQs</ThemedText>
          <ThemedText style={{ color: secondaryText, fontSize: 13 }}>Find answers to common questions</ThemedText>
        </View>
      </View>

      {/* Support Hero Card */}
      <View style={[styles.heroCard, { backgroundColor: '#f27c22' }]}>
        <View style={styles.heroContent}>
          <ThemedText style={styles.heroTitle}>Need more help?</ThemedText>
          <ThemedText style={styles.heroSubtitle}>Our support team is always here for you.</ThemedText>
          <TouchableOpacity style={styles.heroBtn} onPress={() => router.replace('/(tabs)/Support')}>
            <ThemedText style={styles.heroBtnText}>Get Support</ThemedText>
          </TouchableOpacity>
        </View>
        <Ionicons name="chatbubbles-outline" size={80} color="rgba(255,255,255,0.2)" style={styles.heroIcon} />
      </View>

      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        {FAQ_DATA.map((cat) => (
          <TouchableOpacity
            key={cat.title}
            onPress={() => {
              setActiveCategory(cat.title);
              setExpandedId(null);
            }}
            style={[
              styles.categoryTab,
              { backgroundColor: activeCategory === cat.title ? '#f27c22' : inputBg }
            ]}
          >
            <Ionicons
              name={cat.icon as any}
              size={18}
              color={activeCategory === cat.title ? '#fff' : secondaryText}
            />
            <ThemedText
              style={[
                styles.categoryText,
                { color: activeCategory === cat.title ? '#fff' : textColor }
              ]}
            >
              {cat.title}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAQ List */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        <View style={[styles.faqCard, { backgroundColor: cardBg }]}>
          {currentCategory.items.map((item) => (
            <AccordionItem
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => toggleAccordion(item.id)}
            />
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    gap: 15,
  },
  backBtn: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  heroCard: {
    margin: 20,
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  heroContent: {
    flex: 1,
    zIndex: 1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 16,
  },
  heroBtn: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: '#f27c22',
    fontWeight: 'bold',
    fontSize: 14,
  },
  heroIcon: {
    position: 'absolute',
    right: -10,
    bottom: -10,
  },
  categoryScroll: {
    flexGrow: 0,
    marginBottom: 10,
  },
  categoryContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  faqCard: {
    borderRadius: 24,
    padding: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  accordionItem: {
    borderBottomWidth: 1,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  questionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginRight: 10,
  },
  answerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  answerText: {
    fontSize: 15,
    lineHeight: 24,
  },
});
