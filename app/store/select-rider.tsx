import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

interface RiderBid {
    id: string;
    rider_id: string;
    status: string;
    created_at: string;
    expired_at: string | null;
    rider: Rider;
}

interface Rider {
    user_id: string;
    rider_photo: string | null;
    vehicle_type: string;
    vehicle_plate: string;
    status: string;
    average_rating: number;
    total_jobs: number;
    profile: {
        first_name: string;
        last_name: string;
        phone_number: string;
    };
    id?: string;
}

export default function SelectRiderScreen() {
    const { orderId } = useLocalSearchParams<{ orderId: string }>();
    const router = useRouter();
    const { openMenu } = useRestaurantMenu();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const iconColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const cardBg = useThemeColor({ light: '#ffffff', dark: '#1E1E1E' }, 'background');
    const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#333' }, 'text');
    const subtleText = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');

    const [bids, setBids] = useState<RiderBid[]>([]);
    const [invites, setInvites] = useState<RiderBid[]>([]); // Track sent invites
    const [expiredInvites, setExpiredInvites] = useState<RiderBid[]>([]);
    const [availableRiders, setAvailableRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState<string | null>(null);
    const [countdowns, setCountdowns] = useState<Record<string, number>>({});
    const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchData = async () => {
        if (!orderId) return;
        setLoading(true);

        // 1. Fetch Bids, Invites & Expired
        const { data: bidsData, error: bidsError } = await supabase
            .from('order_rider_bids')
            .select(`
                id,
                rider_id,
                status,
                created_at,
                expired_at,
                rider:riders!order_rider_bids_rider_id_fkey (
                    user_id,
                    rider_photo,
                    vehicle_type,
                    vehicle_plate,
                    status,
                    average_rating,
                    total_jobs,
                    profile:profiles!fk_riders_profiles (
                        first_name,
                        last_name,
                        phone_number
                    )
                )
            `)
            .eq('order_id', orderId)
            .in('status', ['pending', 'invited', 'expired'])
            .order('created_at', { ascending: true });

        if (bidsError) {
            console.error('Error fetching bids:', bidsError);
        }

        const allBids = (bidsData as any) || [];
        // Separate pending bids from invites and expired
        setBids(allBids.filter((b: any) => b.status === 'pending'));
        setInvites(allBids.filter((b: any) => b.status === 'invited'));
        setExpiredInvites(allBids.filter((b: any) => b.status === 'expired'));

        // Initialize countdowns for active invites
        const newCountdowns: Record<string, number> = {};
        allBids.filter((b: any) => b.status === 'invited' && b.expired_at).forEach((b: any) => {
            const remaining = Math.max(0, Math.floor((new Date(b.expired_at).getTime() - Date.now()) / 1000));
            newCountdowns[b.id] = remaining;
        });
        setCountdowns(newCountdowns);

        // 2. Fetch Available active riders
        const { data: ridersData, error: ridersError } = await supabase
            .from('riders')
            .select(`
                id,
                user_id,
                rider_photo,
                vehicle_type,
                vehicle_plate,
                status,
                average_rating,
                total_jobs,
                profile:profiles!fk_riders_profiles (
                   first_name,
                   last_name,
                   phone_number
                )
            `)
            .eq('status', 'active')
            .eq('is_online', true);

        if (ridersError) {
            console.error('Error fetching riders:', ridersError);
        }

        // Filter out riders who have pending bids OR active invites
        const excludedRiderUserIds = new Set(allBids.map((b: any) => b.rider_id));
        const available = (ridersData as any || []).filter((r: any) => !excludedRiderUserIds.has(r.user_id));

        setAvailableRiders(available);
        setLoading(false);
    };

    // Handle invite expiry
    const handleExpiry = useCallback(async () => {
        // Expire stale invites on backend
        await supabase.rpc('expire_stale_invites', { p_order_id: orderId });
        fetchData();

        // Prompt restaurant to broadcast
        Alert.alert(
            '⏰ Rider Didn\'t Respond',
            'The invited rider(s) didn\'t respond in time. Want to broadcast to other nearby riders?',
            [
                { text: 'Not Now', style: 'cancel' },
                {
                    text: 'Broadcast Now',
                    style: 'default',
                    onPress: async () => {
                        setLoading(true);
                        const { data, error } = await supabase.rpc('expire_and_broadcast', {
                            p_order_id: orderId,
                            p_amount: 500
                        });
                        if (error) {
                            Alert.alert('Error', error.message);
                        } else {
                            Alert.alert('✅ Broadcast Sent', data?.message || 'Notified nearby riders!');
                            fetchData();
                        }
                        setLoading(false);
                    }
                }
            ]
        );
    }, [orderId]);

    // Countdown timer tick
    useEffect(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }

        countdownIntervalRef.current = setInterval(() => {
            setCountdowns(prev => {
                const updated = { ...prev };
                let hasExpired = false;
                for (const id of Object.keys(updated)) {
                    if (updated[id] > 0) {
                        updated[id] = updated[id] - 1;
                        if (updated[id] <= 0) {
                            hasExpired = true;
                        }
                    }
                }
                if (hasExpired) {
                    // Defer the expiry handling outside setState
                    setTimeout(() => handleExpiry(), 0);
                }
                return updated;
            });
        }, 1000);

        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, [handleExpiry]);

    useEffect(() => {
        fetchData();

        const subscription = supabase
            .channel('rider-bids-' + orderId)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'order_rider_bids',
                filter: `order_id=eq.${orderId}`
            }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [orderId]);

    const handleAcceptBid = async (riderUserId: string) => {
        setAccepting(riderUserId);

        const { data, error } = await supabase.rpc('accept_rider_bid', {
            p_order_id: orderId,
            p_rider_id: riderUserId
        });

        setAccepting(null);

        if (error) {
            Alert.alert('Error', error.message);
            return;
        }

        if (data?.success) {
            Alert.alert('Success', 'Rider assigned! They will pick up the order.', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } else {
            Alert.alert('Error', data?.message || 'Failed to assign rider');
        }
    };

    const handleSendInvite = async (rider: Rider) => {
        const riderUserId = rider.user_id;
        const DEFAULT_FEE = 500;

        Alert.alert(
            "Send Request",
            `Send delivery request to ${rider.profile?.first_name || 'Rider'} for ₦${DEFAULT_FEE}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Send",
                    style: "default",
                    onPress: async () => {
                        setAccepting(riderUserId);

                        // Use invite_rider RPC
                        const { data, error } = await supabase.rpc('invite_rider', {
                            p_order_id: orderId,
                            p_rider_id: riderUserId,
                            p_amount: DEFAULT_FEE
                        });

                        setAccepting(null);

                        if (error) {
                            Alert.alert('Error', error.message);
                            return;
                        }

                        if (data?.success) {
                            Alert.alert('Success', 'Request sent! Waiting for rider to accept.');
                            // Refresh will happen automatically via realtime, but good to be safe
                            fetchData();
                        } else {
                            Alert.alert('Error', data?.message || 'Failed to send request');
                        }
                    }
                }
            ]
        );
    };

    const renderRiderCard = ({ item, type }: { item: Rider | RiderBid, type: 'bid' | 'invite' | 'available' }) => {
        let rider: Rider;
        let riderUserId: string;

        if (type === 'bid' || type === 'invite') {
            rider = (item as RiderBid).rider;
            riderUserId = (item as RiderBid).rider_id;
        } else {
            rider = item as Rider;
            riderUserId = rider.user_id;
        }

        const profile = rider.profile;
        const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unnamed Rider';
        const isAccepting = accepting === riderUserId;

        // Determine Button State
        let buttonText = "Assign";
        let buttonColor = ['#3b82f6', '#2563eb'];
        let buttonIcon = "paper-plane";
        let isDisabled = false;
        let onPress = () => { };
        const bidId = type === 'bid' || type === 'invite' || type === 'expired' ? (item as RiderBid).id : '';
        const countdown = countdowns[bidId];

        if (type === 'bid') {
            buttonText = "Accept Bid";
            buttonColor = ['#22c55e', '#16a34a'];
            buttonIcon = "checkmark-circle";
            onPress = () => handleAcceptBid(riderUserId);
        } else if (type === 'expired') {
            buttonText = "Re-invite";
            buttonColor = ['#3b82f6', '#2563eb']; // Blue for action
            buttonIcon = "refresh";
            isDisabled = false;
            onPress = () => handleSendInvite(rider);
        } else if (type === 'invite') {
            const timeLeft = countdown !== undefined ? countdown : 0;
            buttonText = timeLeft > 0 ? `Waiting... ${timeLeft}s` : "Expired ⏰";
            buttonColor = timeLeft > 0 ? ['#f59e0b', '#d97706'] : ['#ef4444', '#dc2626'];
            buttonIcon = timeLeft > 0 ? "time" : "close-circle";
            isDisabled = true; // Still disabled here because this is the *active* invite row (which might just have ticked to 0)
        } else {
            buttonText = "Send Request";
            buttonColor = ['#3b82f6', '#2563eb'];
            onPress = () => handleSendInvite(rider);
        }

        return (
            <View style={[styles.riderCard, { backgroundColor: cardBg, borderColor }]}>
                {/* Rider Info Row */}
                <View style={styles.riderInfoRow}>
                    {/* Photo */}
                    <View style={styles.photoContainer}>
                        {rider.rider_photo ? (
                            <Image source={{ uri: rider.rider_photo }} style={styles.riderPhoto} />
                        ) : (
                            <View style={[styles.riderPhotoPlaceholder, { backgroundColor: '#f27c22' }]}>
                                <Ionicons name="person" size={28} color="#fff" />
                            </View>
                        )}
                        <View style={[styles.onlineIndicator, { backgroundColor: rider.status === 'active' ? '#22c55e' : '#888' }]} />
                    </View>

                    {/* Details */}
                    <View style={styles.riderDetails}>
                        <ThemedText style={styles.riderName}>{fullName}</ThemedText>

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Ionicons name="star" size={14} color="#f59e0b" />
                                <ThemedText style={styles.statText}>
                                    {rider.average_rating?.toFixed(1) || 'New'}
                                </ThemedText>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Ionicons name="bicycle" size={14} color={subtleText} />
                                <ThemedText style={[styles.statText, { color: subtleText }]}>
                                    {rider.total_jobs || 0} trips
                                </ThemedText>
                            </View>
                        </View>

                        <View style={styles.vehicleRow}>
                            <View style={[styles.vehicleBadge, { backgroundColor: isDark ? '#333' : '#f3f4f6' }]}>
                                <Ionicons
                                    name={rider.vehicle_type === 'car' ? 'car' : rider.vehicle_type === 'bicycle' ? 'bicycle' : 'speedometer'}
                                    size={14}
                                    color="#f27c22"
                                />
                                <ThemedText style={styles.vehicleText}>
                                    {rider.vehicle_type?.charAt(0).toUpperCase() + rider.vehicle_type?.slice(1) || 'Bike'}
                                </ThemedText>
                            </View>
                            <ThemedText style={[styles.plateText, { color: subtleText }]}>
                                {rider.vehicle_plate || 'No plate'}
                            </ThemedText>
                        </View>
                    </View>
                </View>

                {/* Accept/Assign Button */}
                <TouchableOpacity
                    style={[
                        styles.acceptButton,
                        isDisabled && { opacity: 0.7 }
                    ]}
                    onPress={onPress}
                    disabled={isAccepting || isDisabled || (accepting !== null && accepting !== riderUserId)}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={buttonColor as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.acceptButtonGradient}
                    >
                        {isAccepting ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Ionicons name={buttonIcon as any} size={20} color="#fff" />
                                <ThemedText style={styles.acceptButtonText}>
                                    {buttonText}
                                </ThemedText>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        );
    };

    const handleBroadcast = async () => {
        Alert.alert(
            "Broadcast Request",
            "This will invite up to 20 nearby riders to this order. Continue?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Broadcast",
                    onPress: async () => {
                        setLoading(true);
                        const { data, error } = await supabase.rpc('broadcast_order_request', {
                            p_order_id: orderId,
                            p_amount: 500 // Default fee
                        });

                        if (error) {
                            Alert.alert('Error', error.message);
                        } else {
                            Alert.alert('Success', data?.message || 'Broadcast sent!');
                            fetchData();
                        }
                        setLoading(false);
                    }
                }
            ]
        );
    };

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={isDark ? ['#1f2050', '#1a1a2e'] : ['#1f2050', '#2d2d6e']}
                style={styles.headerGradient}
            >
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <ThemedText style={styles.headerTitle}>Select a Rider</ThemedText>
                    <ThemedText style={styles.headerSubtitle}>
                        {bids.length} interested • {invites.length} invited • {expiredInvites.length} expired • {availableRiders.length} nearby
                    </ThemedText>
                </View>
                <TouchableOpacity
                    style={styles.broadcastButton}
                    onPress={handleBroadcast}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={['#f27c22', '#d96a1a']}
                        style={styles.broadcastGradient}
                    >
                        <Ionicons name="radio" size={20} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </LinearGradient>

            <FlatList
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={fetchData}
                        tintColor="#f27c22"
                        colors={['#f27c22']}
                    />
                }
                data={[]}
                renderItem={() => null}
                ListHeaderComponent={
                    <View style={{ gap: 24 }}>
                        {/* Bids Section */}
                        <View>
                            <ThemedText style={[styles.sectionTitle, { color: subtleText }]}>
                                Interested Riders ({bids.length})
                            </ThemedText>
                            {bids.length > 0 ? (
                                bids.map(bid => (
                                    <View key={bid.id} style={{ marginBottom: 16 }}>
                                        {renderRiderCard({ item: bid, type: 'bid' })}
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptySection}>
                                    <ThemedText style={[styles.emptySectionText, { color: subtleText }]}>
                                        No active bids yet.
                                    </ThemedText>
                                </View>
                            )}
                        </View>

                        {/* Pending Invites Section */}
                        {invites.length > 0 && (
                            <View>
                                <ThemedText style={[styles.sectionTitle, { color: subtleText }]}>
                                    Pending Invites ({invites.length})
                                </ThemedText>
                                {invites.map(invite => (
                                    <View key={invite.id} style={{ marginBottom: 16 }}>
                                        {renderRiderCard({ item: invite, type: 'invite' })}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Expired Invites Section */}
                        {expiredInvites.length > 0 && (
                            <View>
                                <ThemedText style={[styles.sectionTitle, { color: '#ef4444' }]}>
                                    ⏰ Expired ({expiredInvites.length})
                                </ThemedText>
                                {expiredInvites.map(invite => (
                                    <View key={invite.id} style={{ marginBottom: 16, opacity: 0.6 }}>
                                        {renderRiderCard({ item: invite, type: 'expired' as any })}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Available Riders Section */}
                        <View>
                            <ThemedText style={[styles.sectionTitle, { color: subtleText }]}>
                                Other Available Riders ({availableRiders.length})
                            </ThemedText>
                            {availableRiders.length > 0 ? (
                                availableRiders.map(rider => (
                                    <View key={rider.id} style={{ marginBottom: 16 }}>
                                        {renderRiderCard({ item: rider, type: 'available' })}
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptySection}>
                                    <ThemedText style={[styles.emptySectionText, { color: subtleText }]}>
                                        No other riders active nearby.
                                    </ThemedText>
                                </View>
                            )}
                        </View>
                    </View>
                }
                ListEmptyComponent={null}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContent: {
        flex: 1,
        marginLeft: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    broadcastButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        overflow: 'hidden',
        marginLeft: 10,
        shadowColor: '#f27c22',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    broadcastGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4,
    },
    riderCard: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        padding: 16,
    },
    riderInfoRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    photoContainer: {
        position: 'relative',
    },
    riderPhoto: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#f0f0f0',
    },
    riderPhotoPlaceholder: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 3,
        borderColor: '#fff',
    },
    riderDetails: {
        flex: 1,
        marginLeft: 14,
        justifyContent: 'center',
    },
    riderName: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 13,
        fontWeight: '600',
    },
    statDivider: {
        width: 1,
        height: 12,
        backgroundColor: '#ddd',
        marginHorizontal: 10,
    },
    vehicleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    vehicleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    vehicleText: {
        fontSize: 12,
        fontWeight: '600',
    },
    plateText: {
        fontSize: 12,
    },
    acceptButton: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    acceptButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 10,
    },
    acceptButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
    emptySection: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        borderRadius: 16,
        borderStyle: 'dashed',
    },
    emptySectionText: {
        fontSize: 14,
    }
});
