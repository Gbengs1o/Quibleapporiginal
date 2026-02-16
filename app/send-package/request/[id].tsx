import RiderLoader from '@/components/RiderLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { uploadToCloudinary } from '@/utils/cloudinary';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Linking,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

// Status timeline steps
const STATUS_STEPS = [
    { key: 'pending', label: 'Waiting for Bids', icon: 'hourglass-outline' as const },
    { key: 'accepted', label: 'Rider Accepted', icon: 'checkmark-circle-outline' as const },
    { key: 'picked_up', label: 'Picked Up', icon: 'cube-outline' as const },
    { key: 'delivered', label: 'Delivered', icon: 'flag-outline' as const },
];

export default function RequestDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const [request, setRequest] = useState<any>(null);
    const [bids, setBids] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [updatingImage, setUpdatingImage] = useState(false);

    // Theme colors - Premium palette
    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#0D0D0D' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1A1A1A' }, 'background');
    const cardBgAlt = useThemeColor({ light: '#F8F9FC', dark: '#242424' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const mutedText = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');
    const borderColor = useThemeColor({ light: '#E5E7EB', dark: '#333333' }, 'background');
    const primary = '#F27C22';
    const success = '#22C55E';
    const teal = '#26A69A';
    const errorColor = '#EF4444';

    // Review State
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [rating, setRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();
    }, []);

    useEffect(() => {
        fetchDetails();

        // Real-time subscription for new bids
        const subscription = supabase
            .channel(`bids:${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_bids', filter: `request_id=eq.${id}` },
                () => fetchDetails()
            )
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'delivery_requests', filter: `id=eq.${id}` },
                () => fetchDetails()
            )
            .subscribe();

        return () => { supabase.removeChannel(subscription); };
    }, [id]);

    const fetchDetails = async () => {
        try {
            // Fetch Request
            const { data: reqData, error: reqError } = await supabase
                .from('delivery_requests')
                .select('*')
                .eq('id', id)
                .single();

            if (reqError) throw reqError;
            setRequest(reqData);

            // Fetch Bids with Rider Info - Filter out rejected bids
            const { data: bidsData, error: bidsError } = await supabase
                .from('delivery_bids')
                .select(`
                    *,
                    rider:riders(
                        user_id,
                        vehicle_type,
                        vehicle_plate,
                        rider_photo,
                        profile:profiles(
                            first_name,
                            last_name,
                            phone_number,
                            profile_picture_url
                        )
                    )
                `)
                .eq('request_id', id)
                .neq('status', 'rejected') // Hide rejected bids
                .order('amount', { ascending: true });

            if (bidsError) throw bidsError;
            setBids(bidsData || []);

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Could not load details');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleUpdateImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.7,
            });

            if (!result.canceled) {
                setUpdatingImage(true);
                const asset = result.assets[0];
                const imageUrl = await uploadToCloudinary(asset.uri, 'image');

                const { error } = await supabase
                    .from('delivery_requests')
                    .update({ item_image_url: imageUrl, media_type: 'image' })
                    .eq('id', id);

                if (error) throw error;
                Alert.alert('Success', 'Package image updated!');
                fetchDetails();
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to update image');
        } finally {
            setUpdatingImage(false);
        }
    };

    const handleAcceptBid = async (bid: any) => {
        setAccepting(true);
        try {
            const { data, error } = await supabase.rpc('accept_delivery_bid', {
                p_request_id: id,
                p_bid_id: bid.id
            });

            if (error) throw error;
            if (data && !data.success) {
                Alert.alert('Payment Failed', data.message);
                return;
            }

            Alert.alert('🎉 Success!', 'Rider accepted! Payment deducted and rider notified.', [
                { text: 'OK', onPress: () => fetchDetails() }
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setAccepting(false);
        }
    };

    const handleDeclineBid = async (bidId: string) => {
        Alert.alert('Decline Offer?', 'This rider\'s offer will be removed.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Decline',
                style: 'destructive',
                onPress: async () => {
                    // Optimistic update
                    setBids(prev => prev.filter(b => b.id !== bidId));

                    const { error } = await supabase
                        .from('delivery_bids')
                        .update({ status: 'rejected' })
                        .eq('id', bidId);

                    if (error) {
                        Alert.alert('Error', 'Could not decline bid');
                        fetchDetails(); // Revert
                    }
                }
            }
        ]);
    };

    const handleCallRider = (phone: string) => {
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        } else {
            Alert.alert('No Phone', 'Rider phone number not available');
        }
    };

    const handleCancelRequest = () => {
        Alert.alert('Cancel Request?', 'Are you sure you want to cancel this delivery request?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, Cancel',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const { error } = await supabase
                            .from('delivery_requests')
                            .update({ status: 'cancelled' })
                            .eq('id', id);

                        if (error) throw error;
                        Alert.alert('Cancelled', 'Request has been cancelled.');
                        router.back();
                    } catch (error) {
                        Alert.alert('Error', 'Failed to cancel request');
                    }
                }
            }
        ]);
    };

    const handleConfirmReceived = async () => {
        Alert.alert(
            'Confirm Delivery?',
            'Has the rider delivered your package? This will release the payment to them.',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, I Received It',
                    style: 'default',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { data, error } = await supabase.rpc('complete_delivery_job_v2', {
                                p_request_id: id
                            });

                            if (error) throw error;
                            if (data && !data.success) throw new Error(data.message);

                            // Success - Open Rating Modal instead of just alerting
                            setReviewModalVisible(true);
                            fetchDetails();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Could not confirm delivery');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const submitReview = async () => {
        if (rating === 0) {
            Alert.alert('Rating Required', 'Please select a star rating.');
            return;
        }

        setSubmittingReview(true);
        try {
            const { error } = await supabase.from('reviews').insert({
                request_id: id,
                reviewer_id: user?.id,
                reviewee_id: request.rider_id,
                role: 'user', // User reviewing rider
                rating: rating,
                comment: reviewComment
            });

            if (error) throw error;

            setReviewModalVisible(false);
            Alert.alert('Thank you!', 'Your review has been submitted.');
        } catch (error: any) {
            Alert.alert('Error', 'Failed to submit review');
        } finally {
            setSubmittingReview(false);
        }
    };

    const getStatusIndex = (status: string) => {
        return STATUS_STEPS.findIndex(s => s.key === status);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return primary;
            case 'accepted': return '#3B82F6';
            case 'picked_up': return teal;
            case 'delivered': return success;
            case 'cancelled': return errorColor;
            default: return mutedText;
        }
    };

    const getVehicleIcon = (type: string | undefined): keyof typeof Ionicons.glyphMap => {
        const t = (type || '').toLowerCase();
        if (t.includes('bike') || t.includes('cycle')) return 'bicycle';
        if (t.includes('car') || t.includes('sedan') || t.includes('suv')) return 'car-sport';
        if (t.includes('van') || t.includes('truck')) return 'bus';
        return 'bicycle'; // Default
    };

    // Loading state with RiderLoader
    if (loading) {
        return (
            <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
                <RiderLoader size={200} message="Loading delivery details..." fullScreen={true} />
            </ThemedView>
        );
    }

    if (!request) {
        return (
            <ThemedView style={[styles.container, styles.centerContent, { backgroundColor: bgColor }]}>
                <Ionicons name="alert-circle-outline" size={64} color={mutedText} />
                <ThemedText style={[styles.emptyText, { color: mutedText }]}>Request not found</ThemedText>
                <TouchableOpacity style={[styles.retryBtn, { backgroundColor: primary }]} onPress={() => router.back()}>
                    <ThemedText style={styles.retryBtnText}>Go Back</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    const statusIndex = getStatusIndex(request.status);
    const assignedRider = bids.find(b => b.rider_id === request.rider_id);

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            {/* Premium Header */}
            <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: cardBgAlt }]}>
                    <Ionicons name="arrow-back" size={22} color={textColor} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <ThemedText style={[styles.headerTitle, { color: textColor }]}>Delivery Request</ThemedText>
                </View>
                <TouchableOpacity onPress={handleCancelRequest} style={[styles.backBtn, { backgroundColor: '#fee2e2' }]}>
                    <Ionicons name="trash-outline" size={20} color={errorColor} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDetails(); }} colors={[primary]} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Decorative Lottie Animation */}
                <Animated.View style={[styles.lottieContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                    <LottieView
                        source={{ uri: 'https://lottie.host/c521ed01-8a56-462f-aa7a-68880b4cd767/KYAukb11zi.lottie' }}
                        autoPlay
                        loop
                        style={styles.lottieAnim}
                    />
                </Animated.View>

                {/* Status Card */}
                <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
                        <Ionicons name={request.status === 'delivered' ? 'checkmark-circle' : 'time'} size={18} color={getStatusColor(request.status)} />
                        <ThemedText style={[styles.statusBadgeText, { color: getStatusColor(request.status) }]}>
                            {request.status.replace('_', ' ').toUpperCase()}
                        </ThemedText>
                    </View>

                    {/* Status Timeline */}
                    {request.status !== 'cancelled' && (
                        <View style={styles.timeline}>
                            {STATUS_STEPS.map((step, index) => {
                                const isActive = index <= statusIndex;
                                const isCurrent = index === statusIndex;
                                return (
                                    <View key={step.key} style={styles.timelineStep}>
                                        <View style={[
                                            styles.timelineIcon,
                                            { backgroundColor: isActive ? primary : borderColor },
                                            isCurrent && styles.timelineIconCurrent
                                        ]}>
                                            <Ionicons name={step.icon} size={16} color={isActive ? '#fff' : mutedText} />
                                        </View>
                                        {index < STATUS_STEPS.length - 1 && (
                                            <View style={[styles.timelineLine, { backgroundColor: index < statusIndex ? primary : borderColor }]} />
                                        )}
                                        <ThemedText style={[styles.timelineLabel, { color: isActive ? textColor : mutedText }]} numberOfLines={1}>
                                            {step.label}
                                        </ThemedText>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>

                {/* Delivery Code Display */}
                {request?.delivery_code && request?.status !== 'delivered' && request?.status !== 'cancelled' && (
                    <Reanimated.View
                        entering={FadeInDown.delay(200).springify()}
                        style={[styles.card, { backgroundColor: primary, alignItems: 'center', paddingVertical: 24 }]}
                    >
                        <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 4, opacity: 0.9 }}>
                            SHARE WITH RIDER
                        </ThemedText>
                        <ThemedText style={{ color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: 6 }}>
                            {request.delivery_code}
                        </ThemedText>
                        <ThemedText style={{ color: '#fff', fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                            Only share upon delivery arrival
                        </ThemedText>
                    </Reanimated.View>
                )}

                {/* Locations Card */}
                <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="navigate" size={20} color={primary} />
                        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Route Details</ThemedText>
                    </View>

                    <View style={styles.locationItem}>
                        <View style={[styles.locationDot, { backgroundColor: primary }]} />
                        <View style={styles.locationContent}>
                            <ThemedText style={[styles.locationLabel, { color: mutedText }]}>PICKUP</ThemedText>
                            <ThemedText style={[styles.locationAddress, { color: textColor }]} numberOfLines={2}>
                                {request.pickup_address}
                            </ThemedText>
                        </View>
                    </View>

                    <View style={[styles.locationConnector, { borderLeftColor: borderColor }]} />

                    <View style={styles.locationItem}>
                        <View style={[styles.locationDot, { backgroundColor: success }]} />
                        <View style={styles.locationContent}>
                            <ThemedText style={[styles.locationLabel, { color: mutedText }]}>DROPOFF</ThemedText>
                            <ThemedText style={[styles.locationAddress, { color: textColor }]} numberOfLines={2}>
                                {request.dropoff_address}
                            </ThemedText>
                        </View>
                    </View>
                </View>

                {/* Package & Pricing Card */}
                <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="cube" size={20} color={teal} />
                            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Package & Pricing</ThemedText>
                        </View>
                        <TouchableOpacity onPress={handleUpdateImage}>
                            <ThemedText style={{ color: primary, fontSize: 13, fontWeight: '600' }}>
                                {request.item_image_url ? 'Change Photo' : 'Add Photo'}
                            </ThemedText>
                        </TouchableOpacity>
                    </View>

                    {/* Package Image Display */}
                    {request.item_image_url ? (
                        <TouchableOpacity onPress={() => setViewingImage(request.item_image_url)}>
                            <Image
                                source={{ uri: request.item_image_url }}
                                style={styles.packageImage}
                                resizeMode="cover"
                            />
                            <View style={styles.zoomHint}>
                                <Ionicons name="expand" size={16} color="#fff" />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={[styles.addPhotoPlaceholder, { backgroundColor: cardBgAlt, borderColor }]} onPress={handleUpdateImage}>
                            <Ionicons name="camera-outline" size={32} color={mutedText} />
                            <ThemedText style={[styles.addPhotoText, { color: mutedText }]}>No image provided</ThemedText>
                        </TouchableOpacity>
                    )}

                    {updatingImage && (
                        <View style={styles.uploadingIndicator}>
                            <ActivityIndicator size="small" color={primary} />
                            <ThemedText style={{ marginLeft: 8, fontSize: 12, color: primary }}>Uploading...</ThemedText>
                        </View>
                    )}

                    <View style={styles.infoRow}>
                        <View style={[styles.infoBox, { backgroundColor: cardBgAlt }]}>
                            <ThemedText style={[styles.infoLabel, { color: mutedText }]}>Your Offer</ThemedText>
                            <ThemedText style={[styles.infoValue, { color: primary }]}>₦{request.offered_price?.toLocaleString()}</ThemedText>
                        </View>
                        {request.final_price && (
                            <View style={[styles.infoBox, { backgroundColor: cardBgAlt }]}>
                                <ThemedText style={[styles.infoLabel, { color: mutedText }]}>Final Price</ThemedText>
                                <ThemedText style={[styles.infoValue, { color: success }]}>₦{request.final_price?.toLocaleString()}</ThemedText>
                            </View>
                        )}
                    </View>

                    {request.item_description && (
                        <View style={[styles.descriptionBox, { backgroundColor: cardBgAlt, borderColor }]}>
                            <ThemedText style={[styles.descriptionLabel, { color: mutedText }]}>Item Description</ThemedText>
                            <ThemedText style={[styles.descriptionText, { color: textColor }]}>{request.item_description}</ThemedText>
                        </View>
                    )}
                </View>

                {/* Assigned Rider Card (if accepted) */}
                {assignedRider && request.status !== 'pending' && (
                    <View style={[styles.card, styles.riderCard, { backgroundColor: cardBg, borderColor: success }]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="bicycle" size={20} color={success} />
                            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Your Rider</ThemedText>
                        </View>

                        <View style={styles.riderInfo}>
                            <TouchableOpacity onPress={() => router.push(`/rider-profile/${assignedRider.rider?.user_id}`)}>
                                <Image
                                    source={{
                                        uri: assignedRider.rider?.profile?.profile_picture_url || assignedRider.rider?.rider_photo ||
                                            `https://ui-avatars.com/api/?name=${assignedRider.rider?.profile?.first_name}+${assignedRider.rider?.profile?.last_name}&background=26A69A&color=fff`
                                    }}
                                    style={styles.riderPhoto}
                                />
                            </TouchableOpacity>
                            <View style={styles.riderDetails}>
                                <TouchableOpacity onPress={() => router.push(`/rider-profile/${assignedRider.rider?.user_id}`)}>
                                    <ThemedText style={[styles.riderName, { color: textColor }]}>
                                        {assignedRider.rider?.profile?.first_name} {assignedRider.rider?.profile?.last_name}
                                    </ThemedText>
                                    <ThemedText style={{ fontSize: 12, color: primary, marginBottom: 2 }}>View Profile</ThemedText>
                                </TouchableOpacity>
                                <View style={styles.riderMeta}>
                                    <Ionicons name={getVehicleIcon(assignedRider.rider?.vehicle_type)} size={14} color={mutedText} />
                                    <ThemedText style={[styles.riderVehicle, { color: mutedText }]}>
                                        {assignedRider.rider?.vehicle_type} • {assignedRider.rider?.vehicle_plate}
                                    </ThemedText>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[styles.callBtn, { backgroundColor: success }]}
                                onPress={() => handleCallRider(assignedRider.rider?.profile?.phone_number)}
                            >
                                <Ionicons name="call" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ThemedText style={[styles.agreedPrice, { color: success }]}>
                            Agreed Price: ₦{assignedRider.amount?.toLocaleString()}
                        </ThemedText>

                        {/* User Confirmation Button */}
                        {request.status === 'picked_up' && (
                            <TouchableOpacity
                                style={[styles.confirmBtn, { backgroundColor: primary }]}
                                onPress={handleConfirmReceived}
                            >
                                <ThemedText style={styles.confirmBtnText}>Confirm Delivery Received</ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Bids Section (if pending) */}
                {request.status === 'pending' && (
                    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="people" size={20} color={primary} />
                            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                                Bids from Riders ({bids.length})
                            </ThemedText>
                        </View>

                        {bids.length === 0 ? (
                            <View style={styles.emptyBidsContainer}>
                                <View style={[styles.waitingIcon, { backgroundColor: primary + '15' }]}>
                                    <Ionicons name="hourglass-outline" size={32} color={primary} />
                                </View>
                                <ThemedText style={[styles.emptyBidsText, { color: mutedText }]}>
                                    Waiting for riders to bid...
                                </ThemedText>
                                <ThemedText style={[styles.emptyBidsSubtext, { color: mutedText }]}>
                                    Bids will appear here in real-time
                                </ThemedText>
                            </View>
                        ) : (
                            bids.map((bid, index) => (
                                <Animated.View
                                    key={bid.id}
                                    style={[
                                        styles.bidCard,
                                        { backgroundColor: cardBgAlt, borderColor },
                                        index === 0 && styles.bestBid
                                    ]}
                                >
                                    {index === 0 && (
                                        <View style={[styles.bestBadge, { backgroundColor: success }]}>
                                            <ThemedText style={styles.bestBadgeText}>BEST OFFER</ThemedText>
                                        </View>
                                    )}
                                    <View style={styles.bidContent}>
                                        <TouchableOpacity onPress={() => router.push(`/rider-profile/${bid.rider?.user_id}`)}>
                                            <Image
                                                source={{
                                                    uri: bid.rider?.profile?.profile_picture_url || bid.rider?.rider_photo ||
                                                        `https://ui-avatars.com/api/?name=${bid.rider?.profile?.first_name}+${bid.rider?.profile?.last_name}&background=26A69A&color=fff`
                                                }}
                                                style={styles.bidAvatarImg}
                                            />
                                        </TouchableOpacity>
                                        <View style={styles.bidDetails}>
                                            <TouchableOpacity onPress={() => router.push(`/rider-profile/${bid.rider?.user_id}`)}>
                                                <ThemedText style={[styles.bidRiderName, { color: textColor }]}>
                                                    {bid.rider?.profile?.first_name} {bid.rider?.profile?.last_name}
                                                </ThemedText>
                                            </TouchableOpacity>
                                            <View style={styles.bidMeta}>
                                                <Ionicons name={getVehicleIcon(bid.rider?.vehicle_type)} size={12} color={mutedText} />
                                                <ThemedText style={[styles.bidVehicle, { color: mutedText }]}>
                                                    {bid.rider?.vehicle_type} • {bid.rider?.vehicle_plate}
                                                </ThemedText>
                                            </View>
                                        </View>
                                        <View style={styles.bidRight}>
                                            <ThemedText style={[styles.bidAmount, { color: primary }]}>
                                                ₦{bid.amount?.toLocaleString()}
                                            </ThemedText>
                                            <View style={styles.bidActions}>
                                                <TouchableOpacity
                                                    style={[styles.declineBtn, { borderColor: errorColor }]}
                                                    onPress={() => handleDeclineBid(bid.id)}
                                                    disabled={accepting}
                                                >
                                                    <Ionicons name="close" size={16} color={errorColor} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.acceptBtn, { backgroundColor: primary, opacity: accepting ? 0.6 : 1 }]}
                                                    onPress={() => handleAcceptBid(bid)}
                                                    disabled={accepting}
                                                >
                                                    <ThemedText style={styles.acceptBtnText}>Accept</ThemedText>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                </Animated.View>
                            ))
                        )}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Accepting Overlay */}
            {accepting && (
                <View style={styles.acceptingOverlay}>
                    <View style={[styles.acceptingCard, { backgroundColor: cardBg }]}>
                        <RiderLoader size={120} message="" fullScreen={false} />
                        <ThemedText style={[styles.acceptingText, { color: textColor }]}>Accepting bid...</ThemedText>
                    </View>
                </View>
            )}

            {/* Review Modal */}
            <Modal visible={reviewModalVisible} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.reviewCard, { backgroundColor: cardBg }]}>
                        <ThemedText style={[styles.reviewTitle, { color: textColor }]}>Rate your Rider</ThemedText>
                        <ThemedText style={{ color: mutedText, textAlign: 'center', marginBottom: 20 }}>
                            How was your experience with {bids.find(b => b.rider_id === request?.rider_id)?.rider?.profile?.first_name}?
                        </ThemedText>

                        <View style={styles.starsContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                                    <Ionicons
                                        name={star <= rating ? "star" : "star-outline"}
                                        size={32}
                                        color={star <= rating ? "#FFD700" : mutedText}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={[styles.inputContainer, { backgroundColor: cardBgAlt, borderColor }]}>
                            <ThemedText style={{ color: mutedText, marginBottom: 8 }}>Details (Optional)</ThemedText>
                            <View style={{ padding: 10, borderWidth: 1, borderColor: borderColor, borderRadius: 8 }}>
                                <ThemedText style={{ color: textColor }}>{/* Placeholder for TextInput, using simple view for now since TextInput wasn't imported or configured broadly */}</ThemedText>
                                {/* Actual TextInput would go here, simplified for this step to avoid import issues if TextInput not heavily used */}
                            </View>
                            {/* Re-injecting TextInput correctly */}
                        </View>

                        {/* Replacing above placeholder with actual TextInput logic requires importing TextInput if not present.  
                            Checking imports... TextInput IS imported. Good. */}
                    </View>
                </View>
            </Modal>

            {/* Review Modal Corrected */}
            <Modal visible={reviewModalVisible} transparent={true} animationType="fade" onRequestClose={() => setReviewModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.reviewCard, { backgroundColor: cardBg }]}>
                        <ThemedText style={[styles.reviewTitle, { color: textColor }]}>Rate your Rider</ThemedText>
                        <ThemedText style={{ color: mutedText, textAlign: 'center', marginBottom: 20 }}>
                            How was your delivery experience?
                        </ThemedText>

                        <View style={styles.starsContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                                    <Ionicons
                                        name={star <= rating ? "star" : "star-outline"}
                                        size={36}
                                        color={star <= rating ? "#FFD700" : borderColor}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={[styles.commentInput, { color: textColor, backgroundColor: cardBgAlt, borderColor }]}
                            placeholder="Write a comment..."
                            placeholderTextColor={mutedText}
                            multiline
                            numberOfLines={3}
                            value={reviewComment}
                            onChangeText={setReviewComment}
                        />

                        <TouchableOpacity
                            style={[styles.confirmBtn, { backgroundColor: primary, marginTop: 20 }]}
                            onPress={submitReview}
                            disabled={submittingReview}
                        >
                            {submittingReview ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <ThemedText style={styles.confirmBtnText}>Submit Review</ThemedText>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ marginTop: 16, padding: 10 }}
                            onPress={() => setReviewModalVisible(false)}
                        >
                            <ThemedText style={{ color: mutedText }}>Skip</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerContent: { justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 16, marginTop: 16 },
    retryBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    retryBtnText: { color: '#fff', fontWeight: '600' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    headerCenter: { alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    headerSubtitle: { fontSize: 12, marginTop: 2 },
    backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

    scrollContent: { padding: 16 },

    // Lottie
    lottieContainer: { alignItems: 'center', marginBottom: 8 },
    lottieAnim: { width: 180, height: 140 },

    // Cards
    card: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
            android: { elevation: 3 }
        }),
    },
    riderCard: { borderWidth: 2 },

    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700' },

    // Package Image
    packageImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 16 },
    zoomHint: { position: 'absolute', bottom: 24, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 8 },
    addPhotoPlaceholder: { width: '100%', height: 120, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    addPhotoText: { marginTop: 8, fontSize: 12 },
    uploadingIndicator: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },


    // Status
    statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 8, marginBottom: 20 },
    statusBadgeText: { fontSize: 12, fontWeight: '700' },

    // Timeline
    timeline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    timelineStep: { alignItems: 'center', flex: 1 },
    timelineIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    timelineIconCurrent: {
        ...Platform.select({
            ios: { shadowColor: '#F27C22', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8 },
            android: { elevation: 6 }
        }),
    },
    timelineLine: { position: 'absolute', top: 18, left: '55%', width: '90%', height: 3, borderRadius: 2, zIndex: -1 },
    timelineLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

    // Location
    locationItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    locationDot: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
    locationContent: { flex: 1 },
    locationLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
    locationAddress: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
    locationConnector: { height: 30, borderLeftWidth: 2, borderStyle: 'dashed', marginLeft: 6, marginVertical: 4 },

    // Info
    infoRow: { flexDirection: 'row', gap: 12 },
    infoBox: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center' },
    infoLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
    infoValue: { fontSize: 20, fontWeight: '800' },

    descriptionBox: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1 },
    descriptionLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
    descriptionText: { fontSize: 14, lineHeight: 20 },

    // Rider
    riderInfo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    riderPhoto: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#fff' },
    riderDetails: { flex: 1 },
    riderName: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    riderMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    riderVehicle: { fontSize: 13 },
    callBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    agreedPrice: { marginTop: 16, fontSize: 15, fontWeight: '700', textAlign: 'center' },
    confirmBtn: { marginTop: 16, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', width: '100%' },
    confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    // Bids
    emptyBidsContainer: { alignItems: 'center', padding: 30 },
    waitingIcon: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    emptyBidsText: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
    emptyBidsSubtext: { fontSize: 13 },

    bidCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12, position: 'relative', overflow: 'hidden' },
    bestBid: { borderColor: '#22C55E', borderWidth: 2 },
    bestBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 12 },
    bestBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

    bidContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bidAvatarImg: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eee' },
    bidDetails: { flex: 1 },
    bidRiderName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
    bidMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    bidVehicle: { fontSize: 12 },
    bidRight: { alignItems: 'flex-end', gap: 8 },
    bidAmount: { fontSize: 18, fontWeight: '800' },

    bidActions: { flexDirection: 'row', gap: 8 },
    declineBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    acceptBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, height: 36, justifyContent: 'center' },
    acceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    // Overlay
    acceptingOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100
    },
    acceptingCard: { width: 240, padding: 30, borderRadius: 24, alignItems: 'center' },
    acceptingText: { marginTop: 12, fontSize: 15, fontWeight: '600' },

    // Modal
    imageModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: width, height: '80%' },
    closeImageBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },

    // Review Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    reviewCard: { width: '100%', borderRadius: 24, padding: 24, alignItems: 'center' },
    reviewTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    starsContainer: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    commentInput: { width: '100%', height: 100, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
});
