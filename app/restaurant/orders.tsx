import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCall } from '@/contexts/call-context';
import { OrderStatus, useOrders } from '@/contexts/order';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    Modal,
    RefreshControl,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const STATUS_ACTIONS: Record<OrderStatus, { label: string, next: OrderStatus, color: string, icon: string, isSpecial?: boolean, isVerify?: boolean } | null> = {
    'received': { label: 'Accept & Prepare', next: 'preparing', color: '#f59e0b', icon: 'flame' },
    'preparing': { label: 'Mark Ready', next: 'ready', color: '#22c55e', icon: 'checkmark-circle' },
    'ready': { label: 'Assign Rider', next: 'with_rider', color: '#3b82f6', icon: 'bicycle', isSpecial: true },
    'with_rider': { label: 'Verify Pickup', next: 'out_for_delivery', color: '#8b5cf6', icon: 'shield-checkmark', isSpecial: true, isVerify: true },
    'out_for_delivery': null,
    'delivered': null,
    'cancelled': null
};

export default function OrdersScreen() {
    const { openMenu } = useRestaurantMenu();
    const router = useRouter();
    const { startCall } = useCall();
    const { restaurantOrders, refreshOrders, updateOrderStatus, cancelOrder, loading } = useOrders();
    const theme = useThemeColor({ light: 'light', dark: 'dark' }, 'text') === 'dark' ? 'dark' : 'light';
    const isDark = theme === 'dark';
    // ... theme hooks ...
    const iconColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const cardBg = useThemeColor({ light: '#ffffff', dark: '#1E1E1E' }, 'background');
    const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#333' }, 'text');
    const subtleText = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');
    const itemRowBg = useThemeColor({ light: '#f9fafb', dark: '#2a2a2a' }, 'background');

    // Verify Modal State
    const [showVerifyModal, setShowVerifyModal] = React.useState(false);
    const [verifyCode, setVerifyCode] = React.useState('');
    const [verifyOrderId, setVerifyOrderId] = React.useState<string | null>(null);
    const [verifying, setVerifying] = React.useState(false);

    // Profile Modal State
    const [showProfileModal, setShowProfileModal] = React.useState(false);
    const [selectedRider, setSelectedRider] = React.useState<any>(null);

    const getStatusColor = (status: OrderStatus) => {
        if (!STATUS_ACTIONS[status]) return subtleText;
        return STATUS_ACTIONS[status]?.color || subtleText;
    };

    const getStatusIcon = (status: OrderStatus) => {
        if (!STATUS_ACTIONS[status]) return 'ellipse';
        return STATUS_ACTIONS[status]?.icon || 'ellipse';
    };

    // Chat Loading
    const [chatLoading, setChatLoading] = React.useState<string | null>(null);

    const handleAction = async (orderId: string, nextStatus: OrderStatus) => {
        await updateOrderStatus(orderId, nextStatus);
    };

    const handleCancel = async (orderId: string) => {
        Alert.alert(
            'Reject Order',
            'Are you sure you want to reject this order?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Reject',
                    style: 'destructive',
                    onPress: async () => {
                        await updateOrderStatus(orderId, 'cancelled');
                    }
                }
            ]
        );
    };

    const openChat = async (orderId: string) => {
        setChatLoading(orderId);
        try {
            const { data: chatId, error } = await supabase.rpc('get_or_create_rider_order_chat', {
                p_order_id: orderId,
                p_chat_type: 'rider_restaurant'
            });

            if (error) throw error;

            if (chatId) {
                router.push(`/order-chat/${chatId}?target=rider`);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Could not access chat');
        } finally {
            setChatLoading(null);
        }
    };

    const renderOrderItem = ({ item: order }: { item: any }) => {
        const action = STATUS_ACTIONS[order.status as OrderStatus];
        const statusColor = getStatusColor(order.status);
        const hasRider = (order.status === 'with_rider' || order.status === 'out_for_delivery') && order.rider;

        return (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
                {/* Status Ribbon and Header */}
                <View style={[styles.statusRibbon, { backgroundColor: statusColor }]}>
                    <Ionicons name={getStatusIcon(order.status) as any} size={14} color="#fff" />
                    <ThemedText style={styles.statusRibbonText}>
                        {order.status.toUpperCase().replace('_', ' ')}
                    </ThemedText>
                </View>

                {/* Card Header */}
                <View style={styles.cardHeader}>
                    <View>
                        <ThemedText style={[styles.orderId, { color: subtleText }]}>Order ID</ThemedText>
                        <ThemedText style={styles.orderIdValue}>#{order.id.slice(0, 8).toUpperCase()}</ThemedText>
                    </View>
                    <View style={styles.timeContainer}>
                        <Ionicons name="time-outline" size={14} color={subtleText} />
                        <ThemedText style={[styles.timeText, { color: subtleText }]}>
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                    </View>
                </View>

                {/* Items List */}
                <View style={[styles.itemsList, { borderColor }]}>
                    {order.items?.map((item: any, idx: number) => (
                        <View key={idx} style={[styles.itemRow, { backgroundColor: itemRowBg }]}>
                            <View style={[styles.quantityBadge, { backgroundColor: statusColor }]}>
                                <ThemedText style={styles.quantityText}>{item.quantity}x</ThemedText>
                            </View>
                            <View style={styles.itemInfo}>
                                <ThemedText style={styles.itemName}>{item.menu_item?.name}</ThemedText>
                                {item.options && (
                                    <ThemedText style={[styles.itemOptions, { color: subtleText }]}>
                                        {item.options}
                                    </ThemedText>
                                )}
                            </View>
                            <ThemedText style={styles.itemPrice}>
                                ₦{(item.price_at_time * item.quantity).toLocaleString()}
                            </ThemedText>
                        </View>
                    ))}
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    {/* Total Row */}
                    <View style={styles.totalRow}>
                        <ThemedText style={[styles.totalLabel, { color: subtleText }]}>Order Total</ThemedText>
                        <ThemedText style={styles.totalValue}>₦{order.total_amount.toLocaleString()}</ThemedText>
                    </View>

                    {/* Rider Info Row (New) */}
                    {hasRider && (
                        <View style={styles.riderInfoRow}>
                            <View style={styles.riderInfoLeft}>
                                {order.rider?.profile?.profile_picture_url ? (
                                    <Image source={{ uri: order.rider.profile.profile_picture_url }} style={styles.riderAvatarSmall} />
                                ) : (
                                    <View style={[styles.riderAvatarSmall, { backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Ionicons name="person" size={16} color="#9ca3af" />
                                    </View>
                                )}
                                <View>
                                    <ThemedText style={styles.riderNameSmall}>
                                        {order.rider?.profile?.first_name} {order.rider?.profile?.last_name?.charAt(0)}.
                                    </ThemedText>
                                    <ThemedText style={[styles.riderVehicleSmall, { color: subtleText }]}>
                                        {order.rider?.vehicle_type || 'Rider'} • {order.rider?.vehicle_plate || ''}
                                    </ThemedText>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => {
                                setSelectedRider(order.rider);
                                setShowProfileModal(true);
                            }}>
                                <ThemedText style={{ color: '#f27c22', fontWeight: '600', fontSize: 13 }}>View Profile</ThemedText>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Action Buttons - Full Width */}
                    <View style={styles.actionButtonsRow}>
                        {(order.status === 'received' || order.status === 'preparing') && (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => handleCancel(order.id)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="close-circle" size={18} color="#dc2626" />
                                <ThemedText style={styles.cancelButtonText}>Reject</ThemedText>
                            </TouchableOpacity>
                        )}

                        {/* Call Rider Button (Only when rider is assigned) */}
                        {((order.status === 'with_rider' || order.status === 'out_for_delivery') && order.rider_id) && (
                            <TouchableOpacity
                                style={styles.callButton}
                                onPress={() => startCall(order.rider_id!)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="call" size={20} color="#fff" />
                            </TouchableOpacity>
                        )}

                        {/* Chat Button (Only when rider is assigned) */}
                        {((order.status === 'with_rider' || order.status === 'out_for_delivery') && order.rider_id) && (
                            <TouchableOpacity
                                style={[styles.chatButton, { opacity: chatLoading === order.id ? 0.7 : 1 }]}
                                onPress={() => openChat(order.id)}
                                disabled={chatLoading === order.id}
                                activeOpacity={0.8}
                            >
                                {chatLoading === order.id ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="chatbubble" size={20} color="#fff" />
                                )}
                            </TouchableOpacity>
                        )}


                        {action && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => {
                                    if (action.isSpecial) {
                                        if (action.isVerify) {
                                            setVerifyOrderId(order.id);
                                            setVerifyCode('');
                                            setShowVerifyModal(true);
                                        } else {
                                            // Navigate to rider selection page
                                            router.push(`/restaurant/select-rider?orderId=${order.id}`);
                                        }
                                    } else {
                                        handleAction(order.id, action.next);
                                    }
                                }}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={[action.color, shadeColor(action.color, -30)]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.actionButtonGradient}
                                >
                                    <Ionicons name={action.icon as any} size={20} color="#fff" />
                                    <ThemedText style={styles.actionButtonText}>{action.label}</ThemedText>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };
    return (
        <ThemedView style={styles.container}>
            <LinearGradient
                colors={['#1e2050', '#2a2d7c']}
                style={styles.headerGradient}
            >
                <TouchableOpacity onPress={openMenu} style={styles.menuButton}>
                    <Ionicons name="menu" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <ThemedText style={styles.headerTitle}>Orders</ThemedText>
                    <ThemedText style={styles.headerSubtitle}>
                        {restaurantOrders.length} active order{restaurantOrders.length !== 1 ? 's' : ''}
                    </ThemedText>
                </View>
                <View style={styles.headerBadge}>
                    <ThemedText style={styles.headerBadgeText}>{restaurantOrders.length}</ThemedText>
                </View>
            </LinearGradient>

            <FlatList
                data={restaurantOrders}
                renderItem={renderOrderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={refreshOrders}
                        tintColor="#f27c22"
                        colors={['#f27c22']}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <LottieView
                            source={{ uri: 'https://lottie.host/32460ed7-5572-49d4-9b11-8096eee3437b/TzG7GfevAR.lottie' }}
                            style={styles.emptyAnimation}
                            autoPlay
                            loop
                        />
                        <ThemedText style={styles.emptyTitle}>No Active Orders</ThemedText>
                        <ThemedText style={[styles.emptySubtitle, { color: subtleText }]}>
                            Pull down to refresh when you're expecting orders
                        </ThemedText>
                    </View>
                }
            />

            {/* Verify Pickup Modal */}
            <Modal
                visible={showVerifyModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowVerifyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
                        <ThemedText style={styles.modalTitle}>Verify Pickup</ThemedText>
                        <ThemedText style={[styles.modalSubtitle, { color: subtleText }]}>
                            Enter the 4-digit code shown on the rider's phone to confirm handoff.
                        </ThemedText>

                        <TextInput
                            style={[
                                styles.codeInput,
                                { color: iconColor, borderColor: borderColor, backgroundColor: isDark ? '#2a2a2a' : '#f9fafb' }
                            ]}
                            value={verifyCode}
                            onChangeText={setVerifyCode}
                            placeholder="0000"
                            placeholderTextColor="#999"
                            keyboardType="number-pad"
                            maxLength={4}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setShowVerifyModal(false)}
                            >
                                <ThemedText style={{ color: subtleText, fontWeight: '600' }}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalVerifyButton, { opacity: verifyCode.length === 4 ? 1 : 0.5 }]}
                                disabled={verifyCode.length !== 4 || verifying}
                                onPress={async () => {
                                    if (!verifyOrderId) return;
                                    setVerifying(true);

                                    const { data, error } = await supabase.rpc('verify_order_pickup', {
                                        p_order_id: verifyOrderId,
                                        p_code: verifyCode
                                    });

                                    setVerifying(false);

                                    if (error) {
                                        Alert.alert('Error', error.message);
                                    } else {
                                        if (data?.success) {
                                            Alert.alert('Success', 'Pickup Verified!');
                                            setShowVerifyModal(false);
                                            // Refresh orders
                                            refreshOrders();
                                        } else {
                                            Alert.alert('Error', data?.message || 'Verification Failed');
                                        }
                                    }
                                }}
                            >
                                <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Verify</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Rider Profile Modal */}
            <Modal
                visible={showProfileModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowProfileModal(false)}
            >
                <View style={[styles.modalOverlay, { justifyContent: 'flex-end', padding: 0 }]}>
                    <View style={[styles.profileSheet, { backgroundColor: cardBg }]}>
                        <View style={styles.sheetHandle} />

                        {selectedRider && (
                            <View style={styles.profileContent}>
                                <View style={styles.profileHeader}>
                                    {selectedRider.profile?.profile_picture_url ? (
                                        <Image source={{ uri: selectedRider.profile.profile_picture_url }} style={styles.profileAvatarLarge} />
                                    ) : (
                                        <View style={[styles.profileAvatarLarge, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
                                            <Ionicons name="person" size={40} color="#9ca3af" />
                                        </View>
                                    )}
                                    <View style={{ alignItems: 'center', marginTop: 12 }}>
                                        <ThemedText style={styles.profileNameLarge}>
                                            {selectedRider.profile?.first_name} {selectedRider.profile?.last_name}
                                        </ThemedText>
                                        <ThemedText style={[styles.profileSubtitle, { color: subtleText }]}>
                                            {selectedRider.vehicle_type || 'Delivery Rider'} • {selectedRider.vehicle_plate || 'No Plate'}
                                        </ThemedText>
                                        <View style={styles.ratingBadge}>
                                            <Ionicons name="star" size={14} color="#f59e0b" />
                                            <ThemedText style={styles.ratingText}>4.8 (120+ deliveries)</ThemedText>
                                        </View>
                                    </View>
                                </View>

                                {/* Contact Actions */}
                                <View style={styles.profileActions}>
                                    <TouchableOpacity
                                        style={[styles.profileActionButton, { backgroundColor: '#22c55e' }]}
                                        onPress={() => {
                                            if (selectedRider.profile?.phone_number) {
                                                Linking.openURL(`tel:${selectedRider.profile.phone_number}`);
                                            }
                                        }}
                                    >
                                        <Ionicons name="call" size={20} color="#fff" />
                                        <ThemedText style={styles.profileActionText}>Call Rider</ThemedText>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.profileActionButton, { backgroundColor: '#f3f4f6' }]}
                                        onPress={() => setShowProfileModal(false)}
                                    >
                                        <ThemedText style={[styles.profileActionText, { color: '#374151' }]}>Close</ThemedText>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </ThemedView>
    );
}

// Helper functions
const shadeColor = (color: string, percent: number) => {
    var num = parseInt(color.replace("#", ""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        G = (num >> 8 & 0x00FF) + amt,
        B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
};

const styles = StyleSheet.create({
    // ... existing styles ...
    container: {
        flex: 1,
    },
    headerGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    // ...
    chatButton: {
        width: 50,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f27c22',
        borderRadius: 14,
        shadowColor: '#f27c22',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    riderInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    riderInfoLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    riderAvatarSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    riderNameSmall: {
        fontSize: 14,
        fontWeight: '600',
    },
    riderVehicleSmall: {
        fontSize: 12,
    },
    // Profile Sheet Styles
    profileSheet: {
        width: '100%',
        padding: 24,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#e5e7eb',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    profileContent: {
        alignItems: 'center',
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    profileAvatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    profileNameLarge: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    profileSubtitle: {
        fontSize: 14,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    ratingText: {
        fontSize: 12,
        color: '#d97706',
        fontWeight: '600',
    },
    profileActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    profileActionButton: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    profileActionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    // ... other existing styles ...
    menuButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContent: {
        flex: 1,
        marginLeft: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    headerBadge: {
        backgroundColor: '#f27c22',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerBadgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    card: {
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    statusRibbon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 6,
    },
    statusRibbonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 16,
        paddingBottom: 12,
    },
    orderId: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    orderIdValue: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 2,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timeText: {
        fontSize: 13,
    },
    itemsList: {
        borderTopWidth: 1,
        borderBottomWidth: 1,
        marginHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
    },
    quantityBadge: {
        width: 28,
        height: 28,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    itemInfo: {
        flex: 1,
        marginLeft: 12,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '600',
    },
    itemOptions: {
        fontSize: 12,
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '600',
    },
    footer: {
        padding: 16,
        paddingTop: 12,
        gap: 14,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    totalLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    totalValue: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 2,
        borderColor: '#dc2626',
        borderRadius: 14,
        backgroundColor: 'rgba(220, 38, 38, 0.05)',
    },
    callButton: {
        width: 50,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#22c55e',
        borderRadius: 14,
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    cancelButtonText: {
        color: '#dc2626',
        fontWeight: '700',
        fontSize: 14,
    },
    actionButton: {
        flex: 1,
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    actionButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 10,
    },
    actionButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 80,
        paddingHorizontal: 40,
    },
    emptyAnimation: {
        width: 180,
        height: 180,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    codeInput: {
        width: '100%',
        height: 60,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 8,
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalCancelButton: {
        flex: 1,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    modalVerifyButton: {
        flex: 1,
        height: 50,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
});
