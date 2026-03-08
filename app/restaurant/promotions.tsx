import FoodLoader from '@/components/FoodLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useWallet } from '@/contexts/wallet';
import { useThemeColor } from '@/hooks/use-theme-color';
import { uploadToCloudinary } from '@/utils/cloudinary';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');
const PROMO_WEEKLY_PRICE = 5000;
const PROMOTION_DESTINATIONS = ['profile', 'items', 'item', 'custom_url'] as const;
type PromoDestinationType = typeof PROMOTION_DESTINATIONS[number];

interface RestaurantProfile {
    id: string;
    name: string | null;
    address: string | null;
    city: string | null;
}

interface PromotionItemOption {
    id: string;
    name: string;
}

const extractCityFromAddress = (address: string | null): string | null => {
    if (!address) return null;
    const parts = address
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);

    if (parts.length >= 3) return parts[1];
    if (parts.length >= 1) return parts[0];
    return null;
};

export default function PromotionsScreen() {
    const { user } = useAuth();
    const { openMenu } = useRestaurantMenu();
    const { businessWallet, refreshWallet } = useWallet();
    const iconColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const inputBg = useThemeColor({ light: '#f5f5f5', dark: '#1B1B1B' }, 'background');
    const [loading, setLoading] = useState(true);
    const [promotions, setPromotions] = useState<any[]>([]);
    const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [weeks, setWeeks] = useState('1');
    const [media, setMedia] = useState<{ uri: string, type: 'image' | 'video' } | null>(null);
    const [destinationType, setDestinationType] = useState<PromoDestinationType>('profile');
    const [destinationValue, setDestinationValue] = useState('');
    const [itemOptions, setItemOptions] = useState<PromotionItemOption[]>([]);
    const [loadingItemOptions, setLoadingItemOptions] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) {
            fetchRestaurantAndPromos(true);
        }
    }, [user]);

    const fetchRestaurantProfile = async () => {
        const { data, error } = await supabase
            .from('restaurants')
            .select('id, name, address')
            .eq('owner_id', user?.id)
            .limit(1);

        if (error) throw error;
        const rawProfile = (data?.[0] as Pick<RestaurantProfile, 'id' | 'name' | 'address'> | undefined) || null;
        const profile: RestaurantProfile | null = rawProfile
            ? {
                ...rawProfile,
                city: extractCityFromAddress(rawProfile.address),
            }
            : null;
        setRestaurant(profile);
        return profile;
    };

    const fetchItemOptions = async (restaurantId: string) => {
        setLoadingItemOptions(true);
        try {
            const { data, error } = await supabase
                .from('menu_items')
                .select('id, name')
                .eq('restaurant_id', restaurantId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setItemOptions((data as PromotionItemOption[]) || []);
        } catch (error) {
            console.error('Error fetching restaurant item options:', error);
            setItemOptions([]);
        } finally {
            setLoadingItemOptions(false);
        }
    };

    const fetchRestaurantAndPromos = async (showLoader = false) => {
        if (showLoader) setLoading(true);
        try {
            const rest = await fetchRestaurantProfile();
            if (!rest?.id) {
                setPromotions([]);
                return;
            }

            const { data: promos, error: promosError } = await supabase
                    .from('promotions')
                    .select('*')
                    .eq('vendor_id', rest.id)
                    .eq('vendor_type', 'restaurant')
                    .order('created_at', { ascending: false });

            if (promosError) throw promosError;
            setPromotions(promos || []);
        } catch (error) {
            console.error('Error fetching promos:', error);
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const ensureRestaurantProfileLoaded = async () => {
        if (restaurant?.id) return restaurant;
        try {
            const profile = await fetchRestaurantProfile();
            if (!profile?.id) {
                Alert.alert('Profile Required', 'No restaurant profile is linked to this account yet.');
                return null;
            }
            return profile;
        } catch (error) {
            console.error('Error loading restaurant profile:', error);
            Alert.alert('Error', 'Could not load your restaurant profile. Please try again.');
            return null;
        }
    };

    const handleOpenCreateModal = async () => {
        const profile = await ensureRestaurantProfileLoaded();
        if (!profile?.id) return;
        await fetchItemOptions(profile.id);
        setShowCreateModal(true);
    };

    const handlePickMedia = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.7,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            setMedia({
                uri: asset.uri,
                type: asset.type === 'video' ? 'video' : 'image'
            });
        }
    };

    const isValidCustomDestination = (value: string) => /^https?:\/\/|^\//i.test(value);

    const getDestinationLabel = (promo: any) => {
        const destinationType = (promo?.destination_type || 'profile') as PromoDestinationType;
        const destinationValue = typeof promo?.destination_value === 'string' ? promo.destination_value : '';

        if (destinationType === 'item') return 'Destination: Specific Item';
        if (destinationType === 'items') return 'Destination: Product List';
        if (destinationType === 'custom_url') {
            return destinationValue ? `Destination: ${destinationValue}` : 'Destination: Custom URL';
        }
        return 'Destination: Profile';
    };

    const getCtr = (promo: any) => {
        const views = Number(promo?.views_count || 0);
        const clicks = Number(promo?.clicks_count || 0);
        if (views <= 0) return '0.00';
        return ((clicks / views) * 100).toFixed(2);
    };

    const handleSubmit = async () => {
        if (!title || !media) {
            Alert.alert('Error', 'Please provide a title and media content.');
            return;
        }

        const activeRestaurant = restaurant?.id ? restaurant : await ensureRestaurantProfileLoaded();
        if (!activeRestaurant?.id) return;

        const numWeeks = parseInt(weeks);
        if (isNaN(numWeeks) || numWeeks < 1) {
            Alert.alert('Error', 'Please enter a valid number of weeks.');
            return;
        }

        const totalCost = numWeeks * PROMO_WEEKLY_PRICE;
        if (!businessWallet || businessWallet.balance < totalCost) {
            Alert.alert('Insufficient Balance', `Your business wallet needs at least NGN ${totalCost.toLocaleString()} to run this promotion.`);
            return;
        }

        const trimmedDestinationValue = destinationValue.trim();
        if (destinationType === 'item' && !trimmedDestinationValue) {
            Alert.alert('Destination Required', 'Please select the destination item for this promotion.');
            return;
        }

        if (destinationType === 'custom_url') {
            if (!trimmedDestinationValue) {
                Alert.alert('Destination Required', 'Please enter a custom URL for this promotion.');
                return;
            }
            if (!isValidCustomDestination(trimmedDestinationValue)) {
                Alert.alert('Invalid URL', 'Custom URL must start with http(s):// or /.');
                return;
            }
        }

        if (destinationType === 'item' && trimmedDestinationValue && itemOptions.length > 0) {
            const isValidItem = itemOptions.some(item => item.id === trimmedDestinationValue);
            if (!isValidItem) {
                Alert.alert('Invalid Item', 'Selected item is invalid. Please choose from your active items.');
                return;
            }
        }

        Alert.alert(
            'Confirm Promotion',
            `Run this promotion for ${numWeeks} week(s)?\n\nTotal Cost: NGN ${totalCost.toLocaleString()}\n\nThis will be deducted from your business wallet.\n\nPromotion fees are non-refundable, including if you cancel or if the campaign is rejected.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', onPress: () => processPromotion(activeRestaurant) },
            ]
        );
    };
    const processPromotion = async (activeRestaurant: RestaurantProfile) => {
        setIsSubmitting(true);
        try {
            if (!media) throw new Error('Please upload image or video');

            // 1. Upload to Cloudinary
            const mediaUrl = await uploadToCloudinary(media.uri, media.type);
            if (!mediaUrl) throw new Error('Failed to upload media');

            // 2. Dates
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + (parseInt(weeks) * 7));

            // 3. Call RPC
            const { data, error } = await supabase.rpc('create_promotion', {
                p_vendor_id: activeRestaurant.id,
                p_vendor_type: 'restaurant',
                p_title: title,
                p_description: description,
                p_media_url: mediaUrl,
                p_media_type: media.type,
                p_start_date: startDate.toISOString(),
                p_end_date: endDate.toISOString(),
                p_city: activeRestaurant.city || null,
                p_budget: parseInt(weeks) * PROMO_WEEKLY_PRICE,
                p_destination_type: destinationType,
                p_destination_value: destinationType === 'item' || destinationType === 'custom_url'
                    ? destinationValue.trim()
                    : null,
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            Alert.alert('Success', 'Promotion submitted for review!');
            setShowCreateModal(false);
            resetForm();
            fetchRestaurantAndPromos();
            refreshWallet();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setWeeks('1');
        setMedia(null);
        setDestinationType('profile');
        setDestinationValue('');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return '#4CAF50';
            case 'pending': return '#FF9800';
            case 'rejected': return '#F44336';
            case 'expired': return '#9E9E9E';
            case 'cancelled': return '#6B7280';
            default: return iconColor;
        }
    };

    const handleCancelPromotion = (promotionId: string) => {
        Alert.alert(
            'Cancel Promotion',
            'Are you sure you want to cancel this promotion? This action cannot be undone, and promotion fees are non-refundable.',
            [
                { text: 'Keep Running', style: 'cancel' },
                {
                    text: 'Cancel Promotion',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { data, error } = await supabase.rpc('cancel_promotion', {
                                p_promotion_id: promotionId,
                                p_reason: 'Cancelled by business owner',
                            });
                            if (error) throw error;
                            if (data && !data.success) throw new Error(data.message);

                            Alert.alert('Success', 'Promotion cancelled successfully. Promotion fees remain non-refundable.');
                            fetchRestaurantAndPromos();
                        } catch (cancelError: any) {
                            Alert.alert('Error', cancelError.message || 'Failed to cancel promotion.');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return <FoodLoader message="Loading promotions..." />;
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu}>
                    <Ionicons name="menu" size={32} color={iconColor} />
                </TouchableOpacity>
                <ThemedText type="title">Promotions</ThemedText>
                <TouchableOpacity
                    onPress={handleOpenCreateModal}
                    disabled={!restaurant?.id}
                    style={!restaurant?.id ? { opacity: 0.5 } : undefined}
                >
                    <Ionicons name="add-circle" size={32} color="#f27c22" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={promotions}
                keyExtractor={(item, index) => {
                    const rawId = typeof item?.id === 'string' ? item.id.trim() : '';
                    return rawId ? `promo-${rawId}-${index}` : `promo-missing-${index}`;
                }}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="megaphone-outline" size={80} color="#ccc" />
                        <ThemedText style={styles.placeholderText}>
                            Boost your visibility! Create your first promotion to appear on the homepage.
                        </ThemedText>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={handleOpenCreateModal}
                        >
                            <ThemedText style={styles.buttonText}>Create Promotion</ThemedText>
                        </TouchableOpacity>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={[styles.promoCard, { backgroundColor: inputBg }]}>
                        <Image source={{ uri: item.media_url }} style={styles.cardImage} />
                        <View style={styles.cardInfo}>
                            <View style={styles.cardHeader}>
                                <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                                    <ThemedText style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                                        {item.status.toUpperCase()}
                                    </ThemedText>
                                </View>
                            </View>
                            <ThemedText style={styles.cardDesc} numberOfLines={2}>{item.description}</ThemedText>
                            <View style={styles.cardMeta}>
                                <View style={styles.metaItem}>
                                    <Ionicons name="calendar-outline" size={14} color="#888" />
                                    <ThemedText style={styles.metaText}>
                                        {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                                    </ThemedText>
                                </View>
                                <ThemedText style={styles.cardBudget}>NGN {Number(item.budget).toLocaleString()}</ThemedText>
                            </View>
                            <ThemedText style={styles.destinationText}>{getDestinationLabel(item)}</ThemedText>
                            <View style={styles.metricsRow}>
                                <ThemedText style={styles.metricText}>Views: {Number(item.views_count || 0).toLocaleString()}</ThemedText>
                                <ThemedText style={styles.metricText}>Clicks: {Number(item.clicks_count || 0).toLocaleString()}</ThemedText>
                                <ThemedText style={styles.metricText}>Reach: {Number(item.reach_count || 0).toLocaleString()}</ThemedText>
                                <ThemedText style={styles.metricText}>CTR: {getCtr(item)}%</ThemedText>
                            </View>
                            {(item.status === 'active' || item.status === 'pending') && (
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => handleCancelPromotion(item.id)}
                                >
                                    <ThemedText style={styles.cancelButtonText}>Cancel Promotion</ThemedText>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}
            />

            {/* Create Modal */}
            <Modal visible={showCreateModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={styles.modalTitle}>New Promotion</ThemedText>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <Ionicons name="close" size={24} color={iconColor} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.formGroup}>
                                <ThemedText style={styles.label}>Campaign Title</ThemedText>
                                <TextInput
                                    style={[styles.input, { backgroundColor: inputBg, color: iconColor }]}
                                    placeholder="e.g. Weekend Double Burger Deal"
                                    placeholderTextColor="#888"
                                    value={title}
                                    onChangeText={setTitle}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <ThemedText style={styles.label}>Description</ThemedText>
                                <TextInput
                                    style={[styles.input, styles.textArea, { backgroundColor: inputBg, color: iconColor }]}
                                    placeholder="What's this ad about?"
                                    placeholderTextColor="#888"
                                    multiline
                                    numberOfLines={3}
                                    value={description}
                                    onChangeText={setDescription}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <ThemedText style={styles.label}>Duration (Weeks)</ThemedText>
                                <View style={styles.durationRow}>
                                    <TextInput
                                        style={[styles.input, { flex: 1, backgroundColor: inputBg, color: iconColor }]}
                                        keyboardType="numeric"
                                        value={weeks}
                                        onChangeText={setWeeks}
                                    />
                                    <View style={styles.priceTag}>
                                        <ThemedText style={styles.priceText}>
                                            NGN {(parseInt(weeks || '0') * PROMO_WEEKLY_PRICE).toLocaleString()}
                                        </ThemedText>
                                    </View>
                                </View>
                                <ThemedText style={styles.hint}>Price: NGN {PROMO_WEEKLY_PRICE.toLocaleString()} per week</ThemedText>
                            </View>
                            <View style={styles.formGroup}>
                                <ThemedText style={styles.label}>Ad Destination</ThemedText>
                                <View style={styles.destinationTypeRow}>
                                    <TouchableOpacity
                                        style={[styles.destinationChip, destinationType === 'profile' && styles.destinationChipActive]}
                                        onPress={() => {
                                            setDestinationType('profile');
                                            setDestinationValue('');
                                        }}
                                    >
                                        <ThemedText style={[styles.destinationChipText, destinationType === 'profile' && styles.destinationChipTextActive]}>
                                            Profile
                                        </ThemedText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.destinationChip, destinationType === 'items' && styles.destinationChipActive]}
                                        onPress={() => {
                                            setDestinationType('items');
                                            setDestinationValue('');
                                        }}
                                    >
                                        <ThemedText style={[styles.destinationChipText, destinationType === 'items' && styles.destinationChipTextActive]}>
                                            Products
                                        </ThemedText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.destinationChip, destinationType === 'item' && styles.destinationChipActive]}
                                        onPress={() => setDestinationType('item')}
                                    >
                                        <ThemedText style={[styles.destinationChipText, destinationType === 'item' && styles.destinationChipTextActive]}>
                                            Specific Item
                                        </ThemedText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.destinationChip, destinationType === 'custom_url' && styles.destinationChipActive]}
                                        onPress={() => setDestinationType('custom_url')}
                                    >
                                        <ThemedText style={[styles.destinationChipText, destinationType === 'custom_url' && styles.destinationChipTextActive]}>
                                            Custom URL
                                        </ThemedText>
                                    </TouchableOpacity>
                                </View>

                                {destinationType === 'item' && (
                                    <View style={[styles.destinationPicker, { backgroundColor: inputBg }]}>
                                        {loadingItemOptions ? (
                                            <ActivityIndicator size="small" color="#f27c22" />
                                        ) : itemOptions.length === 0 ? (
                                            <ThemedText style={styles.destinationHint}>No active items found. Add and activate menu items first.</ThemedText>
                                        ) : (
                                            <ScrollView nestedScrollEnabled style={styles.destinationList}>
                                                {itemOptions.map(option => (
                                                    <TouchableOpacity
                                                        key={option.id}
                                                        style={[
                                                            styles.destinationOption,
                                                            destinationValue === option.id && styles.destinationOptionActive,
                                                        ]}
                                                        onPress={() => setDestinationValue(option.id)}
                                                    >
                                                        <ThemedText
                                                            style={[
                                                                styles.destinationOptionText,
                                                                destinationValue === option.id && styles.destinationOptionTextActive,
                                                            ]}
                                                            numberOfLines={1}
                                                        >
                                                            {option.name}
                                                        </ThemedText>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        )}
                                    </View>
                                )}

                                {destinationType === 'custom_url' && (
                                    <TextInput
                                        style={[styles.input, { backgroundColor: inputBg, color: iconColor }]}
                                        placeholder="https://example.com or /restaurant-profile/id"
                                        placeholderTextColor="#888"
                                        value={destinationValue}
                                        onChangeText={setDestinationValue}
                                        autoCapitalize="none"
                                    />
                                )}

                                <ThemedText style={styles.hint}>
                                    Default destination is profile. "Products" opens your profile listing.
                                </ThemedText>
                            </View>

                            <View style={styles.formGroup}>
                                <ThemedText style={styles.label}>Banner Image / Video</ThemedText>
                                <TouchableOpacity
                                    style={[styles.mediaPicker, { backgroundColor: inputBg }]}
                                    onPress={handlePickMedia}
                                >
                                    {media ? (
                                        <View style={styles.mediaPreview}>
                                            <Image source={{ uri: media.uri }} style={styles.previewImage} />
                                            <View style={styles.mediaOverlay}>
                                                <Ionicons name="refresh" size={24} color="#fff" />
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={styles.pickerPlaceholder}>
                                            <Ionicons name="cloud-upload-outline" size={40} color="#888" />
                                            <ThemedText style={{ color: '#888' }}>Upload Image or Video (16:9)</ThemedText>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={[styles.submitButton, isSubmitting && styles.disabledButton]}
                                onPress={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <ThemedText style={styles.buttonText}>Pay & Submit for Review</ThemedText>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </ThemedView>
                </View>
            </Modal>
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
        paddingTop: 60,
        paddingBottom: 20,
    },
    listContent: {
        padding: 20,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
        gap: 20,
    },
    placeholderText: {
        fontSize: 16,
        opacity: 0.6,
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 24,
    },
    primaryButton: {
        backgroundColor: '#f27c22',
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 12,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    promoCard: {
        borderRadius: 16,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    cardImage: {
        width: '100%',
        height: 180,
    },
    cardInfo: {
        padding: 15,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardDesc: {
        fontSize: 14,
        color: '#888',
        marginBottom: 12,
    },
    cardMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        paddingTop: 10,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    metaText: {
        fontSize: 12,
        color: '#888',
    },
    cardBudget: {
        fontWeight: 'bold',
        color: '#f27c22',
    },
    destinationText: {
        fontSize: 12,
        color: '#666',
        marginTop: 8,
    },
    metricsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    metricText: {
        fontSize: 11,
        color: '#666',
        backgroundColor: 'rgba(0,0,0,0.04)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    cancelButton: {
        marginTop: 12,
        backgroundColor: '#FEE2E2',
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#B91C1C',
        fontWeight: '700',
        fontSize: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '92%',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    durationRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    priceTag: {
        backgroundColor: 'rgba(242, 124, 34, 0.1)',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(242, 124, 34, 0.2)',
    },
    priceText: {
        color: '#f27c22',
        fontWeight: 'bold',
        fontSize: 16,
    },
    hint: {
        fontSize: 12,
        color: '#888',
        marginTop: 5,
        marginLeft: 2,
    },
    destinationTypeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    destinationChip: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#d1d5db',
        backgroundColor: '#fff',
    },
    destinationChipActive: {
        borderColor: '#f27c22',
        backgroundColor: 'rgba(242, 124, 34, 0.1)',
    },
    destinationChipText: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '600',
    },
    destinationChipTextActive: {
        color: '#f27c22',
    },
    destinationPicker: {
        marginTop: 10,
        borderRadius: 12,
        padding: 10,
    },
    destinationList: {
        maxHeight: 130,
    },
    destinationHint: {
        fontSize: 12,
        color: '#6b7280',
    },
    destinationOption: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 6,
        backgroundColor: 'rgba(0,0,0,0.04)',
    },
    destinationOptionActive: {
        backgroundColor: 'rgba(242, 124, 34, 0.16)',
    },
    destinationOptionText: {
        fontSize: 13,
        color: '#374151',
    },
    destinationOptionTextActive: {
        color: '#f27c22',
        fontWeight: '700',
    },
    mediaPicker: {
        height: 180,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#eee',
        borderStyle: 'dashed',
        overflow: 'hidden',
    },
    pickerPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    mediaPreview: {
        flex: 1,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    mediaOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitButton: {
        backgroundColor: '#f27c22',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 30,
    },
    disabledButton: {
        opacity: 0.7,
    },
});






