import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCart } from '@/contexts/cart';
import { useOrders } from '@/contexts/order'; // Added
import { useWallet } from '@/contexts/wallet';
import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

export default function OrdersScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { items, updateQuantity, removeFromCart, clearCart, getTotal } = useCart();

    const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
    const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const secondaryText = useThemeColor({ light: '#666', dark: '#888' }, 'text');
    const borderColor = useThemeColor({ light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.1)' }, 'background');
    const inputBg = useThemeColor({ light: '#f5f5f5', dark: '#2c2c2e' }, 'background');

    const { activeWallet, refreshWallet } = useWallet();
    const [isPaying, setIsPaying] = useState(false);

    // Calculate Totals
    const subtotal = getTotal();
    const serviceFee = subtotal * 0.10;
    const totalAmount = subtotal + serviceFee;

    const handleClearCart = () => {
        Alert.alert(
            'Clear Cart',
            'Are you sure you want to remove all items from your cart?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear All', style: 'destructive', onPress: clearCart },
            ]
        );
    };

    const handleCheckout = async () => {
        if (items.length === 0) return;

        // 1. Check if user is logged in (should be enforced by layout but check anyway)
        // 2. Determine Payment Method (For now, defaulting to Wallet as requested)

        Alert.alert(
            'Confirm Payment',
            `Pay ₦${totalAmount.toLocaleString()} from your wallet?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Pay Now', onPress: processWalletPayment }
            ]
        );
    };

    const { placeOrder } = useOrders(); // Destructure placeOrder

    const processWalletPayment = async () => {
        if (!activeWallet) {
            Alert.alert('Error', 'Wallet not active. Please sign in or check your connection.');
            return;
        }

        if (activeWallet.type !== 'personal') {
            Alert.alert('Incorrect Wallet', 'You are currently in Business View. Please switch to Personal Wallet to make purchases.');
            return;
        }

        if (activeWallet.balance < totalAmount) {
            Alert.alert(
                'Insufficient Funds',
                `Your balance is ₦${activeWallet.balance.toLocaleString()}. Total required: ₦${totalAmount.toLocaleString()}.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Top Up', onPress: () => router.push('/wallet') }
                ]
            );
            return;
        }

        setIsPaying(true);
        try {
            // Group items by restaurant
            const ordersByRestaurant = items.reduce((acc, item) => {
                const rId = item.restaurant.id;
                if (!acc[rId]) {
                    acc[rId] = { restaurantId: rId, amount: 0, items: [] };
                }
                const itemTotal = item.price * item.quantity;
                acc[rId].amount += itemTotal;
                acc[rId].items.push({
                    menu_item_id: item.dishId, // Use dishId (UUID) not item.id (Composite)
                    quantity: item.quantity,
                    price: item.price,
                    options: ''
                });
                return acc;
            }, {} as Record<string, { restaurantId: string, amount: number, items: any[] }>);

            // Process each restaurant order
            for (const rId in ordersByRestaurant) {
                const order = ordersByRestaurant[rId];
                // Calculate total with service fee for THIS order
                const orderTotal = order.amount + (order.amount * 0.10);

                await placeOrder(rId, orderTotal, order.items);
            }

            Alert.alert('Success', 'Order placed successfully! Track your meal in the Orders tab.');
            clearCart();
            refreshWallet();
            router.replace('/(tabs)/Orders'); // Correct route 

        } catch (error: any) {
            Alert.alert('Payment Failed', error.message || 'An error has occurred.');
        } finally {
            setIsPaying(false);
        }
    };

    const renderCartItem = (item: typeof items[0]) => (
        <View key={item.id} style={[styles.cartItem, { backgroundColor: cardBg, borderColor }]}>
            {/* Item Image */}
            {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.itemImage} />
            ) : (
                <View style={[styles.itemImage, styles.imagePlaceholder]}>
                    <Ionicons name="restaurant" size={24} color="#888" />
                </View>
            )}

            {/* Item Details */}
            <View style={styles.itemDetails}>
                <ThemedText style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                    {item.name}
                </ThemedText>
                <ThemedText style={[styles.restaurantName, { color: secondaryText }]} numberOfLines={1}>
                    {item.restaurant.name}
                </ThemedText>
                <ThemedText style={styles.itemPrice}>
                    ₦{item.price.toLocaleString()}
                </ThemedText>
            </View>

            {/* Quantity Controls */}
            <View style={styles.quantityControls}>
                <TouchableOpacity
                    style={[styles.quantityBtn, { backgroundColor: inputBg }]}
                    onPress={() => updateQuantity(item.id, item.quantity - 1)}
                >
                    <Ionicons name="remove" size={18} color={textColor} />
                </TouchableOpacity>
                <ThemedText style={[styles.quantityText, { color: textColor }]}>
                    {item.quantity}
                </ThemedText>
                <TouchableOpacity
                    style={[styles.quantityBtn, styles.quantityBtnAdd]}
                    onPress={() => updateQuantity(item.id, item.quantity + 1)}
                >
                    <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Remove Button */}
            <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeFromCart(item.id)}
            >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
        </View>
    );

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>
                <ThemedText type="title" style={[styles.title, { color: textColor }]}>
                    Your Cart
                </ThemedText>
                {items.length > 0 && (
                    <TouchableOpacity onPress={handleClearCart}>
                        <ThemedText style={styles.clearText}>Clear</ThemedText>
                    </TouchableOpacity>
                )}
            </View>

            {items.length === 0 ? (
                /* Empty State */
                <View style={styles.emptyState}>
                    <View style={[styles.emptyIconContainer, { backgroundColor: inputBg }]}>
                        <Ionicons name="cart-outline" size={60} color={secondaryText} />
                    </View>
                    <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
                        Your cart is empty
                    </ThemedText>
                    <ThemedText style={[styles.emptyText, { color: secondaryText }]}>
                        Explore dishes near you and add something delicious!
                    </ThemedText>
                    <TouchableOpacity
                        style={styles.browseButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="restaurant" size={20} color="#fff" />
                        <ThemedText style={styles.browseButtonText}>Browse Food</ThemedText>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    {/* Cart Items */}
                    <ScrollView
                        style={styles.scrollView}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {items.map(renderCartItem)}

                        {/* Order Summary */}
                        <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor }]}>
                            <ThemedText style={[styles.summaryTitle, { color: textColor }]}>
                                Order Summary
                            </ThemedText>

                            <View style={styles.summaryRow}>
                                <ThemedText style={[styles.summaryLabel, { color: secondaryText }]}>
                                    Subtotal
                                </ThemedText>
                                <ThemedText style={[styles.summaryValue, { color: textColor }]}>
                                    ₦{subtotal.toLocaleString()}
                                </ThemedText>
                            </View>

                            <View style={styles.summaryRow}>
                                <ThemedText style={[styles.summaryLabel, { color: secondaryText }]}>
                                    Service Fee (10%)
                                </ThemedText>
                                <ThemedText style={[styles.summaryValue, { color: textColor }]}>
                                    ₦{serviceFee.toLocaleString()}
                                </ThemedText>
                            </View>

                            <View style={[styles.summaryRow, styles.totalRow]}>
                                <ThemedText style={[styles.totalLabel, { color: textColor }]}>
                                    Total
                                </ThemedText>
                                <ThemedText style={styles.totalValue}>
                                    ₦{totalAmount.toLocaleString()}
                                </ThemedText>
                            </View>
                        </View>

                        <View style={{ height: 120 }} />
                    </ScrollView>

                    {/* Checkout Button */}
                    <View style={[styles.checkoutContainer, { backgroundColor: isDark ? '#000' : '#fff' }]}>
                        <View style={styles.checkoutInfo}>
                            <ThemedText style={[styles.checkoutLabel, { color: secondaryText }]}>
                                Total to Pay
                            </ThemedText>
                            <ThemedText style={styles.checkoutTotal}>
                                ₦{totalAmount.toLocaleString()}
                            </ThemedText>
                        </View>
                        <TouchableOpacity
                            style={[styles.checkoutButton, isPaying && { opacity: 0.7 }]}
                            onPress={handleCheckout}
                            disabled={isPaying}
                        >
                            {isPaying ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <ThemedText style={styles.checkoutButtonText}>Pay with Wallet</ThemedText>
                                    <Ionicons name="wallet-outline" size={20} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </>
            )}
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
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    clearText: {
        color: '#ef4444',
        fontSize: 15,
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    cartItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
        gap: 12,
    },
    itemImage: {
        width: 70,
        height: 70,
        borderRadius: 12,
    },
    imagePlaceholder: {
        backgroundColor: '#2c2c2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemDetails: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    restaurantName: {
        fontSize: 12,
        marginBottom: 4,
    },
    itemPrice: {
        fontSize: 15,
        fontWeight: '700',
        color: '#f27c22',
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    quantityBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityBtnAdd: {
        backgroundColor: '#f27c22',
    },
    quantityText: {
        fontSize: 16,
        fontWeight: '600',
        minWidth: 20,
        textAlign: 'center',
    },
    removeBtn: {
        padding: 8,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 10,
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 30,
    },
    browseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f27c22',
        paddingVertical: 16,
        paddingHorizontal: 30,
        borderRadius: 14,
        gap: 10,
    },
    browseButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    summaryCard: {
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 10,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: 14,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.08)',
        paddingTop: 12,
        marginTop: 8,
        marginBottom: 0,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#f27c22',
    },
    checkoutContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 34,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.08)',
    },
    checkoutInfo: {
        flex: 1,
    },
    checkoutLabel: {
        fontSize: 12,
        marginBottom: 2,
    },
    checkoutTotal: {
        fontSize: 22,
        fontWeight: '800',
        color: '#f27c22',
    },
    checkoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f27c22',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 14,
        gap: 8,
    },
    checkoutButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
});
