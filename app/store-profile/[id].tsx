import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useCart } from '@/contexts/cart';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Platform,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 220;

interface Store {
    id: string;
    name: string;
    address: string;
    phone: string;
    category: string;
    description: string | null;
    logo_url: string | null;
    image_url: string | null;
    latitude: number;
    longitude: number;
    created_at: string;
}

interface StoreItem {
    id: string;
    name: string;
    description: string;
    price: number;
    image_url: string | null;
    category: string;
    is_active: boolean;
}

export default function StoreProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { addToCart, isInCart } = useCart();
    const [store, setStore] = useState<Store | null>(null);
    const [items, setItems] = useState<StoreItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFavorite, setIsFavorite] = useState(false);
    const scrollY = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const bg = useThemeColor({ light: '#fff', dark: '#121212' }, 'background');
    const text = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const secondaryText = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
    const cardBg = useThemeColor({ light: '#f8f9fa', dark: '#1c1c1e' }, 'background');
    const accentColor = '#f27c22';

    useEffect(() => {
        fetchData();
        startPulseAnimation();
        if (user) {
            checkIfFavorite();
        }
    }, [id, user]);

    const startPulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: storeData, error: storeError } = await supabase
                .from('stores')
                .select('*')
                .eq('id', id)
                .single();

            if (storeError) throw storeError;
            setStore(storeData);

            const { data: itemsData, error: itemsError } = await supabase
                .from('store_items')
                .select('*')
                .eq('store_id', id)
                .eq('is_active', true)
                .order('category', { ascending: true });

            if (itemsError) throw itemsError;
            setItems(itemsData || []);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!store) return;
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Share.share({
                message: `Check out ${store.name} on Quible! 🛍️`,
                title: store.name,
            });
        } catch (e) { console.log(e); }
    };

    const checkIfFavorite = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('reference_id', id)
            .eq('type', 'store')
            .single();

        if (data) setIsFavorite(true);
    };

    const toggleFavorite = async () => {
        if (!user) {
            router.push('/login');
            return;
        }

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const newFavoriteStatus = !isFavorite;
        setIsFavorite(newFavoriteStatus);

        if (newFavoriteStatus) {
            await supabase.from('favorites').insert({
                user_id: user.id,
                reference_id: id,
                type: 'store',
                metadata: {
                    name: store?.name,
                    category: store?.category,
                    image_url: store?.logo_url
                }
            });
        } else {
            await supabase.from('favorites')
                .delete()
                .eq('user_id', user.id)
                .eq('reference_id', id)
                .eq('type', 'store');
        }
    };

    const callStore = () => {
        if (store?.phone) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Linking.openURL(`tel:${store.phone}`);
        }
    };

    const openMaps = () => {
        if (store?.latitude && store?.longitude) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
            const latLng = `${store.latitude},${store.longitude}`;
            const label = store.name;
            const url = Platform.select({
                ios: `${scheme}${label}@${latLng}`,
                android: `${scheme}${latLng}(${label})`
            });
            if (url) Linking.openURL(url);
        }
    };

    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, StoreItem[]>);
    const categories = Object.keys(groupedItems);

    const totalItems = items.length;
    const avgPrice = totalItems > 0 ? Math.round(items.reduce((a, b) => a + b.price, 0) / totalItems) : 0;
    const memberSince = store ? new Date(store.created_at).getFullYear() : '';

    if (loading) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <Stack.Screen options={{ headerShown: false }} />
                <LottieView
                    source={{ uri: 'https://lottie.host/cb2b36c4-f2d3-4d46-95cb-2840f8056cd3/xW3cOWzsY2.lottie' }}
                    style={{ width: 200, height: 200 }}
                    autoPlay
                    loop
                />
                <ThemedText style={{ marginTop: 10, opacity: 0.7 }}>Finding store...</ThemedText>
            </ThemedView>
        );
    }

    if (!store) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <Stack.Screen options={{ headerShown: false }} />
                <Ionicons name="basket-outline" size={60} color="#ccc" />
                <ThemedText style={{ marginTop: 20 }}>Store not found</ThemedText>
                <TouchableOpacity onPress={() => router.back()} style={styles.goBackBtn}>
                    <Text style={{ color: '#fff' }}>Go Back</Text>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    const headerHeight = scrollY.interpolate({
        inputRange: [0, HEADER_HEIGHT],
        outputRange: [HEADER_HEIGHT, 90],
        extrapolate: 'clamp',
    });
    const imageScale = scrollY.interpolate({
        inputRange: [-100, 0],
        outputRange: [1.5, 1],
        extrapolate: 'clamp',
    });
    const titleOpacity = scrollY.interpolate({
        inputRange: [HEADER_HEIGHT - 100, HEADER_HEIGHT - 50],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" />

            <Animated.ScrollView
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                scrollEventThrottle={16}
                style={styles.scrollContainer}
                contentContainerStyle={{ paddingTop: HEADER_HEIGHT - 30, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.mainCard, { backgroundColor: bg }]}>
                    <View style={styles.logoWrapper}>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            {store.logo_url ? (
                                <Image source={{ uri: store.logo_url }} style={styles.logo} />
                            ) : (
                                <View style={[styles.logo, styles.logoPlaceholder]}>
                                    <Ionicons name="basket" size={40} color="#fff" />
                                </View>
                            )}
                        </Animated.View>
                        <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                        </View>
                    </View>

                    <ThemedText type="title" style={styles.restName}>{store.name}</ThemedText>
                    <View style={styles.cuisineRow}>
                        <MaterialCommunityIcons name="tag" size={14} color={accentColor} />
                        <ThemedText style={styles.cuisineText}>{store.category}</ThemedText>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <ThemedText style={styles.statValue}>{totalItems}</ThemedText>
                            <ThemedText style={[styles.statLabel, { color: secondaryText }]}>Items</ThemedText>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <ThemedText style={styles.statValue}>₦{avgPrice.toLocaleString()}</ThemedText>
                            <ThemedText style={[styles.statLabel, { color: secondaryText }]}>Avg Price</ThemedText>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <ThemedText style={styles.statValue}>{memberSince}</ThemedText>
                            <ThemedText style={[styles.statLabel, { color: secondaryText }]}>Est.</ThemedText>
                        </View>
                    </View>

                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionBtn} onPress={callStore}>
                            <Ionicons name="call" size={22} color={accentColor} />
                            <ThemedText style={styles.actionLabel}>Call</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={openMaps}>
                            <Ionicons name="navigate" size={22} color={accentColor} />
                            <ThemedText style={styles.actionLabel}>Directions</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                            <Ionicons name="share-social" size={22} color={accentColor} />
                            <ThemedText style={styles.actionLabel}>Share</ThemedText>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>About</ThemedText>
                        <ThemedText style={[styles.descText, { color: secondaryText }]}>
                            {store.description || "This store hasn't added a description yet."}
                        </ThemedText>
                    </View>

                    <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>Location</ThemedText>
                        <View style={styles.addressRow}>
                            <Ionicons name="location" size={18} color={accentColor} />
                            <ThemedText style={[styles.addressText, { color: secondaryText }]}>{store.address}</ThemedText>
                        </View>
                        {store.latitude && store.longitude && (
                            <TouchableOpacity onPress={openMaps}>
                                <View style={styles.mapPreview}>
                                    <MapView
                                        provider={PROVIDER_GOOGLE}
                                        style={StyleSheet.absoluteFill}
                                        initialRegion={{
                                            latitude: store.latitude,
                                            longitude: store.longitude,
                                            latitudeDelta: 0.005,
                                            longitudeDelta: 0.005,
                                        }}
                                        scrollEnabled={false}
                                        zoomEnabled={false}
                                    >
                                        <Marker coordinate={{ latitude: store.latitude, longitude: store.longitude }}>
                                            <View style={styles.customMarker}>
                                                <Ionicons name="basket" size={16} color="#fff" />
                                            </View>
                                        </Marker>
                                    </MapView>
                                    <View style={styles.mapOverlay}>
                                        <ThemedText style={styles.mapOverlayText}>Tap to open in Maps</ThemedText>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.menuSection}>
                    <View style={styles.menuHeader}>
                        <ThemedText style={styles.menuTitle}>🛒 Store Items</ThemedText>
                        <ThemedText style={[styles.menuCount, { color: secondaryText }]}>{totalItems} items</ThemedText>
                    </View>

                    {categories.map(category => (
                        <View key={category} style={styles.categoryBlock}>
                            <View style={styles.categoryHeader}>
                                <View style={styles.categoryDot} />
                                <ThemedText style={styles.categoryTitle}>{category}</ThemedText>
                            </View>
                            {groupedItems[category].map(item => {
                                const inCart = isInCart(item.id);
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.menuCard, { backgroundColor: cardBg }]}
                                        onPress={() => router.push(`/store-item/${item.id}`)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.menuCardContent}>
                                            <ThemedText style={styles.dishName}>{item.name}</ThemedText>
                                            <ThemedText numberOfLines={2} style={[styles.dishDesc, { color: secondaryText }]}>
                                                {item.description}
                                            </ThemedText>
                                            <ThemedText style={styles.dishPrice}>₦{item.price.toLocaleString()}</ThemedText>
                                        </View>
                                        <View style={styles.menuCardImageWrapper}>
                                            {item.image_url ? (
                                                <Image source={{ uri: item.image_url }} style={styles.dishImage} />
                                            ) : (
                                                <View style={[styles.dishImage, { backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' }]}>
                                                    <Ionicons name="image-outline" size={24} color="#999" />
                                                </View>
                                            )}
                                            <TouchableOpacity
                                                style={[styles.addBtn, inCart && { backgroundColor: '#22c55e' }]}
                                                onPress={() => {
                                                    if (!inCart) {
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                        addToCart({
                                                            ...item,
                                                            itemId: item.id,
                                                            type: 'store',
                                                            quantity: 1,
                                                            store: {
                                                                id: store.id,
                                                                name: store.name,
                                                                logo_url: store.logo_url,
                                                                latitude: store.latitude,
                                                                longitude: store.longitude
                                                            }
                                                        });
                                                    }
                                                }}
                                            >
                                                <Ionicons name={inCart ? "checkmark" : "add"} size={18} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}

                    {items.length === 0 && (
                        <View style={styles.emptyMenu}>
                            <Ionicons name="basket-outline" size={50} color="#ccc" />
                            <ThemedText style={{ marginTop: 10, color: secondaryText }}>No items found in this store</ThemedText>
                        </View>
                    )}
                </View>
            </Animated.ScrollView>

            {/* Background Photo */}
            <Animated.View style={[styles.photoContainer, { height: headerHeight }]}>
                {store.image_url ? (
                    <Animated.Image
                        source={{ uri: store.image_url }}
                        style={[styles.headerImage, { transform: [{ scale: imageScale }] }]}
                    />
                ) : (
                    <View style={[styles.headerImage, { backgroundColor: '#333' }]} />
                )}
                <View style={styles.headerOverlay} />
            </Animated.View>

            {/* Header Actions (Floating) */}
            <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Animated.Text style={[styles.headerTitle, { opacity: titleOpacity }]} numberOfLines={1}>
                    {store.name}
                </Animated.Text>
                <TouchableOpacity style={styles.headerBtn} onPress={toggleFavorite}>
                    <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? "#ff4757" : "#fff"} />
                </TouchableOpacity>
            </View>

        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContainer: { flex: 1, zIndex: 5 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    goBackBtn: { backgroundColor: '#f27c22', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 20 },
    photoContainer: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', zIndex: 1 },
    headerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    headerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    headerActions: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, zIndex: 20 },
    headerBtn: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 10 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center', marginHorizontal: 10 },
    mainCard: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingBottom: 25, marginTop: -20 },
    logoWrapper: { alignSelf: 'center', marginTop: -50, position: 'relative' },
    logo: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff', backgroundColor: '#fff' },
    logoPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#ccc' },
    verifiedBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, padding: 2 },
    restName: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginTop: 12 },
    cuisineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4 },
    cuisineText: { fontSize: 14, color: '#666' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, paddingVertical: 15, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 16 },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#f27c22' },
    statLabel: { fontSize: 12, marginTop: 2 },
    statDivider: { width: 1, backgroundColor: '#ddd' },
    actionRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
    actionBtn: { alignItems: 'center', gap: 5 },
    actionLabel: { fontSize: 12, fontWeight: '600' },
    section: { marginTop: 25 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    descText: { fontSize: 14, lineHeight: 22 },
    addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    addressText: { fontSize: 14, flex: 1, lineHeight: 20 },
    mapPreview: { height: 150, borderRadius: 16, overflow: 'hidden', marginTop: 15, borderWidth: 1, borderColor: '#eee' },
    mapOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8 },
    mapOverlayText: { color: '#fff', textAlign: 'center', fontSize: 12 },
    customMarker: { backgroundColor: '#f27c22', padding: 8, borderRadius: 20, borderWidth: 3, borderColor: '#fff' },
    menuSection: { paddingHorizontal: 20, paddingTop: 10 },
    menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    menuTitle: { fontSize: 20, fontWeight: 'bold' },
    menuCount: { fontSize: 14 },
    categoryBlock: { marginBottom: 25 },
    categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    categoryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f27c22', marginRight: 8 },
    categoryTitle: { fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
    menuCard: { flexDirection: 'row', padding: 12, borderRadius: 16, marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    menuCardContent: { flex: 1, marginRight: 12 },
    dishName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    dishDesc: { fontSize: 12, lineHeight: 16, marginBottom: 8 },
    dishPrice: { fontSize: 16, fontWeight: 'bold', color: '#f27c22' },
    menuCardImageWrapper: { position: 'relative' },
    dishImage: { width: 90, height: 90, borderRadius: 12 },
    addBtn: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#f27c22', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    emptyMenu: { alignItems: 'center', paddingVertical: 40 },
});
