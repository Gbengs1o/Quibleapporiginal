import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function HelpFeedbackScreen() {
    const router = useRouter();
    const iconColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');
    const cardBg = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'background');

    const faqs = [
        { q: "How do I change my vehicle details?", a: "Go to Profile > Vehicle Information to update your details." },
        { q: "When do I get paid?", a: "Payments are processed weekly on Tuesdays." },
        { q: "How is my rating calculated?", a: "Your rating is an average of the last 100 deliveries." },
    ];

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={iconColor} />
                </TouchableOpacity>
                <ThemedText style={styles.title}>Help & Feedback</ThemedText>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                <ThemedText style={styles.sectionTitle}>Frequently Asked Questions</ThemedText>

                {faqs.map((faq, index) => (
                    <View key={index} style={[styles.faqCard, { backgroundColor: cardBg }]}>
                        <ThemedText style={styles.question}>{faq.q}</ThemedText>
                        <ThemedText style={styles.answer}>{faq.a}</ThemedText>
                    </View>
                ))}

                <ThemedText style={[styles.sectionTitle, { marginTop: 24 }]}>Feedback</ThemedText>
                <TouchableOpacity style={[styles.feedbackButton, { backgroundColor: cardBg }]}>
                    <Ionicons name="document-text-outline" size={24} color="#F27C22" />
                    <ThemedText style={styles.feedbackText}>Submit Feedback or Report a Bug</ThemedText>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    title: { fontSize: 20, fontWeight: 'bold' },
    content: {
        flex: 1,
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
        color: '#F27C22',
    },
    faqCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    question: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    answer: {
        fontSize: 14,
        opacity: 0.7,
        lineHeight: 20,
    },
    feedbackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 12,
        gap: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    feedbackText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
    }
});
