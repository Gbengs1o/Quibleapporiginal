import RiderLoader from '@/components/RiderLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
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
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // State
    const [reviews, setReviews] = useState<any[]>([]);
    const [stats, setStats] = useState({ average: 0, count: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'received' | 'given'>('received');

    // Real-time notification state
    const [lastNotification, setLastNotification] = useState<any>(null);
    const [showNotification, setShowNotification] = useState(false);
    const slideAnim = useRef(new Animated.Value(-150)).current;

    useEffect(() => {
        if (!session?.user.id) return;

        const channel = supabase.channel('rider-reviews-notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${session.user.id}`
            }, (payload) => {
                setLastNotification(payload.new);
                triggerNotification();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user.id]);

    const triggerNotification = () => {
        setShowNotification(true);
        Animated.spring(slideAnim, {
            toValue: 60,
            useNativeDriver: true,
            tension: 40,
            friction: 7
        }).start();

        setTimeout(() => {
            Animated.timing(slideAnim, {
                toValue: -150,
                duration: 500,
                useNativeDriver: true,
            }).start(() => setShowNotification(false));
        }, 6000);
    };

    // Sophisticated Palette & Theme Colors
    const navy = '#1F2050';
    const gold = '#FFD700';
    const primary = '#F27C22';

    const bgColor = isDark ? '#0F1117' : '#F8F9FC';
    const cardBg = isDark ? '#1C1F2E' : '#FFFFFF';
    const textColor = isDark ? '#FFFFFF' : '#1F2050';
    const subtleText = isDark ? '#8A92A6' : '#6B7280';
    // const glassBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(31, 32, 80, 0.03)';
    // const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    useFocusEffect(
        useCallback(() => {
            fetchReviews();
        }, [activeTab])
    );

    const fetchReviews = async () => {
        if (!session?.user.id) return;
        try {
            let fetchedReviews: any[] = [];

            if (activeTab === 'received') {
                // 1. Fetch from 'reviews' (Delivery Requests)
                const { data: revData, error: revError } = await supabase
                    .from('reviews')
                    .select('*')
                    .eq('reviewee_id', session.user.id)
                    .eq('role', 'user');

                if (!revError && revData) {
                    fetchedReviews = [...fetchedReviews, ...revData.map(r => ({ ...r, source: 'delivery' }))];
                }

                // 2. Fetch from 'rider_reviews' (Food Orders)
                const { data: riderRevData, error: riderRevError } = await supabase
                    .from('rider_reviews')
                    .select('*, order_id')
                    .eq('rider_id', session.user.id);

                if (!riderRevError && riderRevData) {
                    // Normalize to match reviews structure for display
                    const normalizedRiderRevs = riderRevData.map(r => ({
                        ...r,
                        source: 'food',
                        reviewee_id: r.rider_id,
                        request_id: r.order_id
                    }));
                    fetchedReviews = [...fetchedReviews, ...normalizedRiderRevs];
                }
            } else {
                // Given reviews - currently only in 'reviews' table for deliveries
                const { data: revData, error: revError } = await supabase
                    .from('reviews')
                    .select('*')
                    .eq('reviewer_id', session.user.id)
                    .eq('role', 'rider');

                if (!revError && revData) {
                    fetchedReviews = revData.map(r => ({ ...r, source: 'delivery' }));
                }
            }

            // Sort by Date
            fetchedReviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            if (fetchedReviews.length > 0) {
                // Resolve profiles
                const profileIds = [...new Set(fetchedReviews.map(r => activeTab === 'received' ? r.reviewer_id : r.reviewee_id))];

                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name, profile_picture_url')
                    .in('id', profileIds);

                const profileMap: Record<string, any> = {};
                if (!profilesError && profilesData) {
                    profilesData.forEach(p => { profileMap[p.id] = p; });
                }

                const reviewsWithProfiles = fetchedReviews.map(r => ({
                    ...r,
                    displayProfile: profileMap[activeTab === 'received' ? r.reviewer_id : r.reviewee_id] || null
                }));

                setReviews(reviewsWithProfiles);

                if (activeTab === 'received') {
                    const totalRating = reviewsWithProfiles.reduce((sum, item) => sum + (item.rating || 0), 0);
                    const avg = totalRating / reviewsWithProfiles.length;
                    setStats({
                        average: parseFloat(avg.toFixed(1)) || 0,
                        count: reviewsWithProfiles.length
                    });
                }
            } else {
                setReviews([]);
                if (activeTab === 'received') {
                    setStats({ average: 0, count: 0 });
                }
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const renderReviewItem = ({ item }: { item: any }) => {
        const profile = item.displayProfile || {};
        const name = profile.first_name ? `${profile.first_name} ${profile.last_name}` : 'Anonymous User';
        const avatar = profile.profile_picture_url || `https://ui-avatars.com/api/?name=${name}&background=random`;
        const date = new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        return (
            <View style={[styles.reviewCard, { backgroundColor: cardBg }]}>
                <View style={styles.reviewHeader}>
                    <Image source={{ uri: avatar }} style={styles.avatar} />
                    <View style={styles.reviewerInfo}>
                        <ThemedText style={[styles.reviewerName, { color: textColor }]}>{name}</ThemedText>
                        <View style={styles.ratingRow}>
                            {[...Array(5)].map((_, i) => (
                                <Ionicons
                                    key={i}
                                    name={i < (item.rating || 0) ? "star" : "star-outline"}
                                    size={12}
                                    color={i < (item.rating || 0) ? gold : (isDark ? '#555' : '#ccc')}
                                />
                            ))}
                            <ThemedText style={[styles.reviewDate, { color: subtleText }]}>{date}</ThemedText>
                        </View>
                    </View>
                </View>
                <ThemedText style={[styles.commentText, { color: isDark ? '#ccc' : '#444' }]}>
                    {item.comment || 'No comment provided.'}
                </ThemedText>
            </View>
        );
    };

    if (loading) return <RiderLoader message="Loading reviews..." />;

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>

            {/* Notification Alert Banner */}
            {showNotification && (
                <Animated.View style={[styles.notificationBanner, { transform: [{ translateY: slideAnim }] }]}>
                    <View style={styles.notifIcon}>
                        <Ionicons name="notifications" size={20} color="#fff" />
                    </View>
                    <View style={styles.notifContent}>
                        <ThemedText style={styles.notifTitle}>{lastNotification?.title || 'New Update'}</ThemedText>
                        <ThemedText style={styles.notifBody} numberOfLines={2}>{lastNotification?.message || 'You have a new notification'}</ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => {
                        Animated.timing(slideAnim, { toValue: -150, duration: 300, useNativeDriver: true }).start(() => setShowNotification(false));
                    }}>
                        <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                </Animated.View>
            )}

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
                    {activeTab === 'received' ? (
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
                    ) : (
                        <View style={styles.ratingBigContainer}>
                            <ThemedText style={styles.ratingBig}>{reviews.length}</ThemedText>
                            <ThemedText style={styles.totalReviews}>Reviews Given to Customers</ThemedText>
                        </View>
                    )}

                    {/* Tab Toggle */}
                    <View style={styles.tabToggleContainer}>
                        <TouchableOpacity
                            style={[styles.tabButton, activeTab === 'received' && styles.activeTabButton]}
                            onPress={() => setActiveTab('received')}
                        >
                            <ThemedText style={[styles.tabButtonText, activeTab === 'received' && styles.activeTabButtonText]}>Received</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabButton, activeTab === 'given' && styles.activeTabButton]}
                            onPress={() => setActiveTab('given')}
                        >
                            <ThemedText style={[styles.tabButtonText, activeTab === 'given' && styles.activeTabButtonText]}>Given</ThemedText>
                        </TouchableOpacity>
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
                            <ThemedText style={styles.statValue}>
                                {activeTab === 'received' ? reviews.filter(r => r.rating === 5).length : reviews.length}
                            </ThemedText>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            {/* Reviews List */}
            <View style={styles.contentContainer}>
                <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Recent Feedback</ThemedText>

                <FlatList
                    data={reviews}
                    renderItem={renderReviewItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReviews(); }} colors={[navy]} tintColor={textColor} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbox-ellipses-outline" size={48} color={isDark ? '#555' : '#ccc'} />
                            <ThemedText style={{ color: subtleText, marginTop: 10 }}>No reviews yet.</ThemedText>
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

    // Tab Toggle
    tabToggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 4,
        marginTop: 20,
        marginBottom: 20,
        width: '80%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeTabButton: {
        backgroundColor: '#fff',
    },
    tabButtonText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        fontFamily: 'Montserrat_600SemiBold',
    },
    activeTabButtonText: {
        color: '#1F2050',
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
        marginBottom: 16,
    },
    listContent: {
        paddingBottom: 20,
    },

    // Review Card
    reviewCard: {
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
        marginBottom: 4,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    reviewDate: {
        fontSize: 12,
        marginLeft: 8,
    },
    commentText: {
        fontSize: 14,
        lineHeight: 22,
        fontFamily: 'OpenSans_400Regular',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
    },
    // Notification Banner
    notificationBanner: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        backgroundColor: '#1F2050',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 1000,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    notifIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F27C22',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    notifContent: {
        flex: 1,
    },
    notifTitle: {
        color: '#fff',
        fontFamily: 'Montserrat_700Bold',
        fontSize: 14,
    },
    notifBody: {
        color: 'rgba(255,255,255,0.8)',
        fontFamily: 'OpenSans_400Regular',
        fontSize: 12,
        marginTop: 2,
    },
});
