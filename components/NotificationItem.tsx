import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';

interface NotificationItemProps {
    id: string;
    title: string;
    message: string;
    type: string; // 'wallet', 'order', 'system', etc.
    isRead: boolean;
    createdAt: string;
    metaData?: any;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
    id,
    title,
    message,
    type,
    isRead,
    createdAt,
    metaData,
}) => {
    const router = useRouter();
    const cardBg = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'background');
    const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const subTextColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');

    // Determine styling based on type/metadata
    let iconName: any = 'notifications';
    let iconColor = '#666';
    let iconBg = '#eee';
    let categoryLabel = 'System';

    // Use metadata color/icon if available, else fallback to type defaults
    if (metaData?.color) iconColor = metaData.color;
    if (metaData?.icon) iconName = metaData.icon;

    if (!metaData?.color) {
        switch (type) {
            case 'wallet':
                iconName = 'wallet';
                iconColor = '#F4821F'; // Gold/Orange
                iconBg = 'rgba(244, 130, 31, 0.1)';
                categoryLabel = 'Wallet';
                break;
            case 'order':
                iconName = 'cart';
                iconColor = '#2196F3'; // Blue
                iconBg = 'rgba(33, 150, 243, 0.1)';
                categoryLabel = 'Orders';
                break;
            case 'delivery':
                iconName = 'bicycle';
                iconColor = '#FF9800'; // Orange
                iconBg = 'rgba(255, 152, 0, 0.1)';
                categoryLabel = 'Delivery';
                break;
            case 'chat':
                iconName = 'chatbubbles';
                iconColor = '#4CAF50'; // Green
                iconBg = 'rgba(76, 175, 80, 0.1)';
                categoryLabel = 'Chat';
                break;
            case 'system':
                iconName = 'information-circle';
                iconColor = '#9C27B0'; // Purple
                iconBg = 'rgba(156, 39, 176, 0.1)';
                categoryLabel = 'System';
                break;
            default:
                categoryLabel = type.charAt(0).toUpperCase() + type.slice(1);
                break;
        }
    } else {
        // Try to derive label from type even if color comes from metadata
        categoryLabel = type.charAt(0).toUpperCase() + type.slice(1);
    }

    const handlePress = async () => {
        // Mark as read
        if (!isRead) {
            supabase.from('notifications').update({ is_read: true }).eq('id', id).then();
        }

        // Chat notifications: go directly to the chat screen
        if (type === 'chat' && metaData?.chat_id) {
            router.push(`/order-chat/${metaData.chat_id}`);
            return;
        }

        // All other notifications: go to detail page
        router.push(`/notifications/${id}`);
    };

    const dateObj = new Date(createdAt);
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { backgroundColor: cardBg },
                !isRead && styles.unreadContainer
            ]}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
                <Ionicons name={iconName} size={24} color={iconColor} />
            </View>
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.categoryContainer}>
                        <ThemedText style={[styles.categoryLabel, { color: iconColor }]}>{categoryLabel}</ThemedText>
                        {!isRead && <View style={[styles.dot, { backgroundColor: iconColor }]} />}
                    </View>
                    <ThemedText style={[styles.date, { color: subTextColor }]}>
                        {timeStr}
                    </ThemedText>
                </View>
                <ThemedText style={[styles.title, { color: textColor }]} numberOfLines={1}>
                    {title}
                </ThemedText>
                <ThemedText style={[styles.message, { color: subTextColor }]} numberOfLines={2}>
                    {message}
                </ThemedText>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    unreadContainer: {
        borderColor: 'rgba(0,0,0,0.05)',
        backgroundColor: '#fff', // Ensure distinctive background if needed, or handle via theme
        borderLeftWidth: 4,
        borderLeftColor: '#F4821F' // Default accent, will be overridden by inline style if possible or just generic
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    categoryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    categoryLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    message: {
        fontSize: 14,
        lineHeight: 20,
    },
    date: {
        fontSize: 12,
        opacity: 0.6,
    },
});

export default NotificationItem;
