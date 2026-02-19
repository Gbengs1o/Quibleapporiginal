import FoodLoader from '@/components/FoodLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    LayoutAnimation,
    Platform,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface ReviewerProfile {
    first_name: string | null;
    last_name: string | null;
    profile_picture_url: string | null;
}

interface MenuItem {
    name: string;
    image_url: string | null;
}

interface OrderItem {
    menu_item: MenuItem | null;
    store_item: MenuItem | null;
}

interface ItemReview {
    id: string;
    rating: number;
    comment: string | null;
    order_item: OrderItem | null;
}

interface RestaurantReview {
    id: string;
    reviewer_id: string;
    restaurant_rating: number;
    restaurant_comment: string | null;
    created_at: string;
    is_viewed: boolean;
    reviewer: ReviewerProfile | null;
    item_reviews: ItemReview[];
}

/* -------------------------------------------------------------------------- */
/*                                 Components                                 */
/* -------------------------------------------------------------------------- */

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const StarRating = ({ rating, size = 14 }: { rating: number, size?: number }) => {
    return (
        <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                    key={star}
                    name={star <= rating ? "star" : "star-outline"}
                    size={size}
                    color="#FFD700"
                />
            ))}
        </View>
    );
};

const ExpandableText = ({ text, style }: { text: string, style?: any }) => {
    const [expanded, setExpanded] = useState(false);
    const [lengthMore, setLengthMore] = useState(false);
    const onTextLayout = useCallback((e: any) => {
        setLengthMore(e.nativeEvent.lines.length >= 3);
    }, []);

    const toggleExpanded = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    return (
        <View>
            <ThemedText
                style={style}
                onTextLayout={onTextLayout}
                numberOfLines={expanded ? undefined : 3}
            >
                {text}
            </ThemedText>
            {lengthMore && (
                <TouchableOpacity onPress={toggleExpanded} style={{ marginTop: 4 }}>
                    <ThemedText style={{ color: '#F27C22', fontSize: 12, fontWeight: '600' }}>
                        {expanded ? 'Read Less' : 'Read More'}
                    </ThemedText>
                </TouchableOpacity>
            )}
        </View>
    );
};

const ReviewCard = ({ review }: { review: RestaurantReview }) => {
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1C1C1E' }, 'card');
    const subTextColor = useThemeColor({ light: '#8E8E93', dark: '#98989D' }, 'text');
    const borderColor = useThemeColor({ light: 'rgba(0,0,0,0.05)', dark: 'rgba(255,255,255,0.1)' }, 'border');
    const itemBg = useThemeColor({ light: '#F9F9F9', dark: '#2C2C2E' }, 'background');

    return (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            {/* Header: User Info & Rating */}
            <View style={styles.cardHeader}>
                <Image
                    source={{
                        uri: review.reviewer?.profile_picture_url || 'https://via.placeholder.com/60'
                    }}
                    style={styles.avatar}
                />
                <View style={styles.headerInfo}>
                    <ThemedText style={styles.reviewerName}>
                        {review.reviewer ? `${review.reviewer.first_name || ''} ${review.reviewer.last_name || ''}`.trim() || 'Anonymous' : 'Anonymous'}
                    </ThemedText>
                    <ThemedText style={[styles.reviewDate, { color: subTextColor }]}>
                        {new Date(review.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </ThemedText>
                </View>
                <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={14} color="#FFF" />
                    <ThemedText style={styles.ratingText}>
                        {review.restaurant_rating.toFixed(1)}
                    </ThemedText>
                </View>
            </View>

            {/* Restaurant Comment */}
            {review.restaurant_comment && (
                <View style={styles.commentContainer}>
                    <ExpandableText text={review.restaurant_comment} style={styles.commentText} />
                </View>
            )}

            {/* Item Reviews */}
            {review.item_reviews && review.item_reviews.length > 0 && (
                <View style={[styles.itemsContainer, { backgroundColor: itemBg }]}>
                    <ThemedText style={styles.itemsHeader}>Ordered Items</ThemedText>
                    {review.item_reviews.map((itemReview) => (
                        <View key={itemReview.id} style={styles.itemRow}>
                            <Image
                                source={{ uri: itemReview.order_item?.menu_item?.image_url || itemReview.order_item?.store_item?.image_url || 'https://via.placeholder.com/40' }}
                                style={styles.itemImage}
                            />
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <ThemedText style={styles.itemName}>
                                    {itemReview.order_item?.menu_item?.name || itemReview.order_item?.store_item?.name || 'Unknown Item'}
                                </ThemedText>
                                {itemReview.comment && (
                                    <ThemedText style={[styles.itemComment, { color: subTextColor }]} numberOfLines={2}>
                                        "{itemReview.comment}"
                                    </ThemedText>
                                )}
                            </View>
                            <StarRating rating={itemReview.rating} size={12} />
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export default function ReviewsScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { openMenu } = useRestaurantMenu();
    const iconColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const insets = useSafeAreaInsets();

    const [restaurant, setRestaurant] = useState<{ id: string } | null>(null);
    const [reviews, setReviews] = useState<RestaurantReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({ average: 0, total: 0 });

    const fetchData = useCallback(async (isRefreshing = false) => {
        if (!user?.id) return;

        try {
            if (!isRefreshing) setLoading(true);

            // 1. Fetch Restaurant (if not already loaded)
            let currentRestaurantId = restaurant?.id;

            if (!currentRestaurantId) {
                const { data: restData, error: restError } = await supabase
                    .from('stores')
                    .select('id')
                    .eq('owner_id', user.id)
                    .single();

                if (restError) throw restError;
                if (!restData) {
                    console.error('No store found for user');
                    return;
                }

                setRestaurant(restData);
                currentRestaurantId = restData.id;
            }

            // 2. Fetch Reviews
            console.log('Fetching reviews for:', currentRestaurantId);
            const { data, error } = await supabase
                .from('food_order_reviews')
                .select(`
                    id,
                    reviewer_id,
                    restaurant_rating,
                    restaurant_comment,
                    created_at,
                    is_viewed,
                    reviewer:profiles(first_name, last_name, profile_picture_url),
                    item_reviews:food_item_reviews(
                        id,
                        rating,
                        comment,
                        order_item:order_items(
                            menu_item:menu_items(name, image_url),
                            store_item:store_items(name, image_url)
                        )
                    )
                `)
                .eq('store_id', currentRestaurantId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const typedData = data as unknown as RestaurantReview[];
                setReviews(typedData);

                // Calculate Stats
                const total = typedData.length;
                const sum = typedData.reduce((acc, curr) => acc + curr.restaurant_rating, 0);
                const average = total > 0 ? sum / total : 0;
                setStats({ average, total });

                // Mark as viewed
                const unviewedIds = typedData.filter((r: any) => !r.is_viewed).map(r => r.id);
                if (unviewedIds.length > 0) {
                    await supabase
                        .from('food_order_reviews')
                        .update({ is_viewed: true })
                        .in('id', unviewedIds);
                }
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id, restaurant?.id]);

    useEffect(() => {
        fetchData();
    }, [user?.id]); // Only trigger on user change (initial load)

    const onRefresh = () => {
        setRefreshing(true);
        fetchData(true);
    };

    if (loading && !refreshing) {
        return <FoodLoader message="Loading reviews..." />;
    }

    return (
        <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu} style={styles.menuButton}>
                    <Ionicons name="menu" size={24} color={iconColor} />
                </TouchableOpacity>
                <ThemedText type="title">Reviews</ThemedText>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={reviews}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListHeaderComponent={() => (
                    <LinearGradient
                        colors={['#F27C22', '#F7A756']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.statsContainer}
                    >
                        <View style={styles.statBox}>
                            <ThemedText style={styles.statNumber}>{stats.average.toFixed(1)}</ThemedText>
                            <View style={styles.ratingRow}>
                                <StarRating rating={Math.round(stats.average)} size={18} />
                            </View>
                            <ThemedText style={styles.statLabel}>Average Rating</ThemedText>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <ThemedText style={styles.statNumber}>{stats.total}</ThemedText>
                            <View style={styles.iconRow}>
                                <Ionicons name="chatbox" size={18} color="rgba(255,255,255,0.8)" />
                            </View>
                            <ThemedText style={styles.statLabel}>Total Reviews</ThemedText>
                        </View>
                    </LinearGradient>
                )}
                renderItem={({ item }) => <ReviewCard review={item} />}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="star-outline" size={60} color="#ccc" />
                        <ThemedText style={styles.emptyText}>No reviews yet</ThemedText>
                        <ThemedText style={styles.emptySubText}>
                            Reviews from your customers will appear here.
                        </ThemedText>
                    </View>
                )}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        paddingTop: 10,
    },
    menuButton: {
        padding: 8,
        marginLeft: -8,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    /* Stats Header */
    statsContainer: {
        flexDirection: 'row',
        borderRadius: 20,
        paddingVertical: 25,
        paddingHorizontal: 20,
        marginBottom: 24,
        alignItems: 'center',
        justifyContent: 'space-around',
        // Shadow
        shadowColor: '#F27C22',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    statBox: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 100,
    },
    statNumber: {
        fontSize: 36,
        fontWeight: '800',
        color: '#FFFFFF',
        lineHeight: 44, // Fixed line height to prevent clipping
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    ratingRow: {
        marginVertical: 4,
        backgroundColor: 'rgba(0,0,0,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    iconRow: {
        marginVertical: 4,
        height: 22, // Match rating row
        justifyContent: 'center',
    },
    statLabel: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 2,
        fontWeight: '600',
    },
    statDivider: {
        width: 1,
        height: 50,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    /* Card Styles */
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#eee',
        borderWidth: 2,
        borderColor: '#fff',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    reviewerName: {
        fontWeight: '700',
        fontSize: 16,
        marginBottom: 2,
    },
    reviewDate: {
        fontSize: 12,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F27C22',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        shadowColor: '#F27C22',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    ratingText: {
        color: '#FFF',
        fontWeight: '800',
        fontSize: 14,
        marginLeft: 4,
    },
    /* Comments */
    commentContainer: {
        marginBottom: 16,
    },
    commentText: {
        lineHeight: 22,
        fontSize: 15,
        opacity: 0.9,
    },
    /* Item Reviews inside Card */
    itemsContainer: {
        borderRadius: 12,
        padding: 12,
    },
    itemsHeader: {
        fontSize: 12,
        fontWeight: '700',
        opacity: 0.5,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    itemImage: {
        width: 32,
        height: 32,
        borderRadius: 6,
        marginRight: 10,
        backgroundColor: '#ddd',
    },
    itemName: {
        fontWeight: '600',
        fontSize: 13,
        marginBottom: 2,
    },
    itemComment: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    /* Empty State */
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        gap: 16,
        opacity: 0.6,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: '700',
    },
    emptySubText: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        maxWidth: '80%',
    },
});
