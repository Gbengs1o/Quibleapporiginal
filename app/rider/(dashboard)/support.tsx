import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export default function RiderSupport() {
    const router = useRouter();
    const { openMenu } = useRiderMenu();
    const iconColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');
    const cardBg = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');

    const options = [
        {
            title: 'Support',
            subtitle: 'Contact us via Call, Chat or Email',
            icon: 'headset',
            route: '/rider/(dashboard)/support-contact',
            color: '#F27C22'
        },
        {
            title: 'Help & Feedback',
            subtitle: 'FAQs and feedback form',
            icon: 'help-circle',
            route: '/rider/(dashboard)/help-feedback',
            color: '#4A90E2'
        }
    ];

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu}>
                    <Ionicons name="menu" size={28} color={iconColor} />
                </TouchableOpacity>
                <ThemedText style={styles.title}>Support & Help</ThemedText>
                <View style={{ width: 28 }} />
            </View>

            <View style={styles.content}>
                <ThemedText style={styles.greeting}>How can we help you today?</ThemedText>

                {options.map((opt, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.bigCard, { backgroundColor: cardBg }]}
                        onPress={() => router.push(opt.route as any)}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: opt.color + '15' }]}>
                            <Ionicons name={opt.icon as any} size={32} color={opt.color} />
                        </View>
                        <View style={styles.textContainer}>
                            <ThemedText style={[styles.cardTitle, { color: textColor }]}>{opt.title}</ThemedText>
                            <ThemedText style={styles.cardSubtitle}>{opt.subtitle}</ThemedText>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#ccc" />
                    </TouchableOpacity>
                ))}
            </View>
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
    title: { fontSize: 20, fontWeight: 'bold' },
    content: {
        flex: 1,
        padding: 24,
    },
    greeting: {
        fontSize: 18,
        opacity: 0.8,
        marginBottom: 24,
        textAlign: 'center',
    },
    bigCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        opacity: 0.6,
    }
});
