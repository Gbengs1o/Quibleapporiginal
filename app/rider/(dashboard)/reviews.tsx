import RiderLoader from '@/components/RiderLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

export default function RiderReviews() {
    const { session } = useAuth();
    const { openMenu } = useRiderMenu();

    // State
    const [reviews, setReviews] = useState<any[]>([]);
    const [stats, setStats] = useState({ average: 0, count: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Sophisticated Palette
    const navy = '#1F2050';
    const gold = '#FFD700';
    const bg = '#F8F9FC';
    const textColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');

    useFocusEffect(
        useCallback(() => {
            fetchReviews();
        }, [])
    );

    const fetchReviews = async () => {
        if (!session?.user.id) return;
        try {
            // 1. Fetch Reviews (Plain fetch, no join to avoid FK errors)
            const { data: reviewsData, error: reviewsError } = await supabase
                .from('reviews')
                .select('*')
                .eq('reviewee_id', session.user.id)
                .order('created_at', { ascending: false });

            if (reviewsError) throw reviewsError;

            // 2. Fetch Profiles manual lookup since automatic FK failed
            const fetchedReviews = reviewsData || [];

            if (fetchedReviews.length > 0) {
                // Get unique reviewer IDs
                const reviewerIds = [...new Set(fetchedReviews.map(r => r.reviewer_id))];

                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name, profile_picture_url')
                    .in('id', reviewerIds);

                if (!profilesError && profilesData) {
                    // Create lookup map
                    const profileMap: Record<string, any> = {};
                    profilesData.forEach(p => { profileMap[p.id] = p; });

                    // Merge
                    const reviewsWithProfiles = fetchedReviews.map(r => ({
                        ...r,
                        reviewer: profileMap[r.reviewer_id] || null
                    }));

                    setReviews(reviewsWithProfiles);

                    // Calc Stats
                    const totalRating = reviewsWithProfiles.reduce((sum, item) => sum + (item.rating || 0), 0);
                    const avg = totalRating / reviewsWithProfiles.length;
                    setStats({
                        average: parseFloat(avg.toFixed(1)),
                        count: reviewsWithProfiles.length
                    });
                } else {
                    // If profile fetch fails, show reviews anyway with anonymous/fallback
                    setReviews(fetchedReviews);
                }
            } else {
                setReviews([]);
                setStats({ average: 0, count: 0 });
            }

        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const renderReviewItem = ({ item }: { item: any }) => {
        const reviewer = item.reviewer || {};
        const name = reviewer.first_name ? `${reviewer.first_name} ${reviewer.last_name}` : 'Anonymous User';
        const avatar = reviewer.profile_picture_url || `https://ui-avatars.com/api/?name=${name}&background=random`;
        const date = new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        return (
            <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                    <Image source={{ uri: avatar }} style={styles.avatar} />
                    <View style={styles.reviewerInfo}>
                        <ThemedText style={styles.reviewerName}>{name}</ThemedText>
                        <View style={styles.ratingRow}>
                            {[...Array(5)].map((_, i) => (
                                <Ionicons
                                    key={i}
                                    name={i < (item.rating || 0) ? "star" : "star-outline"}
                                    size={12}
                                    color={i < (item.rating || 0) ? gold : '#ccc'}
                                />
                            ))}
                            <ThemedText style={styles.reviewDate}>{date}</ThemedText>
                        </View>
                    </View>
                </View>
                <ThemedText style={styles.commentText}>
                    {item.comment || 'No comment provided.'}
                </ThemedText>
            </View>
        );
    };

    if (loading) return <RiderLoader message="Loading reviews..." />;

    return (
        <ThemedView style={[styles.container, { backgroundColor: bg }]}>

            {/* Header Section */}
            <LinearGradient
                colors={[navy, '#2C2E60']}
                style={styles.headerGradient}
            >
                <View style={styles.navBar}>
                    <TouchableOpacity onPress={openMenu} style={styles.menuBtn}>
                        <Ionicons name="menu" size={28} color="#fff" />
                    </TouchableOpacity>
                    <ThemedText style={styles.headerTitle}>Reviews</ThemedText>
                    <View style={{ width: 40 }} />
                </View>

                {/* Hero Stats */}
                <View style={styles.heroStats}>
                    <View style={styles.ratingBigContainer}>
                        <ThemedText style={styles.ratingBig}>{stats.average}</ThemedText>
                        <View style={styles.starsBig}>
                            {[...Array(5)].map((_, i) => (
                                <Ionicons
                                    key={i}
                                    name={i < Math.round(stats.average) ? "star" : "star-outline"}
                                    size={20}
                                    color={gold}
                                />
                            ))}
                        </View>
                        <ThemedText style={styles.totalReviews}>Based on {stats.count} reviews</ThemedText>
                    </View>

                    {/* Horizontal Stats Placeholder - can be connected to real metrics later */}
                    <View style={styles.statPills}>
                        <View style={styles.statPill}>
                            <ThemedText style={styles.statLabel}>Success Rate</ThemedText>
                            <ThemedText style={styles.statValue}>100%</ThemedText>
                        </View>
                        <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        <View style={styles.statPill}>
                            <ThemedText style={styles.statLabel}>Compliments</ThemedText>
                            <ThemedText style={styles.statValue}>{reviews.filter(r => r.rating === 5).length}</ThemedText>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            {/* Reviews List */}
            <View style={styles.contentContainer}>
                <ThemedText style={styles.sectionTitle}>Recent Feedback</ThemedText>

                <FlatList
                    data={reviews}
                    renderItem={renderReviewItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReviews(); }} colors={[navy]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbox-ellipses-outline" size={48} color="#ccc" />
                            <ThemedText style={{ color: '#888', marginTop: 10 }}>No reviews yet.</ThemedText>
                        </View>
                    }
                />
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    headerGradient: {
        paddingTop: 50,
        paddingBottom: 30,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 10,
        shadowColor: '#1F2050',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    menuBtn: {
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Montserrat_600SemiBold',
        color: '#fff',
    },

    // Hero Stats
    heroStats: {
        alignItems: 'center',
    },
    ratingBigContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    ratingBig: {
        fontSize: 56,
        fontFamily: 'Montserrat_700Bold',
        color: '#fff',
        lineHeight: 60,
    },
    starsBig: {
        flexDirection: 'row',
        gap: 4,
        marginBottom: 8,
    },
    totalReviews: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        fontFamily: 'OpenSans_400Regular',
    },

    statPills: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 20,
        gap: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    statPill: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.6)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
    },
    statValue: {
        fontSize: 16,
        color: '#fff',
        fontFamily: 'Montserrat_600SemiBold',
    },

    // Content
    contentContainer: {
        flex: 1,
        paddingTop: 24,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Montserrat_600SemiBold',
        color: '#1F2050',
        marginBottom: 16,
    },
    listContent: {
        paddingBottom: 20,
    },

    // Review Card
    reviewCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
    },
    reviewHeader: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
        backgroundColor: '#eee',
    },
    reviewerInfo: {
        justifyContent: 'center',
        flex: 1,
    },
    reviewerName: {
        fontSize: 16,
        fontFamily: 'OpenSans_600SemiBold',
        color: '#1F2050',
        marginBottom: 4,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    reviewDate: {
        fontSize: 12,
        color: '#888',
        marginLeft: 8,
    },
    commentText: {
        fontSize: 14,
        color: '#444',
        lineHeight: 22,
        fontFamily: 'OpenSans_400Regular',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
    },
});
