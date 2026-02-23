import { useCart } from '@/contexts/cart';
import { useThemeColor } from '@/hooks/use-theme-color';
import { StoreItem, useStoreFeed } from '@/hooks/useStoreFeed';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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

interface NearbyStoresProps {
    searchQuery?: string;
    categoryFilter?: string | null;
    priceRange?: string;
    ratingFilter?: number;
    sortBy?: string;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
    contentContainerStyle?: ViewStyle;
    isShelf?: boolean;
}

const StoreItemCard = memo(({ item, themeColors, isGrid = false }: { item: StoreItem, themeColors: any, isGrid?: boolean }) => {
    const formatDistance = (km: number) => km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
    const router = useRouter();
    const { addToCart, isInCart } = useCart();

    const handlePress = () => {
        router.push(`/store-item/${item.id}`);
    };

    const handleStorePress = () => {
        if (item.store?.id) {
            router.push(`/store-profile/${item.store.id}`);
        }
    };

    const handleAddToCart = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addToCart({
            ...item,
            itemId: item.id,
            type: 'store',
            quantity: 1,
        });
    };

    const inCart = isInCart(item.id);

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={handlePress}
            style={[
                styles.card,
                isGrid && styles.cardGrid,
                { backgroundColor: themeColors.cardBg, borderColor: themeColors.borderColor }
            ]}
        >
            <View style={styles.imageContainer}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.image} />
                ) : (
                    <View style={[styles.image, styles.imagePlaceholder]}>
                        <Ionicons name="basket" size={40} color="#ccc" />
                    </View>
                )}
                <View style={styles.distanceBadge}>
                    <Ionicons name="location" size={12} color="#fff" />
                    <ThemedText style={styles.distanceText}>
                        {formatDistance(item.distance || 0)}
                    </ThemedText>
                </View>
            </View>

            <View style={styles.contentContainer}>
                <TouchableOpacity style={styles.storeRow} onPress={handleStorePress}>
                    {item.store?.logo_url ? (
                        <Image source={{ uri: item.store.logo_url }} style={styles.storeLogo} />
                    ) : (
                        <View style={styles.storeLogoPlaceholder}>
                            <Ionicons name="business" size={12} color="#fff" />
                        </View>
                    )}
                    <ThemedText style={[styles.storeName, { color: themeColors.secondaryText }]} numberOfLines={1}>
                        {item.store?.name}
                    </ThemedText>
                </TouchableOpacity>

                <ThemedText style={[styles.itemName, { color: themeColors.textColor }]} numberOfLines={1}>
                    {item.name}
                </ThemedText>

                <View style={styles.bottomRow}>
                    <View>
                        <ThemedText style={styles.priceLabel}>Price</ThemedText>
                        <ThemedText style={styles.price}>₦{item.price.toLocaleString()}</ThemedText>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.viewButton,
                            inCart && { backgroundColor: '#22c55e' }
                        ]}
                        onPress={handleAddToCart}
                    >
                        <ThemedText style={styles.viewButtonText}>
                            {inCart ? 'Added' : 'Add'}
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
});

const StoreShelf = memo(({ data, themeColors }: { data: StoreItem[], themeColors: any }) => {
    const renderItem = useCallback(({ item }: { item: StoreItem }) => (
        <StoreItemCard item={item} themeColors={themeColors} />
    ), [themeColors]);

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
                nestedScrollEnabled={true}
            />
        </View>
    );
});
const NearbyStores: React.FC<NearbyStoresProps> = ({
    searchQuery = '',
    categoryFilter,
    priceRange,
    ratingFilter,
    sortBy = 'distance',
    ListHeaderComponent,
    contentContainerStyle,
    isShelf = false
}) => {
    const { items, loading, refresh } = useStoreFeed();

    const themeColors = {
        cardBg: useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background'),
        textColor: useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text'),
        secondaryText: useThemeColor({ light: '#666', dark: '#999' }, 'text'),
        borderColor: useThemeColor({ light: 'rgba(0,0,0,0.06)', dark: 'rgba(255,255,255,0.08)' }, 'background'),
    };

    const filteredItems = useMemo(() => {
        let result = [...items];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(i =>
                i.name.toLowerCase().includes(q) ||
                i.store?.name.toLowerCase().includes(q)
            );
        }

        if (categoryFilter && categoryFilter !== 'all') {
            result = result.filter(i => i.category.toLowerCase() === categoryFilter.toLowerCase());
        }

        if (priceRange === 'budget') result = result.filter(i => i.price <= 2000);
        else if (priceRange === 'mid') result = result.filter(i => i.price > 2000 && i.price <= 5000);
        else if (priceRange === 'premium') result = result.filter(i => i.price > 5000);

        result.sort((a, b) => {
            if (sortBy === 'price_low') return a.price - b.price;
            if (sortBy === 'price_high') return b.price - a.price;
            return (a.distance || 0) - (b.distance || 0);
        });

        return result;
    }, [items, searchQuery, categoryFilter, priceRange, sortBy]);

    if (loading && items.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                {ListHeaderComponent}
                <View style={styles.centerLoader}>
                    <LottieView
                        source={{ uri: 'https://lottie.host/cb2b36c4-f2d3-4d46-95cb-2840f8056cd3/xW3cOWzsY2.lottie' }}
                        style={{ width: 150, height: 150 }}
                        autoPlay
                        loop
                    />
                    <ThemedText style={{ marginTop: 10, opacity: 0.6 }}>Looking for stores nearby...</ThemedText>
                </View>
            </View>
        );
    }

    if (isShelf) {
        return <StoreShelf data={filteredItems} themeColors={themeColors} />;
    }

    return (
        <FlatList
            data={filteredItems}
            keyExtractor={item => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            renderItem={({ item }) => (
                <StoreItemCard item={item} themeColors={themeColors} isGrid={true} />
            )}
            contentContainerStyle={[styles.listContent, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
                <View>
                    {ListHeaderComponent}
                    <View style={styles.headerRow}>
                        <ThemedText style={[styles.sectionTitle, { color: themeColors.textColor }]}>
                            {searchQuery ? 'Search Results' : 'Nearby Stores'}
                        </ThemedText>
                        <ThemedText style={{ color: themeColors.secondaryText }}>{filteredItems.length} items</ThemedText>
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
    centerLoader: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    listContent: { paddingBottom: 40 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, marginTop: 5 },
    sectionTitle: { fontSize: 22, fontWeight: '700' },
    shelfContainer: { marginBottom: 15 },
    shelfContent: { paddingHorizontal: 20, paddingBottom: 20 },
    columnWrapper: { justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15 },
    card: { width: CARD_WIDTH, marginRight: 15, borderRadius: 20, overflow: 'hidden', borderWidth: 1, backgroundColor: '#fff', elevation: 4 },
    cardGrid: { width: '47%', marginRight: 0, marginBottom: 20 },
    imageContainer: { position: 'relative' },
    image: { width: '100%', height: 160 },
    imagePlaceholder: { backgroundColor: '#2c2c2e', justifyContent: 'center', alignItems: 'center' },
    distanceBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, gap: 4 },
    distanceText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    contentContainer: { padding: 16 },
    storeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    storeLogo: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#eee' },
    storeLogoPlaceholder: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f27c22', justifyContent: 'center', alignItems: 'center' },
    storeName: { fontSize: 13, flex: 1 },
    itemName: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' },
    priceLabel: { fontSize: 11, color: '#888', marginBottom: 2 },
    price: { fontSize: 18, fontWeight: '800', color: '#f27c22' },
    viewButton: { backgroundColor: '#f27c22', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
    viewButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

export default NearbyStores;
