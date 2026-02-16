import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useCart } from '@/contexts/cart';
import { useOrders } from '@/contexts/order'; // Added
import { useWallet } from '@/contexts/wallet';
import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { ZoomIn, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { initializeTransaction, verifyTransaction } from '../utils/monnify';

export default function OrdersScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { items, updateQuantity, removeFromCart, clearCart, getTotal } = useCart();
    const { session } = useAuth();

    const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
    const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const secondaryText = useThemeColor({ light: '#666', dark: '#888' }, 'text');
    const borderColor = useThemeColor({ light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.1)' }, 'background');
    const inputBg = useThemeColor({ light: '#f5f5f5', dark: '#2c2c2e' }, 'background');

    const { activeWallet, refreshWallet, fundWallet } = useWallet();
    const [isPaying, setIsPaying] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'none' | 'processing' | 'success' | 'error'>('none');
    const [statusTitle, setStatusTitle] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [statusRef, setStatusRef] = useState('');
    const [isDelivery, setIsDelivery] = useState(true);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [deliveryFee, setDeliveryFee] = useState(0);

    // Initial Location Load
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const loc = await Location.getCurrentPositionAsync({});
                setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            } catch (err) {
                console.log("Location fetch failed", err);
            }
        })();
    }, []);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Calculate Delivery Fee whenever items or mode changes
    useEffect(() => {
        if (!isDelivery || !userLocation || items.length === 0) {
            setDeliveryFee(0);
            return;
        }

        // Get unique restaurants
        const restaurants = Array.from(new Set(items.map(i => i.restaurant.id)))
            .map(id => items.find(i => i.restaurant.id === id)!.restaurant);

        let totalFee = 0;
        restaurants.forEach(rest => {
            const dist = calculateDistance(userLocation.latitude, userLocation.longitude, rest.latitude, rest.longitude);
            // ₦500 base + ₦100 per KM
            const fee = 500 + (dist * 100);
            totalFee += fee;
        });

        setDeliveryFee(Math.round(totalFee));
    }, [items, isDelivery, userLocation]);

    // Calculate Totals
    const subtotal = getTotal();
    const serviceFee = subtotal * 0.10;
    const totalAmount = subtotal + serviceFee + deliveryFee;

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

        if (!session) {
            Alert.alert(
                'Login Required',
                'You need to sign in to place an order.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign In', onPress: () => router.push('/(auth)/login') }
                ]
            );
            return;
        }

        setShowPaymentModal(true);
    };

    const handleWalletPayment = () => {
        if (!activeWallet) return;

        if (activeWallet.balance < totalAmount) {
            Alert.alert(
                'Insufficient Funds',
                `Your balance is ₦${activeWallet.balance.toLocaleString()}. Total required: ₦${totalAmount.toLocaleString()}.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Top Up', onPress: () => { setShowPaymentModal(false); router.push('/wallet'); } }
                ]
            );
            return;
        }

        setShowPaymentModal(false);
        Alert.alert(
            'Confirm Payment',
            `Pay ₦${totalAmount.toLocaleString()} from your wallet?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Pay Now', onPress: processWalletPayment }
            ]
        );
    };

    const handleBankPayment = async () => {
        setShowPaymentModal(false);
        setIsPaying(true);
        try {
            const userEmail = session?.user?.email || '';
            const userName = session?.user?.user_metadata?.first_name || 'Customer';

            const monnifyData = await initializeTransaction(totalAmount, userEmail, userName);

            if (monnifyData && monnifyData.checkoutUrl) {
                const result = await WebBrowser.openAuthSessionAsync(
                    monnifyData.checkoutUrl,
                    'https://quible.app/payment-success'
                );

                if (result.type === 'dismiss' || result.type === 'success') {
                    // Start processing UI immediately
                    setPaymentStatus('processing');
                    setStatusTitle('Verifying Payment');
                    setStatusMessage('Please wait while we confirm your transaction...');

                    const isPaid = await verifyTransaction(monnifyData.paymentReference);

                    if (isPaid) {
                        try {
                            // Success! Now place the order.
                            await refreshWallet();
                            await processWalletPayment();
                            setPaymentStatus('success');
                            setStatusTitle('Success!');
                            setStatusMessage('Your order has been placed successfully.');
                        } catch (orderError: any) {
                            setPaymentStatus('error');
                            setStatusTitle('Order Placement Failed');
                            setStatusMessage('Your payment was received, but we couldn\'t place the order. Please retry from your cart.');
                            setStatusRef(monnifyData.paymentReference);
                        }
                    } else {
                        // User likely cancelled or payment failed
                        setPaymentStatus('error');
                        setStatusTitle('Payment Cancelled');
                        setStatusMessage('It looks like the transaction wasn\'t completed. If you were debited, don\'t worry—contact support.');
                        setStatusRef(monnifyData.paymentReference);
                    }
                }
            }
        } catch (error: any) {
            setPaymentStatus('error');
            setStatusTitle('Oops!');
            setStatusMessage(error.message || 'Something went wrong during payment.');
        } finally {
            setIsPaying(false);
        }
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
                // Calculate delivery fee for THIS specific restaurant if in delivery mode
                let restaurantDeliveryFee = 0;
                if (isDelivery && userLocation) {
                    const rest = items.find(i => i.restaurant.id === rId)?.restaurant;
                    if (rest) {
                        const dist = calculateDistance(userLocation.latitude, userLocation.longitude, rest.latitude, rest.longitude);
                        restaurantDeliveryFee = 500 + (dist * 100);
                    }
                }

                // Calculate total with service fee and delivery fee for THIS order
                const orderTotal = order.amount + (order.amount * 0.10) + restaurantDeliveryFee;

                const rest = items.find(i => i.restaurant.id === rId)?.restaurant;
                const locationData = {
                    pickup_lat: rest?.latitude,
                    pickup_lng: rest?.longitude,
                    dropoff_lat: userLocation?.latitude,
                    dropoff_lng: userLocation?.longitude
                };

                await placeOrder(rId, orderTotal, order.items, locationData);
            }

            setPaymentStatus('success');
            setStatusTitle('Order Placed!');
            setStatusMessage('Track your delicious meal in the Orders tab.');

            clearCart();
            refreshWallet();
            // We delay the navigation slightly so the user can see the success state
            setTimeout(() => {
                setPaymentStatus('none');
                router.replace('/(tabs)/Orders');
            }, 2500);

        } catch (error: any) {
            setPaymentStatus('error');
            setStatusTitle('Payment Failed');
            setStatusMessage(error.message || 'An error has occurred while processing your wallet payment.');
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
                    {/* Delivery Toggle Section */}
                    <View style={styles.scrollContent}>
                        <View style={[styles.deliveryToggleCard, { backgroundColor: cardBg, borderColor }]}>
                            <TouchableOpacity
                                style={[styles.toggleOption, isDelivery && styles.toggleOptionActive]}
                                onPress={() => setIsDelivery(true)}
                            >
                                <Ionicons name="bicycle" size={20} color={isDelivery ? '#fff' : secondaryText} />
                                <ThemedText style={[styles.toggleText, isDelivery && styles.toggleTextActive]}>Have it delivered to me</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleOption, !isDelivery && styles.toggleOptionActive]}
                                onPress={() => setIsDelivery(false)}
                            >
                                <Ionicons name="walk" size={20} color={!isDelivery ? '#fff' : secondaryText} />
                                <ThemedText style={[styles.toggleText, !isDelivery && styles.toggleTextActive]}>Pick it up yourself</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>

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

                            {isDelivery && (
                                <View style={styles.summaryRow}>
                                    <View style={styles.deliveryLabelContainer}>
                                        <ThemedText style={[styles.summaryLabel, { color: secondaryText }]}>
                                            Delivery Fee
                                        </ThemedText>
                                        <ThemedText style={styles.distanceSubtext}>
                                            (Based on distance)
                                        </ThemedText>
                                    </View>
                                    <ThemedText style={[styles.summaryValue, { color: '#f27c22' }]}>
                                        ₦{deliveryFee.toLocaleString()}
                                    </ThemedText>
                                </View>
                            )}

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
                                    <ThemedText style={styles.checkoutButtonText}>Pay</ThemedText>
                                    <View style={styles.payIconContainer}>
                                        <Ionicons name="card-outline" size={18} color="#fff" />
                                    </View>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </>
            )}
            {/* Payment Selection Modal */}
            <Modal
                visible={showPaymentModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowPaymentModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowPaymentModal(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={styles.modalTitle}>Choose Payment Method</ThemedText>
                            <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                                <Ionicons name="close" size={24} color={textColor} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.paymentOption, { borderColor }]}
                            onPress={handleWalletPayment}
                        >
                            <View style={[styles.optionIcon, { backgroundColor: 'rgba(242,124,34,0.1)' }]}>
                                <Ionicons name="wallet" size={24} color="#f27c22" />
                            </View>
                            <View style={styles.optionInfo}>
                                <View style={styles.optionHeaderRow}>
                                    <ThemedText style={styles.optionName}>Quible Wallet</ThemedText>
                                    <View style={styles.recommendedBadge}>
                                        <ThemedText style={styles.recommendedText}>RECOMMENDED</ThemedText>
                                    </View>
                                </View>
                                <ThemedText style={styles.optionDetail}>Balance: ₦{activeWallet?.balance?.toLocaleString() || '0.00'}</ThemedText>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={secondaryText} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.paymentOption, { borderColor }]}
                            onPress={handleBankPayment}
                        >
                            <View style={[styles.optionIcon, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                                <Ionicons name="business" size={24} color="#22c55e" />
                            </View>
                            <View style={styles.optionInfo}>
                                <ThemedText style={styles.optionName}>Bank Transfer / Card</ThemedText>
                                <ThemedText style={styles.optionDetail}>Instant payment via Monnify</ThemedText>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={secondaryText} />
                        </TouchableOpacity>

                        <ThemedText style={styles.modalMutedText}>
                            Your payment is secured and encrypted.
                        </ThemedText>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Payment Status Overlay (Premium UI) */}
            <Modal
                visible={paymentStatus !== 'none'}
                transparent={true}
                animationType="fade"
            >
                <BlurView intensity={20} style={StyleSheet.absoluteFill}>
                    <View style={styles.statusOverlay}>
                        <Animated.View
                            entering={ZoomIn}
                            style={[styles.statusCard, { backgroundColor: cardBg }]}
                        >
                            {/* Animated Emoji/Icon Section */}
                            <View style={styles.statusAnimationContainer}>
                                {paymentStatus === 'processing' && (
                                    <ActivityIndicator size="large" color="#f27c22" />
                                )}
                                {paymentStatus === 'success' && (
                                    <View style={styles.iconCircle}>
                                        <Ionicons name="checkmark-circle" size={80} color="#22c55e" />
                                    </View>
                                )}
                                {paymentStatus === 'error' && (
                                    <AnimatedEmoji emoji="😅" />
                                )}
                            </View>

                            <ThemedText style={styles.statusTitle}>{statusTitle}</ThemedText>
                            <ThemedText style={styles.statusMessage}>{statusMessage}</ThemedText>

                            {statusRef && (
                                <View style={[styles.refContainer, { backgroundColor: inputBg }]}>
                                    <ThemedText style={styles.refLabel}>REFERENCE ID</ThemedText>
                                    <ThemedText style={styles.refValue}>{statusRef}</ThemedText>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.statusButton}
                                onPress={() => {
                                    setPaymentStatus('none');
                                    setStatusRef('');
                                }}
                            >
                                <ThemedText style={styles.statusButtonText}>Got it</ThemedText>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </BlurView>
            </Modal>
        </ThemedView>
    );
}

// Simple Animated Emoji Component for Error State
function AnimatedEmoji({ emoji }: { emoji: string }) {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: withRepeat(withSequence(withTiming(1.2, { duration: 500 }), withTiming(1, { duration: 500 })), -1) },
            { rotate: withRepeat(withSequence(withTiming('10deg', { duration: 200 }), withTiming('-10deg', { duration: 200 })), -1) }
        ]
    }));

    return (
        <Animated.Text style={[styles.emojiText, animatedStyle]}>
            {emoji}
        </Animated.Text>
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
    deliveryToggleCard: {
        flexDirection: 'row',
        padding: 6,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 20,
    },
    toggleOption: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 12,
        gap: 4,
    },
    toggleOptionActive: {
        backgroundColor: '#f27c22',
    },
    toggleText: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
    toggleTextActive: {
        color: '#fff',
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
    deliveryLabelContainer: {
        flexDirection: 'column',
    },
    distanceSubtext: {
        fontSize: 10,
        opacity: 0.5,
        marginTop: 2,
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
        fontSize: 16,
        fontWeight: 'bold',
    },
    payIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
    },
    optionIcon: {
        width: 50,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    optionInfo: {
        flex: 1,
    },
    optionName: {
        fontSize: 16,
        fontWeight: '700',
    },
    optionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recommendedBadge: {
        backgroundColor: '#f27c22',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    recommendedText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '900',
    },
    optionDetail: {
        fontSize: 13,
        opacity: 0.6,
        marginTop: 2,
    },
    modalMutedText: {
        fontSize: 12,
        textAlign: 'center',
        opacity: 0.5,
        marginTop: 8,
    },
    statusOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    statusCard: {
        width: '100%',
        borderRadius: 30,
        padding: 30,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    statusAnimationContainer: {
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emojiText: {
        fontSize: 80,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(34,197,94,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    statusMessage: {
        fontSize: 15,
        textAlign: 'center',
        opacity: 0.7,
        lineHeight: 22,
        marginBottom: 24,
    },
    refContainer: {
        width: '100%',
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
        alignItems: 'center',
    },
    refLabel: {
        fontSize: 10,
        fontWeight: '900',
        opacity: 0.5,
        letterSpacing: 1,
        marginBottom: 4,
    },
    refValue: {
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: 'monospace',
    },
    statusButton: {
        backgroundColor: '#f27c22',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
    },
    statusButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
