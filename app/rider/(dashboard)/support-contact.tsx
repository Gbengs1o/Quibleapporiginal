import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function SupportContactScreen() {
    const router = useRouter();
    const iconColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');
    const cardBg = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'background');

    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('support_config')
                .select('*')
                .single();

            if (data) {
                setConfig(data);
            }
        } catch (error) {
            console.error('Error fetching support config:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#F27C22" />
            </ThemedView>
        );
    }

    const supportOptions = [
        {
            icon: 'chatbubble-ellipses-outline',
            label: 'Live Chat',
            action: () => { /* Logic to open live chat modal or navigate */ },
            enabled: config?.live_chat_enabled
        },
        {
            icon: 'logo-whatsapp',
            label: 'WhatsApp Support',
            action: () => Linking.openURL(`whatsapp://send?phone=${config?.whatsapp_number}`),
            enabled: config?.whatsapp_enabled
        },
        {
            icon: 'call-outline',
            label: 'Call Support',
            action: () => Linking.openURL(`tel:${config?.call_center_number}`),
            enabled: config?.call_center_enabled
        },
        {
            icon: 'mail-outline',
            label: 'Email Us',
            action: () => Linking.openURL(`mailto:${config?.email_address}`),
            enabled: config?.email_enabled
        },
    ];

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={iconColor} />
                </TouchableOpacity>
                <ThemedText style={styles.title}>Contact Support</ThemedText>
                <View style={{ width: 40 }} />
            </View>
            <View style={styles.content}>
                <ThemedText style={styles.subtitle}>Get in touch with us directly</ThemedText>
                {supportOptions.map((option, index) => {
                    if (!option.enabled) return null;
                    return (
                        <TouchableOpacity
                            key={index}
                            style={[styles.optionRow, { backgroundColor: cardBg }]}
                            onPress={option.action}
                        >
                            <View style={styles.optionIcon}>
                                <Ionicons name={option.icon as any} size={24} color="#F27C22" />
                            </View>
                            <ThemedText style={styles.optionLabel}>{option.label}</ThemedText>
                            <Ionicons name="chevron-forward" size={20} color="#999" />
                        </TouchableOpacity>
                    );
                })}
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
        gap: 12,
    },
    subtitle: { fontSize: 16, opacity: 0.7, marginBottom: 16 },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 14,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    optionIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(242,124,34,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
});
