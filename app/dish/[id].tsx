import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCart } from '@/contexts/cart';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Platform,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

interface DishDetail {
    id: string;
    name: string;
    description: string;
    price: number;
    image_url: string | null;
    is_active: boolean;
    category: string;
    restaurant: {
        id: string;
        name: string;
        logo_url: string | null;
        latitude: number;
        longitude: number;
        address: string;
        phone_number: string;
        cuisine_type: string;
    };
}

interface SimilarDish {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
}

export default function DishProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { addToCart, isInCart, updateQuantity, getItem } = useCart();

    const [dish, setDish] = useState<DishDetail | null>(null);
    const [similarDishes, setSimilarDishes] = useState<SimilarDish[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [quantity, setQuantity] = useState(1);

    const scrollY = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0)).current;

    const bg = useThemeColor({ light: '#fff', dark: '#121212' }, 'background');
    const text = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const secondaryText = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
    const cardBg = useThemeColor({ light: '#f8f9fa', dark: '#1c1c1e' }, 'background');

    useEffect(() => {
        fetchDishDetails();
        getUserLocation();
    }, [id]);

    useEffect(() => {
        if (!loading && dish) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 5,
                tension: 40,
                useNativeDriver: true,
            }).start();
        }
    }, [loading, dish]);

    const getUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const loc = await Location.getCurrentPositionAsync({});
            setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        } catch (error) {
            console.error("Location error:", error);
        }
    };

    const fetchDishDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('menu_items')
                .select(`*, restaurant:restaurants!restaurant_id(*)`)
                .eq('id', id)
                .single();

            if (error) throw error;
            setDish(data);

            // Fetch similar dishes from same restaurant (excluding current)
            if (data?.restaurant?.id) {
                const { data: similar } = await supabase
                    .from('menu_items')
                    .select('id, name, price, image_url')
                    .eq('restaurant_id', data.restaurant.id)
                    .neq('id', id)
                    .eq('is_active', true)
                    .limit(5);
                setSimilarDishes(similar || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userLocation && dish?.restaurant) {
            const dist = calculateDistance(
                userLocation.latitude, userLocation.longitude,
                dish.restaurant.latitude, dish.restaurant.longitude
            );
            setDistance(dist);
        }
    }, [userLocation, dish]);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const handleRestaurantPress = () => {
        if (dish?.restaurant?.id) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/restaurant-profile/${dish.restaurant.id}`);
        }
    };

    const handleShare = async () => {
        if (!dish) return;
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Share.share({
                message: `Check out ${dish.name} from ${dish.restaurant.name} on Quible! 🍔`,
                title: dish.name,
            });
        } catch (e) { console.log(e); }
    };

    const toggleFavorite = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsFavorite(!isFavorite);
    };

    const handleAddToCart = () => {
        if (!dish) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addToCart({
            ...dish,
            dishId: dish.id,
            quantity,
        });
    };

    const incrementQuantity = () => { Haptics.selectionAsync(); setQuantity(q => q + 1); };
    const decrementQuantity = () => { Haptics.selectionAsync(); setQuantity(q => Math.max(1, q - 1)); };

    if (loading) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <Stack.Screen options={{ headerShown: false }} />
                <LottieView
                    source={{ uri: 'https://lottie.host/32460ed7-5572-49d4-9b11-8096eee3437b/TzG7GfevAR.lottie' }}
                    style={{ width: 200, height: 200 }}
                    autoPlay
                    loop
                />
                <ThemedText style={{ marginTop: 10, opacity: 0.7 }}>Finding this dish...</ThemedText>
            </ThemedView>
        );
    }

    if (!dish) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <Stack.Screen options={{ headerShown: false }} />
                <Ionicons name="fast-food-outline" size={60} color="#ccc" />
                <ThemedText style={{ marginTop: 20 }}>Dish not found</ThemedText>
                <TouchableOpacity onPress={() => router.back()} style={styles.goBackBtn}>
                    <Text style={{ color: '#fff' }}>Go Back</Text>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    const inCart = isInCart(dish.id);
    const totalPrice = dish.price * quantity;

    // Animations
    const imageHeight = scrollY.interpolate({ inputRange: [-100, 0, 300], outputRange: [400, 300, 200], extrapolate: 'clamp' });
    const imageScale = scrollY.interpolate({ inputRange: [-100, 0], outputRange: [1.3, 1], extrapolate: 'clamp' });

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" />

            <Animated.ScrollView
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingTop: 280, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Main Content Card */}
                <Animated.View style={[styles.contentCard, { backgroundColor: bg, transform: [{ scale: scaleAnim }] }]}>
                    {/* Category Tag */}
                    <View style={styles.categoryTag}>
                        <MaterialCommunityIcons name="tag" size={14} color="#f27c22" />
                        <ThemedText style={styles.categoryText}>{dish.category}</ThemedText>
                    </View>

                    <ThemedText type="title" style={styles.dishName}>{dish.name}</ThemedText>
                    <ThemedText style={styles.priceText}>₦{dish.price.toLocaleString()}</ThemedText>

                    <View style={styles.divider} />

                    <ThemedText style={styles.sectionLabel}>Description</ThemedText>
                    <ThemedText style={[styles.description, { color: secondaryText }]}>
                        {dish.description || "This dish is a house specialty! Fresh ingredients prepared with love."}
                    </ThemedText>

                    {/* Restaurant Section */}
                    <View style={styles.divider} />
                    <ThemedText style={styles.sectionLabel}>Sold By</ThemedText>
                    <TouchableOpacity style={[styles.restaurantCard, { backgroundColor: cardBg }]} onPress={handleRestaurantPress} activeOpacity={0.8}>
                        {dish.restaurant.logo_url ? (
                            <Image source={{ uri: dish.restaurant.logo_url }} style={styles.restLogo} />
                        ) : (
                            <View style={[styles.restLogo, styles.logoPlaceholder]}>
                                <Ionicons name="business" size={24} color="#fff" />
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <ThemedText style={styles.restName}>{dish.restaurant.name}</ThemedText>
                            <View style={styles.restMetaRow}>
                                <MaterialCommunityIcons name="silverware-fork-knife" size={12} color={secondaryText} />
                                <ThemedText style={[styles.restMeta, { color: secondaryText }]}>{dish.restaurant.cuisine_type}</ThemedText>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={secondaryText} />
                    </TouchableOpacity>

                    {/* Distance Badge */}
                    {distance !== null && (
                        <View style={styles.distanceRow}>
                            <View style={styles.distanceBadge}>
                                <Ionicons name="location" size={16} color="#f27c22" />
                                <ThemedText style={styles.distanceText}>
                                    {distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)} km away`}
                                </ThemedText>
                            </View>
                        </View>
                    )}

                    {/* Map */}
                    <View style={styles.mapContainer}>
                        <MapView
                            provider={PROVIDER_GOOGLE}
                            style={StyleSheet.absoluteFill}
                            initialRegion={{
                                latitude: dish.restaurant.latitude,
                                longitude: dish.restaurant.longitude,
                                latitudeDelta: 0.008,
                                longitudeDelta: 0.008,
                            }}
                            showsUserLocation={true}
                            scrollEnabled={false}
                        >
                            <Marker coordinate={{ latitude: dish.restaurant.latitude, longitude: dish.restaurant.longitude }}>
                                <View style={styles.customMarker}>
                                    <Ionicons name="restaurant" size={16} color="#fff" />
                                </View>
                            </Marker>
                        </MapView>
                    </View>

                    {/* Similar Dishes */}
                    {similarDishes.length > 0 && (
                        <>
                            <View style={[styles.divider, { marginTop: 25 }]} />
                            <ThemedText style={styles.sectionLabel}>More from {dish.restaurant.name}</ThemedText>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -20, paddingHorizontal: 20 }}>
                                {similarDishes.map(item => (
                                    <TouchableOpacity key={item.id} style={[styles.similarCard, { backgroundColor: cardBg }]} onPress={() => router.replace(`/dish/${item.id}`)}>
                                        {item.image_url ? (
                                            <Image source={{ uri: item.image_url }} style={styles.similarImage} />
                                        ) : (
                                            <View style={[styles.similarImage, { backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' }]}>
                                                <Ionicons name="image-outline" size={20} color="#999" />
                                            </View>
                                        )}
                                        <ThemedText numberOfLines={1} style={styles.similarName}>{item.name}</ThemedText>
                                        <ThemedText style={styles.similarPrice}>₦{item.price.toLocaleString()}</ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </>
                    )}
                </Animated.View>
            </Animated.ScrollView>

            {/* Hero Image */}
            <Animated.View style={[styles.heroContainer, { height: imageHeight }]}>
                {dish.image_url ? (
                    <Animated.Image source={{ uri: dish.image_url }} style={[styles.heroImage, { transform: [{ scale: imageScale }] }]} />
                ) : (
                    <View style={[styles.heroImage, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="fast-food" size={80} color="#666" />
                    </View>
                )}
                <View style={styles.heroOverlay} />
                <View style={styles.heroActions}>
                    <TouchableOpacity style={styles.heroBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={styles.heroBtn} onPress={handleShare}>
                            <Ionicons name="share-social" size={22} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.heroBtn} onPress={toggleFavorite}>
                            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? "#ff4757" : "#fff"} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>

            {/* Bottom Action Bar */}
            <View style={[styles.bottomBar, { backgroundColor: bg }]}>
                {!inCart ? (
                    <>
                        <View style={styles.quantityControl}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={decrementQuantity}>
                                <Ionicons name="remove" size={20} color="#f27c22" />
                            </TouchableOpacity>
                            <ThemedText style={styles.qtyText}>{quantity}</ThemedText>
                            <TouchableOpacity style={styles.qtyBtn} onPress={incrementQuantity}>
                                <Ionicons name="add" size={20} color="#f27c22" />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
                            <Ionicons name="cart" size={22} color="#fff" />
                            <Text style={styles.addButtonText}>Add for ₦{totalPrice.toLocaleString()}</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <TouchableOpacity style={[styles.addButton, { backgroundColor: '#22c55e', flex: 1 }]} onPress={() => router.push('/(tabs)/Orders')}>
                        <Ionicons name="checkmark-circle" size={22} color="#fff" />
                        <Text style={styles.addButtonText}>In Cart - View Order</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    goBackBtn: { backgroundColor: '#f27c22', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 20 },
    heroContainer: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', zIndex: 10 },
    heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
    heroActions: { position: 'absolute', top: 50, left: 15, right: 15, flexDirection: 'row', justifyContent: 'space-between' },
    heroBtn: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 10 },
    contentCard: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 25, paddingBottom: 20, minHeight: height * 0.6 },
    categoryTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(242,124,34,0.1)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 10 },
    categoryText: { fontSize: 12, color: '#f27c22', fontWeight: '600' },
    dishName: { fontSize: 26, fontWeight: 'bold' },
    priceText: { fontSize: 24, fontWeight: 'bold', color: '#f27c22', marginTop: 5 },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
    sectionLabel: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, opacity: 0.6 },
    description: { fontSize: 15, lineHeight: 24 },
    restaurantCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, gap: 12 },
    restLogo: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee' },
    logoPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#ccc' },
    restName: { fontSize: 16, fontWeight: 'bold' },
    restMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    restMeta: { fontSize: 12 },
    distanceRow: { marginTop: 15 },
    distanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(242,124,34,0.1)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, alignSelf: 'flex-start' },
    distanceText: { fontSize: 14, color: '#f27c22', fontWeight: '600' },
    mapContainer: { height: 180, borderRadius: 16, overflow: 'hidden', marginTop: 20, borderWidth: 1, borderColor: '#eee' },
    customMarker: { backgroundColor: '#f27c22', padding: 10, borderRadius: 25, borderWidth: 3, borderColor: '#fff' },
    similarCard: { width: 130, borderRadius: 12, marginRight: 12, overflow: 'hidden' },
    similarImage: { width: '100%', height: 90, resizeMode: 'cover' },
    similarName: { fontSize: 13, fontWeight: '600', padding: 8, paddingBottom: 2 },
    similarPrice: { fontSize: 13, fontWeight: 'bold', color: '#f27c22', paddingHorizontal: 8, paddingBottom: 8 },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, paddingBottom: Platform.OS === 'ios' ? 30 : 20, borderTopWidth: 1, borderTopColor: '#eee', gap: 15 },
    quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 5 },
    qtyBtn: { padding: 10 },
    qtyText: { fontSize: 18, fontWeight: 'bold', minWidth: 30, textAlign: 'center' },
    addButton: { flex: 1, flexDirection: 'row', backgroundColor: '#f27c22', paddingVertical: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10 },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
