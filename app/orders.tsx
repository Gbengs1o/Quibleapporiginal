import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useCart } from '@/contexts/cart';
import { CartCheckoutOrderInput, useOrders } from '@/contexts/order';
import { useWallet } from '@/contexts/wallet';
import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
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

type GroupedVendorOrder = {
    vendor_type: 'restaurant' | 'store';
    vendor_id: string;
    vendor_name: string;
    pickup_lat: number | null;
    pickup_lng: number | null;
    dropoff_lat: number | null;
    dropoff_lng: number | null;
    delivery_fee: number;
    item_subtotal: number;
    service_fee: number;
    total_amount: number;
    items: Array<{
        menu_item_id?: string;
        store_item_id?: string;
        quantity: number;
        price: number;
        options?: string;
    }>;
};

export default function OrdersScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { items, updateQuantity, removeFromCart, clearCart } = useCart();
    const { session } = useAuth();

    const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
    const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const secondaryText = useThemeColor({ light: '#666', dark: '#888' }, 'text');
    const borderColor = useThemeColor({ light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.1)' }, 'background');
    const inputBg = useThemeColor({ light: '#f5f5f5', dark: '#2c2c2e' }, 'background');

    const { activeWallet, refreshWallet } = useWallet();
    const [isPaying, setIsPaying] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'none' | 'processing' | 'success' | 'error'>('none');
    const [statusTitle, setStatusTitle] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [statusRef, setStatusRef] = useState('');
    const [showClosedModal, setShowClosedModal] = useState(false);
    const [closedRestaurantName, setClosedRestaurantName] = useState('');
    const [closedVendorType, setClosedVendorType] = useState<'restaurant' | 'store'>('restaurant');
    const [isDelivery, setIsDelivery] = useState(true);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [feeConfig, setFeeConfig] = useState({ food_base_fee: 500, food_per_km_rate: 100 });
    const [feeConfigLoaded, setFeeConfigLoaded] = useState(false);

    // Fetch delivery fee config + location on mount
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
        // Fetch admin-configurable delivery fees
        (async () => {
            try {
                const { data } = await supabase.from('delivery_config').select('food_base_fee, food_per_km_rate').single();
                if (data) setFeeConfig(data);
            } catch (err) {
                console.log('Fee config fetch failed, using defaults', err);
            } finally {
                setFeeConfigLoaded(true);
            }
        })();
    }, []);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) return 0;
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const buildGroupedOrders = (): { groups: GroupedVendorOrder[]; invalidItemIds: string[] } => {
        const groupsByVendor = new Map<string, Omit<GroupedVendorOrder, 'service_fee' | 'total_amount'>>();
        const invalidItemIds: string[] = [];
        for (const cartItem of items) {
            const isFood = cartItem.type === 'food';
            const vendor = isFood ? cartItem.restaurant : cartItem.store;
            const hasVendorCoordinates =
                typeof vendor?.latitude === 'number' &&
                Number.isFinite(vendor.latitude) &&
                typeof vendor?.longitude === 'number' &&
                Number.isFinite(vendor.longitude);
            if (!cartItem.itemId || !vendor?.id || (isDelivery && !hasVendorCoordinates)) {
                invalidItemIds.push(cartItem.id);
                continue;
            }
            const vendorType = isFood ? 'restaurant' : 'store';
            const key = `${vendorType}:${vendor.id}`;
            if (!groupsByVendor.has(key)) {
                let vendorDeliveryFee = 0;
                if (isDelivery && userLocation && hasVendorCoordinates) {
                    const dist = calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        vendor.latitude,
                        vendor.longitude
                    );
                    vendorDeliveryFee = Math.round(feeConfig.food_base_fee + (dist * feeConfig.food_per_km_rate));
                }
                groupsByVendor.set(key, {
                    vendor_type: vendorType,
                    vendor_id: vendor.id,
                    vendor_name: vendor.name,
                    pickup_lat: hasVendorCoordinates ? vendor.latitude : null,
                    pickup_lng: hasVendorCoordinates ? vendor.longitude : null,
                    dropoff_lat: isDelivery ? userLocation?.latitude ?? null : null,
                    dropoff_lng: isDelivery ? userLocation?.longitude ?? null : null,
                    delivery_fee: vendorDeliveryFee,
                    item_subtotal: 0,
                    items: [],
                });
            }
            const group = groupsByVendor.get(key)!;
            const itemTotal = cartItem.price * cartItem.quantity;
            group.item_subtotal += itemTotal;
            if (isFood) {
                group.items.push({
                    menu_item_id: cartItem.itemId,
                    quantity: cartItem.quantity,
                    price: cartItem.price,
                    options: ''
                });
            } else {
                group.items.push({
                    store_item_id: cartItem.itemId,
                    quantity: cartItem.quantity,
                    price: cartItem.price,
                    options: ''
                });
            }
        }
        const groups: GroupedVendorOrder[] = Array.from(groupsByVendor.values()).map((group) => {
            const service_fee = group.item_subtotal * 0.10;
            return {
                ...group,
                service_fee,
                total_amount: group.item_subtotal + service_fee + group.delivery_fee
            };
        });
        return { groups, invalidItemIds: Array.from(new Set(invalidItemIds)) };
    };
    const { groups: groupedOrders, invalidItemIds } = buildGroupedOrders();
    const calculatingFee = isDelivery && items.length > 0 && !feeConfigLoaded;
    const subtotal = groupedOrders.reduce((sum, group) => sum + group.item_subtotal, 0);
    const serviceFee = groupedOrders.reduce((sum, group) => sum + group.service_fee, 0);
    const deliveryFee = isDelivery ? groupedOrders.reduce((sum, group) => sum + group.delivery_fee, 0) : 0;
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

        if (invalidItemIds.length > 0) {
            invalidItemIds.forEach(removeFromCart);
            Alert.alert(
                'Cart Updated',
                'Some unavailable or invalid items were removed from your cart. Please review and try again.'
            );
            return;
        }

        if (groupedOrders.length === 0) {
            Alert.alert('Cart Empty', 'No valid items are available for checkout.');
            return;
        }

        if (isDelivery && !userLocation) {
            Alert.alert(
                'Location Required',
                'Enable location to calculate delivery fees for each restaurant/store, or switch to pickup.'
            );
            return;
        }

        const uniqueRestaurantIds = groupedOrders
            .filter((group) => group.vendor_type === 'restaurant')
            .map((group) => group.vendor_id);
        const uniqueStoreIds = groupedOrders
            .filter((group) => group.vendor_type === 'store')
            .map((group) => group.vendor_id);

        try {
            if (uniqueRestaurantIds.length > 0) {
                const { data: restaurants } = await supabase
                    .from('restaurants')
                    .select('id, name, is_open')
                    .in('id', uniqueRestaurantIds);

                if (restaurants) {
                    const closedRestaurant = restaurants.find(r => r.is_open === false);
                    if (closedRestaurant) {
                        setClosedVendorType('restaurant');
                        setClosedRestaurantName(closedRestaurant.name);
                        setShowClosedModal(true);
                        return;
                    }
                }
            }

            if (uniqueStoreIds.length > 0) {
                const { data: stores } = await supabase
                    .from('stores')
                    .select('id, name, is_open')
                    .in('id', uniqueStoreIds);

                if (stores) {
                    const closedStore = stores.find(s => s.is_open === false);
                    if (closedStore) {
                        setClosedVendorType('store');
                        setClosedRestaurantName(closedStore.name);
                        setShowClosedModal(true);
                        return;
                    }
                }
            }
        } catch (err) {
            console.error("Error checking vendor status", err);
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

    const { placeCartOrders } = useOrders();

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

        if (invalidItemIds.length > 0) {
            invalidItemIds.forEach(removeFromCart);
            Alert.alert(
                'Cart Updated',
                'Some unavailable or invalid items were removed from your cart. Please review and try again.'
            );
            return;
        }

        if (groupedOrders.length === 0) {
            Alert.alert('Cart Empty', 'No valid items available for checkout.');
            return;
        }

        if (isDelivery && !userLocation) {
            Alert.alert(
                'Location Required',
                'Enable location to calculate delivery fees for each vendor, or switch to pickup.'
            );
            return;
        }

        setIsPaying(true);
        try {
            const payload: CartCheckoutOrderInput[] = groupedOrders.map((group) => ({
                vendor_type: group.vendor_type,
                vendor_id: group.vendor_id,
                total_amount: group.total_amount,
                delivery_fee: group.delivery_fee,
                pickup_lat: group.pickup_lat,
                pickup_lng: group.pickup_lng,
                dropoff_lat: group.dropoff_lat,
                dropoff_lng: group.dropoff_lng,
                items: group.items
            }));

            const createdOrderIds = await placeCartOrders(payload);

            setPaymentStatus('success');
            setStatusTitle('Order Placed!');
            setStatusMessage(
                `Placed ${createdOrderIds.length || groupedOrders.length} order(s) successfully. Track them in the Orders tab.`
            );

            clearCart();
            await refreshWallet();
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
                    {item.type === 'food' ? item.restaurant?.name : item.store?.name}
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
                                <View>
                                    <View style={styles.summaryRow}>
                                        <View style={styles.deliveryLabelContainer}>
                                            <ThemedText style={[styles.summaryLabel, { color: secondaryText }]}>
                                                Delivery Fee
                                            </ThemedText>
                                            <ThemedText style={styles.distanceSubtext}>
                                                (Based on distance)
                                            </ThemedText>
                                        </View>
                                        {calculatingFee ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <ActivityIndicator size="small" color="#f27c22" />
                                                <ThemedText style={[styles.summaryValue, { color: '#f27c22', fontSize: 12 }]}>
                                                    Calculating...
                                                </ThemedText>
                                            </View>
                                        ) : (
                                            <ThemedText style={[styles.summaryValue, { color: '#f27c22' }]}>
                                                ₦{deliveryFee.toLocaleString()}
                                            </ThemedText>
                                        )}
                                    </View>
                                    {/* Per-vendor breakdown when multiple vendors */}
                                    {!calculatingFee && groupedOrders.length > 1 && (
                                        <View style={{ paddingLeft: 8, marginTop: 4, gap: 2 }}>
                                            {groupedOrders.map((group) => (
                                                <View key={group.vendor_type + '-' + group.vendor_id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                                                    <ThemedText style={{ fontSize: 12, color: secondaryText }} numberOfLines={1}>
                                                        {group.vendor_type === 'restaurant' ? 'Restaurant' : 'Store'}: {group.vendor_name}
                                                    </ThemedText>
                                                    <ThemedText style={{ fontSize: 12, color: '#f27c22' }}>
                                                        {"\u20A6"}{group.delivery_fee.toLocaleString()}
                                                    </ThemedText>
                                                </View>
                                            ))}
                                        </View>
                                    )}
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
                            style={[styles.checkoutButton, (isPaying || (isDelivery && calculatingFee)) && { opacity: 0.5 }]}
                            onPress={handleCheckout}
                            disabled={isPaying || (isDelivery && calculatingFee)}
                        >
                            {isPaying ? (
                                <ActivityIndicator color="#fff" />
                            ) : (isDelivery && calculatingFee) ? (
                                <>
                                    <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                                    <ThemedText style={styles.checkoutButtonText}>Calculating Fee...</ThemedText>
                                </>
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
            {/* Closed Restaurant Warning Modal */}
            <Modal
                visible={showClosedModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowClosedModal(false)}
            >
                <BlurView intensity={20} style={StyleSheet.absoluteFill}>
                    <TouchableOpacity
                        style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}
                        activeOpacity={1}
                        onPress={() => setShowClosedModal(false)}
                    >
                        <Animated.View
                            entering={ZoomIn}
                            style={[styles.statusCard, { backgroundColor: cardBg, width: '85%' }]}
                        >
                            <View style={styles.statusAnimationContainer}>
                                <AnimatedEmoji emoji="😔" />
                            </View>

                            <ThemedText style={styles.statusTitle}>
                                {closedVendorType === 'store' ? 'Store Closed' : 'Restaurant Closed'}
                            </ThemedText>
                            <ThemedText style={styles.statusMessage}>
                                Sorry, <ThemedText style={{ fontWeight: '700' }}>{closedRestaurantName}</ThemedText> is currently closed and not accepting orders.
                            </ThemedText>

                            <ThemedText style={[styles.statusMessage, { fontSize: 13, marginTop: 4, color: secondaryText }]}>
                                Please remove their items from your cart to proceed with checkout.
                            </ThemedText>

                            <TouchableOpacity
                                style={[styles.statusButton, { marginTop: 20, backgroundColor: '#ef4444' }]}
                                onPress={() => setShowClosedModal(false)}
                            >
                                <ThemedText style={styles.statusButtonText}>Understood</ThemedText>
                            </TouchableOpacity>
                        </Animated.View>
                    </TouchableOpacity>
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

