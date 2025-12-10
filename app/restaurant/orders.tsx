import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OrderStatus, useOrders } from '@/contexts/order';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import React from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';

const STATUS_ACTIONS: Record<OrderStatus, { label: string, next: OrderStatus, color: string } | null> = {
    'received': { label: 'Accept & Prepare', next: 'preparing', color: '#f59e0b' },
    'preparing': { label: 'Mark Ready', next: 'ready', color: '#22c55e' },
    'ready': { label: 'Hand to Rider', next: 'with_rider', color: '#3b82f6' },
    'with_rider': { label: 'Product Delivered', next: 'delivered', color: '#6366f1' },
    'delivered': null,
    'cancelled': null
};

export default function OrdersScreen() {
    const navigation = useNavigation();
    const { restaurantOrders, refreshOrders, updateOrderStatus, cancelOrder, loading } = useOrders();

    const handleAction = async (orderId: string, nextStatus: OrderStatus) => {
        await updateOrderStatus(orderId, nextStatus);
    };

    const handleCancel = (orderId: string) => {
        Alert.alert(
            "Cancel Order?",
            "This will refund the customer fully. This action cannot be undone.",
            [
                { text: "No, Keep Order", style: 'cancel' },
                {
                    text: "Yes, Cancel & Refund",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await cancelOrder(orderId);
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        }
                    }
                }
            ]
        );
    };

    const renderOrderItem = ({ item: order }: { item: any }) => {
        const action = STATUS_ACTIONS[order.status as OrderStatus];

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <ThemedText style={styles.orderId}>#{order.id.slice(0, 8)}</ThemedText>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                        <ThemedText style={{ color: getStatusColor(order.status), fontWeight: 'bold', fontSize: 12 }}>
                            {order.status.toUpperCase().replace('_', ' ')}
                        </ThemedText>
                    </View>
                </View>

                <View style={styles.itemsList}>
                    {order.items?.map((item: any, idx: number) => (
                        <View key={idx} style={styles.itemRow}>
                            <View style={styles.quantityBadge}>
                                <ThemedText style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{item.quantity}x</ThemedText>
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <ThemedText style={{ fontWeight: '600' }}>{item.menu_item?.name}</ThemedText>
                                {item.options ? <ThemedText style={{ fontSize: 12, color: '#666' }}>{item.options}</ThemedText> : null}
                            </View>
                            <ThemedText>₦{(item.price_at_time * item.quantity).toLocaleString()}</ThemedText>
                        </View>
                    ))}
                </View>

                <View style={styles.footer}>
                    <ThemedText style={{ fontSize: 16, fontWeight: 'bold' }}>Total: ₦{order.total_amount.toLocaleString()}</ThemedText>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        {(order.status === 'received' || order.status === 'preparing') && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: '#ef4444', paddingHorizontal: 12 }]}
                                onPress={() => handleCancel(order.id)}
                            >
                                <Ionicons name="close-circle" size={20} color="#fff" />
                            </TouchableOpacity>
                        )}

                        {action && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: action.color }]}
                                onPress={() => handleAction(order.id, action.next)}
                            >
                                <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>{action.label}</ThemedText>
                                <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 5 }} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'received': return '#ef4444'; // Red for urgency
            case 'preparing': return '#f59e0b'; // Orange
            case 'ready': return '#22c55e'; // Green
            case 'with_rider': return '#3b82f6'; // Blue
            default: return '#888';
        }
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
                    <Ionicons name="menu" size={30} color="#1f2050" />
                </TouchableOpacity>
                <ThemedText type="title" style={styles.title}>Incoming Orders</ThemedText>
                <View style={{ width: 30 }} />
            </View>

            <FlatList
                data={restaurantOrders}
                renderItem={renderOrderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 20 }}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshOrders} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
                        <ThemedText style={{ marginTop: 10, color: '#888' }}>No active orders.</ThemedText>
                    </View>
                }
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20 },
    title: { fontSize: 20, fontWeight: 'bold' },

    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    orderId: { fontWeight: 'bold', color: '#888' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

    itemsList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f0f0f0', paddingVertical: 10, marginBottom: 10 },
    itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    quantityBadge: { backgroundColor: '#1f2050', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    actionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25 },

    emptyState: { alignItems: 'center', marginTop: 100 }
});
