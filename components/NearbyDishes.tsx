import { useCart } from '@/contexts/cart';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Dish, useFoodFeed } from '@/hooks/useFoodFeed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { memo, useCallback, useMemo } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import { ThemedText } from './themed-text';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;
const ITEMS_PER_ROW = 3;

interface NearbyDishesProps {
    searchQuery?: string;
    categoryFilter?: string | null;
    priceRange?: string;
    ratingFilter?: number;
    sortBy?: string;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
    contentContainerStyle?: ViewStyle;
}

// --- Dish Card ---
const DishCard = memo(({ item, onAdd, inCart, themeColors }: any) => {
    const formatDistance = (km: number) => km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;

    const isSoldOut = !item.is_active;

    const router = useRouter();

    const handlePress = () => {
        router.push(`/dish/${item.id}`);
    };

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={handlePress}
            style={[
                styles.dishCard,
                { backgroundColor: themeColors.cardBg, borderColor: themeColors.borderColor },
                isSoldOut && styles.dishCardDisabled
            ]}
        >
            {/* Image Area */}
            <View style={styles.imageContainer}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={[styles.dishImage, isSoldOut && { opacity: 0.5 }]} />
                ) : (
                    <View style={[styles.dishImage, styles.imagePlaceholder]}>
                        <Ionicons name="restaurant" size={40} color="#ccc" />
                    </View>
                )}

                <View style={styles.distanceBadge}>
                    <Ionicons name="location" size={12} color="#fff" />
                    <ThemedText style={styles.distanceText}>
                        {formatDistance(item.distance || 0)}
                    </ThemedText>
                </View>
            </View>

            {/* Content Area */}
            <View style={styles.contentContainer}>
                <View style={styles.restaurantRow}>
                    {/* LOGO ADDITION */}
                    {item.restaurant?.logo_url ? (
                        <Image source={{ uri: item.restaurant.logo_url }} style={styles.restaurantLogo} />
                    ) : (
                        <View style={styles.restaurantLogoPlaceholder}>
                            <Ionicons name="business" size={12} color="#fff" />
                        </View>
                    )}
                    <ThemedText style={[styles.restaurantName, { color: themeColors.secondaryText }]} numberOfLines={1}>
                        {item.restaurant?.name}
                    </ThemedText>
                    {item.rating > 0 && (
                        <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={10} color="#FFD700" />
                            <ThemedText style={styles.ratingText}>{item.rating} ({item.review_count})</ThemedText>
                        </View>
                    )}
                </View>

                <ThemedText style={[styles.dishName, { color: themeColors.textColor }]} numberOfLines={1}>
                    {item.name}
                </ThemedText>

                <View style={styles.bottomRow}>
                    <View>
                        <ThemedText style={styles.priceLabel}>Price</ThemedText>
                        <ThemedText style={styles.price}>₦{item.price.toLocaleString()}</ThemedText>
                    </View>

                    {/* --- ADD BUTTON LOGIC --- */}
                    <TouchableOpacity
                        style={[
                            styles.addButton,
                            inCart ? styles.addButtonInCart : (isSoldOut ? styles.addButtonDisabled : {})
                        ]}
                        // Disable if already in cart OR if sold out
                        onPress={() => !isSoldOut && !inCart && onAdd(item)}
                        activeOpacity={0.8}
                        disabled={inCart || isSoldOut}
                    >
                        <Ionicons
                            name={inCart ? "checkmark" : (isSoldOut ? "close" : "add")}
                            size={20}
                            color="#fff"
                        />
                        <ThemedText style={styles.addButtonText}>
                            {inCart ? 'Added' : (isSoldOut ? 'Sold Out' : 'Add')}
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
});

const DishShelf = memo(({ data, onAddToCart, isInCart, themeColors }: any) => {
    const renderItem = useCallback(({ item }: { item: Dish }) => (
        <DishCard
            item={item}
            onAdd={onAddToCart}
            inCart={isInCart(item.id)}
            themeColors={themeColors}
        />
    ), [onAddToCart, isInCart, themeColors]);

    return (
        <View style={styles.shelfContainer}>
            <FlatList
                data={data}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shelfContent}
                snapToInterval={CARD_WIDTH + 15}
                decelerationRate="fast"
            />
        </View>
    );
});

const NearbyDishes: React.FC<NearbyDishesProps> = ({
    searchQuery = '',
    categoryFilter = null,
    priceRange = 'all',
    ratingFilter = 0,
    sortBy = 'distance',
    ListHeaderComponent,
    contentContainerStyle
}) => {
    const { dishes, loading, refresh } = useFoodFeed();
    const { addToCart, isInCart } = useCart();

    const themeColors = {
        cardBg: useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background'),
        textColor: useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text'),
        secondaryText: useThemeColor({ light: '#666', dark: '#999' }, 'text'),
        borderColor: useThemeColor({ light: 'rgba(0,0,0,0.06)', dark: 'rgba(255,255,255,0.08)' }, 'background'),
    };

    // --- FILTER LOGIC (Updated) ---
    const displayedDishes = useMemo(() => {
        let result = [...dishes];

        // 1. Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(d => d.name.toLowerCase().includes(q) || d.restaurant.name.toLowerCase().includes(q));
        }

        // 2. Category & Active/Inactive Logic
        if (categoryFilter === 'Non-Active') {
            // ONLY show inactive items
            result = result.filter(d => !d.is_active);
        } else if (categoryFilter === 'Active') {
            // ONLY show active items
            result = result.filter(d => d.is_active);
        } else if (categoryFilter && categoryFilter !== 'All') {
            // Specific Category (e.g. African) -> Show Active + That Category
            result = result.filter(d => d.category === categoryFilter && d.is_active);
        } else {
            // Default 'All': Show ONLY Active items (cleaner UI)
            result = result.filter(d => d.is_active);
        }

        // 3. Restaurant Status (NEW: Hide if Closed)
        // Ensure "restaurant" object exists and check is_open
        // Note: Assuming is_open defaults to false if null, or handled by DB default
        result = result.filter(d => d.restaurant && d.restaurant.is_open !== false);

        // 3. Price
        if (priceRange === 'budget') result = result.filter(d => d.price <= 2000);
        else if (priceRange === 'mid') result = result.filter(d => d.price > 2000 && d.price <= 5000);
        else if (priceRange === 'premium') result = result.filter(d => d.price > 5000);

        // 4. Rating
        if (ratingFilter > 0) {
            result = result.filter(d => (d.rating || 0) >= ratingFilter);
        }

        // 5. Sorting
        result.sort((a, b) => {
            if (sortBy === 'price_low') return a.price - b.price;
            if (sortBy === 'price_high') return b.price - a.price;
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            return (a.distance || 0) - (b.distance || 0);
        });

        return result;
    }, [dishes, searchQuery, categoryFilter, priceRange, ratingFilter, sortBy]);

    const chunkedData = useMemo(() => {
        const chunks = [];
        for (let i = 0; i < displayedDishes.length; i += ITEMS_PER_ROW) {
            chunks.push({ id: `row-${i}`, data: displayedDishes.slice(i, i + ITEMS_PER_ROW) });
        }
        return chunks;
    }, [displayedDishes]);

    if (loading && dishes.length === 0) {
        return (
            <View style={styles.centerLoader}>
                {ListHeaderComponent}
                <LottieView
                    source={{ uri: 'https://lottie.host/32460ed7-5572-49d4-9b11-8096eee3437b/TzG7GfevAR.lottie' }}
                    style={{ width: 180, height: 180, marginTop: 30 }}
                    autoPlay
                    loop
                />
                <ThemedText style={{ marginTop: 10, opacity: 0.6 }}>Finding dishes near you...</ThemedText>
            </View>
        );
    }

    return (
        <FlatList
            data={chunkedData}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
                <DishShelf
                    data={item.data}
                    onAddToCart={(dish: any) => addToCart({ ...dish, dishId: dish.id })}
                    isInCart={(id: string) => isInCart(id)} // Validate this too: isInCart expects dishId?
                    themeColors={themeColors}
                />
            )}
            contentContainerStyle={[styles.listContent, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
                <View>
                    {ListHeaderComponent}
                    <View style={styles.headerRow}>
                        <ThemedText style={[styles.sectionTitle, { color: themeColors.textColor }]}>
                            {searchQuery ? 'Search Results' : (categoryFilter === 'Non-Active' ? 'Unavailable Dishes' : 'Dishes Near You')}
                        </ThemedText>
                        <ThemedText style={{ color: themeColors.secondaryText }}>{displayedDishes.length} items</ThemedText>
                    </View>
                </View>
            }
            ListFooterComponent={<View style={{ height: 100 }} />}
            refreshControl={
                <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#f27c22" />
            }
        />
    );
};

const styles = StyleSheet.create({
    centerLoader: { flex: 1 },
    listContent: { paddingBottom: 40 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, marginTop: 5 },
    sectionTitle: { fontSize: 22, fontWeight: '700' },
    shelfContainer: { marginBottom: 15 },
    shelfContent: { paddingHorizontal: 20 },
    dishCard: { width: CARD_WIDTH, marginRight: 15, borderRadius: 20, overflow: 'hidden', borderWidth: 1, backgroundColor: '#fff', elevation: 4 },
    dishCardDisabled: { opacity: 0.9, backgroundColor: '#f9f9f9', borderColor: '#eee' },
    imageContainer: { position: 'relative' },
    dishImage: { width: '100%', height: 160 },
    imagePlaceholder: { backgroundColor: '#2c2c2e', justifyContent: 'center', alignItems: 'center' },
    distanceBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, gap: 4 },
    distanceText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    contentContainer: { padding: 16 },
    restaurantRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    restaurantLogo: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#eee' },
    restaurantLogoPlaceholder: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
    restaurantName: { fontSize: 13, flex: 1 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255, 215, 0, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    ratingText: { fontSize: 10, fontWeight: '700', color: '#B8860B' },
    dishName: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    priceLabel: { fontSize: 11, color: '#888', marginBottom: 2 },
    price: { fontSize: 22, fontWeight: '800', color: '#f27c22' },

    // Button Styles
    addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f27c22', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, gap: 6 },
    addButtonInCart: { backgroundColor: '#22c55e' }, // GREEN
    addButtonDisabled: { backgroundColor: '#999' }, // GREY
    addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default NearbyDishes;