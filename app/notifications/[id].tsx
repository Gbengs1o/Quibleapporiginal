import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function NotificationDetail() {
    const { id } = useLocalSearchParams();
    const [notification, setNotification] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const secondaryText = useThemeColor({ light: '#666', dark: '#999' }, 'text');
    const cardBg = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'background');
    const buttonColor = '#F4821F';

    useEffect(() => {
        const fetchNotification = async () => {
            if (!id) return;
            try {
                const { data, error } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setNotification(data);

                // Mark as read
                if (!data.is_read) {
                    await supabase
                        .from('notifications')
                        .update({ is_read: true })
                        .eq('id', id);
                }
            } catch (error) {
                console.error('Error fetching notification:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNotification();
    }, [id]);

    if (loading) {
        return (
            <ThemedView style={styles.center}>
                <ActivityIndicator size="large" color={buttonColor} />
            </ThemedView>
        );
    }

    if (!notification) {
        return (
            <ThemedView style={styles.center}>
                <ThemedText>Notification not found</ThemedText>
            </ThemedView>
        );
    }

    const { title, message, created_at, meta_data, type } = notification;
    const actionLink = meta_data?.action_link;
    const color = meta_data?.color || (type === 'wallet' ? '#F4821F' : '#2196F3');
    const icon = meta_data?.icon || (type === 'wallet' ? 'wallet' : 'notifications');

    const formattedDate = new Date(created_at).toLocaleString();

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerTitle: '' }} />
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Header Icon */}
                <View style={styles.headerIconContainer}>
                    <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
                        <Ionicons name={icon} size={40} color={color} />
                    </View>
                </View>

                <ThemedText style={[styles.title, { color: textColor }]}>{title}</ThemedText>
                <ThemedText style={[styles.date, { color: secondaryText }]}>{formattedDate}</ThemedText>

                <View style={[styles.messageCard, { backgroundColor: cardBg }]}>
                    <ThemedText style={[styles.message, { color: textColor }]}>{message}</ThemedText>
                </View>

                {/* Chat notification: Reply button */}
                {type === 'chat' && meta_data?.chat_id && (
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                        onPress={() => router.push(`/order-chat/${meta_data.chat_id}`)}
                    >
                        <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                        <ThemedText style={styles.actionButtonText}>Reply to Message</ThemedText>
                    </TouchableOpacity>
                )}

                {actionLink && (
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: color }]}
                        onPress={() => router.push(actionLink)}
                    >
                        <ThemedText style={styles.actionButtonText}>View Details</ThemedText>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                )}

            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 20,
        alignItems: 'center',
    },
    headerIconContainer: {
        marginTop: 20,
        marginBottom: 20,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    date: {
        fontSize: 14,
        marginBottom: 30,
    },
    messageCard: {
        width: '100%',
        padding: 20,
        borderRadius: 16,
        marginBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    message: {
        fontSize: 16,
        lineHeight: 24,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        elevation: 2,
        gap: 8,
        width: '100%',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    }
});
