import RiderLoader from '@/components/RiderLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { uploadToCloudinary } from '@/utils/cloudinary';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

const GOOGLE_API_KEY = 'AIzaSyB7Cbxbo4Rcj7fSwQHOdYWBLX9JpT85Qao';
const { width } = Dimensions.get('window');

type Category = 'intra' | 'inter';
type Prediction = { place_id: string; description: string };

const VEHICLE_OPTIONS = [
    { id: 'bicycle', label: 'Bicycle', icon: 'bicycle' as const },
    { id: 'bike', label: 'Motorbike', icon: 'speedometer' as const },
    { id: 'car', label: 'Car', icon: 'car-sport' as const },
    { id: 'van', label: 'Van', icon: 'bus' as const },
    { id: 'keke', label: 'Keke', icon: 'triangle' as const },
];

export default function SendPackageScreen() {
    const router = useRouter();
    const { riderId, riderName } = useLocalSearchParams<{ riderId: string; riderName: string }>();
    const { user } = useAuth();
    const mapRef = useRef<MapView>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Theme
    const textColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');
    const mutedText = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#121212' }, 'background');
    const cardBg = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'background');
    const inputBg = useThemeColor({ light: '#F8F9FC', dark: '#2A2A2A' }, 'background');
    const borderColor = useThemeColor({ light: '#E8E9ED', dark: '#333' }, 'background');
    const primary = '#F27C22';
    const success = '#22C55E';

    // State
    const [category, setCategory] = useState<Category>('intra');
    const [pickup, setPickup] = useState<{ lat: number; lng: number; address: string } | null>(null);
    const [dropoff, setDropoff] = useState<{ lat: number; lng: number; address: string } | null>(null);
    const [pickupText, setPickupText] = useState('');
    const [dropoffText, setDropoffText] = useState('');
    const [pickupSuggestions, setPickupSuggestions] = useState<Prediction[]>([]);
    const [dropoffSuggestions, setDropoffSuggestions] = useState<Prediction[]>([]);
    const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
    const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
    const [description, setDescription] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [recipientPhone, setRecipientPhone] = useState('');
    const [deliveryNotes, setDeliveryNotes] = useState('');

    // Price & Route
    const [distanceKm, setDistanceKm] = useState(0);
    const [durationMin, setDurationMin] = useState(0);
    const [estimatedPrice, setEstimatedPrice] = useState(0);
    const [offeredPrice, setOfferedPrice] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selectedVehicles, setSelectedVehicles] = useState<string[]>(['bike']);
    const [media, setMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
    const [showLowPriceModal, setShowLowPriceModal] = useState(false);
    const [feeConfig, setFeeConfig] = useState({
        item_intra_base_fee: 500, item_intra_per_km_rate: 100,
        item_inter_base_fee: 1500, item_inter_per_km_rate: 200,
        item_min_price: 500
    });

    // Map State
    const [region, setRegion] = useState({
        latitude: 6.5244,
        longitude: 3.3792,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    });

    // Minimum price is 50% of estimated or admin-configured floor
    const minPrice = Math.max(feeConfig.item_min_price, Math.round(estimatedPrice * 0.5));

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const loc = await Location.getCurrentPositionAsync({});
            setRegion({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            });
        })();
        // Fetch admin-configurable delivery fees
        (async () => {
            try {
                const { data } = await supabase
                    .from('delivery_config')
                    .select('item_intra_base_fee, item_intra_per_km_rate, item_inter_base_fee, item_inter_per_km_rate, item_min_price')
                    .single();
                if (data) setFeeConfig(data);
            } catch (err) {
                console.log('Fee config fetch failed, using defaults', err);
            }
        })();
    }, []);

    // Debounced fetch suggestions
    const fetchSuggestions = useCallback((text: string, isPickup: boolean) => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (text.length < 2) {
            if (isPickup) {
                setPickupSuggestions([]);
                setShowPickupSuggestions(false);
            } else {
                setDropoffSuggestions([]);
                setShowDropoffSuggestions(false);
            }
            return;
        }

        debounceRef.current = setTimeout(async () => {
            try {
                const response = await fetch(
                    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_API_KEY}&components=country:ng&location=${region.latitude},${region.longitude}&radius=50000`
                );
                const data = await response.json();

                if (data.predictions) {
                    const predictions = data.predictions.slice(0, 5).map((p: any) => ({
                        place_id: p.place_id,
                        description: p.description
                    }));
                    if (isPickup) {
                        setPickupSuggestions(predictions);
                        setShowPickupSuggestions(predictions.length > 0);
                    } else {
                        setDropoffSuggestions(predictions);
                        setShowDropoffSuggestions(predictions.length > 0);
                    }
                }
            } catch (error) {
                console.error('Autocomplete error:', error);
            }
        }, 300); // 300ms debounce
    }, [region]);

    // Select a suggestion
    const selectSuggestion = async (prediction: Prediction, isPickup: boolean) => {
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&key=${GOOGLE_API_KEY}&fields=geometry,formatted_address`
            );
            const data = await response.json();

            if (data.result) {
                const location = {
                    lat: data.result.geometry.location.lat,
                    lng: data.result.geometry.location.lng,
                    address: data.result.formatted_address || prediction.description
                };

                if (isPickup) {
                    setPickup(location);
                    setPickupText(prediction.description);
                    setShowPickupSuggestions(false);
                    setPickupSuggestions([]);
                } else {
                    setDropoff(location);
                    setDropoffText(prediction.description);
                    setShowDropoffSuggestions(false);
                    setDropoffSuggestions([]);
                }
            }
        } catch (error) {
            console.error('Place details error:', error);
        }
    };

    const handleUseCurrentLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Enable location access to use this feature.');
            return;
        }
        setLoading(true);
        try {
            const loc = await Location.getCurrentPositionAsync({});
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.coords.latitude},${loc.coords.longitude}&key=${GOOGLE_API_KEY}`
            );
            const data = await response.json();
            if (data.results[0]) {
                const address = data.results[0].formatted_address;
                setPickup({
                    lat: loc.coords.latitude,
                    lng: loc.coords.longitude,
                    address: address
                });
                setPickupText(address);
                setShowPickupSuggestions(false);
            }
        } catch (error) {
            Alert.alert('Error', 'Could not fetch your location.');
        } finally {
            setLoading(false);
        }
    };

    const onDirectionsReady = (result: any) => {
        const dist = result.distance;
        const dur = result.duration;
        setDistanceKm(dist);
        setDurationMin(dur);

        const base = category === 'intra' ? feeConfig.item_intra_base_fee : feeConfig.item_inter_base_fee;
        const rate = category === 'intra' ? feeConfig.item_intra_per_km_rate : feeConfig.item_inter_per_km_rate;
        const price = Math.round(base + (rate * dist));

        setEstimatedPrice(price);
        setOfferedPrice(price);

        mapRef.current?.fitToCoordinates(result.coordinates, {
            edgePadding: { top: 80, right: 50, bottom: 50, left: 50 },
        });
    };

    const handlePriceStep = (direction: 'up' | 'down') => {
        const step = 100;
        if (direction === 'up') {
            setOfferedPrice(p => p + step);
        } else {
            const newPrice = offeredPrice - step;
            if (newPrice < minPrice) {
                setShowLowPriceModal(true);
            } else {
                setOfferedPrice(newPrice);
            }
        }
    };

    const handleSliderChange = (value: number) => {
        const newPrice = Math.round(estimatedPrice * value);
        if (newPrice < minPrice) {
            setShowLowPriceModal(true);
            setOfferedPrice(minPrice);
        } else {
            setOfferedPrice(newPrice);
        }
    };

    const toggleVehicle = (id: string) => {
        setSelectedVehicles(prev => {
            if (prev.includes(id)) return prev.filter(v => v !== id);
            return [...prev, id];
        });
    };

    const pickMedia = async (type: 'image' | 'video') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: type === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            setMedia({ uri: result.assets[0].uri, type });
        }
    };

    const handleSubmit = async () => {
        if (!user) return;
        if (!pickup || !dropoff || !description) {
            Alert.alert('Missing Info', 'Please fill in pickup, dropoff, and item details.');
            return;
        }
        if (selectedVehicles.length === 0) {
            Alert.alert('Vehicle Required', 'Please select at least one preferred vehicle.');
            return;
        }
        if (offeredPrice < minPrice) {
            setShowLowPriceModal(true);
            return;
        }

        setLoading(true);
        try {
            let mediaUrl = null;
            if (media) {
                mediaUrl = await uploadToCloudinary(media.uri, media.type);
            }

            if (riderId) {
                // Direct Rider Request
                const { error } = await supabase.from('rider_requests').insert({
                    user_id: user.id,
                    rider_id: riderId,
                    pickup_location: pickup,
                    dropoff_location: dropoff,
                    status: 'pending',
                    offered_price: offeredPrice,
                    item_description: description,
                    item_image_url: mediaUrl
                });

                if (error) throw error;
                Alert.alert('Request Sent!', `Your request has been sent to ${riderName || 'the rider'}.`, [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                // ... Existing Delivery Request Logic ...
                const { error } = await supabase.from('delivery_requests').insert({
                    user_id: user.id,
                    pickup_address: pickup.address,
                    pickup_latitude: pickup.lat,
                    pickup_longitude: pickup.lng,
                    dropoff_address: dropoff.address,
                    dropoff_latitude: dropoff.lat,
                    dropoff_longitude: dropoff.lng,
                    item_description: description,
                    offered_price: offeredPrice,
                    status: 'pending',
                    vehicle_types: selectedVehicles,
                    item_image_url: mediaUrl,
                    media_type: media?.type,
                    recipient_name: recipientName,
                    recipient_phone: recipientPhone,
                    delivery_notes: deliveryNotes
                });

                if (error) throw error;
                Alert.alert('🎉 Success!', 'Your delivery request has been created. Riders will bid shortly!', [
                    { text: 'View Requests', onPress: () => router.back() }
                ]);
            }
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Low Price Warning Modal */}
            <Modal visible={showLowPriceModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: cardBg }]}>
                        <ThemedText style={styles.modalEmoji}>😢</ThemedText>
                        <ThemedText style={styles.modalTitle}>Price Too Low!</ThemedText>
                        <ThemedText style={[styles.modalText, { color: mutedText }]}>
                            Please reconsider! This price is not acceptable for a {distanceKm.toFixed(1)} km delivery.
                        </ThemedText>
                        <ThemedText style={[styles.modalMinPrice, { color: primary }]}>
                            Minimum: ₦{minPrice.toLocaleString()}
                        </ThemedText>
                        <TouchableOpacity
                            style={[styles.modalBtn, { backgroundColor: primary }]}
                            onPress={() => {
                                setOfferedPrice(minPrice);
                                setShowLowPriceModal(false);
                            }}
                        >
                            <ThemedText style={styles.modalBtnText}>Okay, I'll adjust</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Loading Overlay */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <View style={[styles.loadingCard, { backgroundColor: cardBg }]}>
                        <RiderLoader size={150} message="" fullScreen={false} />
                        <ThemedText style={styles.loadingText}>Processing your request...</ThemedText>
                    </View>
                </View>
            )}

            {/* Premium Header */}
            <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: inputBg }]}>
                    <Ionicons name="arrow-back" size={22} color={textColor} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <ThemedText style={styles.headerTitle}>{riderId ? `Request ${riderName || 'Rider'}` : 'Send Package'}</ThemedText>
                    <ThemedText style={[styles.headerSubtitle, { color: mutedText }]}>Fast & Reliable Delivery</ThemedText>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={false}
                >

                    {/* Map Section */}
                    <View style={styles.mapWrapper}>
                        <MapView
                            ref={mapRef}
                            style={styles.map}
                            provider={PROVIDER_GOOGLE}
                            initialRegion={region}
                        >
                            {pickup && (
                                <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} title="Pickup">
                                    <View style={[styles.customMarker, { backgroundColor: primary }]}>
                                        <Ionicons name="location" size={16} color="#fff" />
                                    </View>
                                </Marker>
                            )}
                            {dropoff && (
                                <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} title="Dropoff">
                                    <View style={[styles.customMarker, { backgroundColor: success }]}>
                                        <Ionicons name="flag" size={16} color="#fff" />
                                    </View>
                                </Marker>
                            )}
                            {pickup && dropoff && (
                                <MapViewDirections
                                    origin={{ latitude: pickup.lat, longitude: pickup.lng }}
                                    destination={{ latitude: dropoff.lat, longitude: dropoff.lng }}
                                    apikey={GOOGLE_API_KEY}
                                    strokeWidth={4}
                                    strokeColor={primary}
                                    onReady={onDirectionsReady}
                                />
                            )}
                        </MapView>

                        {/* Route Info Overlay */}
                        {distanceKm > 0 && (
                            <View style={[styles.routeInfoBadge, { backgroundColor: cardBg }]}>
                                <View style={styles.routeInfoItem}>
                                    <Ionicons name="navigate-outline" size={16} color={primary} />
                                    <ThemedText style={styles.routeInfoText}>{distanceKm.toFixed(1)} km</ThemedText>
                                </View>
                                <View style={[styles.routeInfoDivider, { backgroundColor: borderColor }]} />
                                <View style={styles.routeInfoItem}>
                                    <Ionicons name="time-outline" size={16} color={primary} />
                                    <ThemedText style={styles.routeInfoText}>{Math.round(durationMin)} min</ThemedText>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Delivery Type Toggle */}
                    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
                        <View style={[styles.toggleContainer, { backgroundColor: inputBg }]}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, category === 'intra' && styles.toggleBtnActive]}
                                onPress={() => setCategory('intra')}
                            >
                                <Ionicons name="location" size={18} color={category === 'intra' ? '#fff' : mutedText} />
                                <ThemedText style={[styles.toggleText, category === 'intra' && styles.toggleTextActive]}>Within City</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleBtn, category === 'inter' && styles.toggleBtnActive]}
                                onPress={() => setCategory('inter')}
                            >
                                <Ionicons name="airplane" size={18} color={category === 'inter' ? '#fff' : mutedText} />
                                <ThemedText style={[styles.toggleText, category === 'inter' && styles.toggleTextActive]}>City to City</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Locations Section */}
                    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="swap-vertical" size={18} color={primary} style={{ marginRight: 8 }} />
                            <ThemedText style={styles.sectionTitle}>Pickup & Dropoff</ThemedText>
                        </View>

                        {/* Pickup Input */}
                        <View style={styles.autocompleteContainer}>
                            <View style={styles.locationRow}>
                                <View style={[styles.locationDot, { backgroundColor: primary }]} />
                                <View style={styles.locationInputWrapper}>
                                    <TextInput
                                        style={[styles.locationInput, { backgroundColor: inputBg, color: textColor, borderColor: pickup ? success : borderColor }]}
                                        placeholder="Enter pickup location"
                                        placeholderTextColor={mutedText}
                                        value={pickupText}
                                        onChangeText={(text) => {
                                            setPickupText(text);
                                            fetchSuggestions(text, true);
                                        }}
                                    />
                                    {pickup && (
                                        <View style={styles.locationSelectedBadge}>
                                            <Ionicons name="checkmark-circle" size={16} color={success} />
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity style={[styles.locateBtn, { backgroundColor: inputBg }]} onPress={handleUseCurrentLocation}>
                                    <Ionicons name="locate" size={22} color={primary} />
                                </TouchableOpacity>
                            </View>

                            {showPickupSuggestions && pickupSuggestions.length > 0 && (
                                <View style={[styles.suggestionsContainer, { backgroundColor: cardBg, borderColor }]}>
                                    {pickupSuggestions.map((suggestion, index) => (
                                        <TouchableOpacity
                                            key={suggestion.place_id}
                                            style={[styles.suggestionItem, index < pickupSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor }]}
                                            onPress={() => selectSuggestion(suggestion, true)}
                                        >
                                            <Ionicons name="location-outline" size={18} color={mutedText} />
                                            <ThemedText style={styles.suggestionText} numberOfLines={2}>{suggestion.description}</ThemedText>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View style={[styles.locationConnector, { borderLeftColor: borderColor }]} />

                        {/* Dropoff Input */}
                        <View style={styles.autocompleteContainer}>
                            <View style={styles.locationRow}>
                                <View style={[styles.locationDot, { backgroundColor: success }]} />
                                <View style={styles.locationInputWrapper}>
                                    <TextInput
                                        style={[styles.locationInput, { backgroundColor: inputBg, color: textColor, borderColor: dropoff ? success : borderColor }]}
                                        placeholder="Enter dropoff location"
                                        placeholderTextColor={mutedText}
                                        value={dropoffText}
                                        onChangeText={(text) => {
                                            setDropoffText(text);
                                            fetchSuggestions(text, false);
                                        }}
                                    />
                                    {dropoff && (
                                        <View style={styles.locationSelectedBadge}>
                                            <Ionicons name="checkmark-circle" size={16} color={success} />
                                        </View>
                                    )}
                                </View>
                            </View>

                            {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
                                <View style={[styles.suggestionsContainer, { backgroundColor: cardBg, borderColor }]}>
                                    {dropoffSuggestions.map((suggestion, index) => (
                                        <TouchableOpacity
                                            key={suggestion.place_id}
                                            style={[styles.suggestionItem, index < dropoffSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor }]}
                                            onPress={() => selectSuggestion(suggestion, false)}
                                        >
                                            <Ionicons name="location-outline" size={18} color={mutedText} />
                                            <ThemedText style={styles.suggestionText} numberOfLines={2}>{suggestion.description}</ThemedText>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Package Details */}
                    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="cube" size={18} color={primary} style={{ marginRight: 8 }} />
                            <ThemedText style={styles.sectionTitle}>Package Details</ThemedText>
                        </View>

                        <TextInput
                            style={[styles.textInput, { backgroundColor: inputBg, color: textColor, borderColor }]}
                            placeholder="What are you sending? (e.g., Documents, Electronics)"
                            placeholderTextColor={mutedText}
                            value={description}
                            onChangeText={setDescription}
                        />

                        {/* Vehicle Selection */}
                        <ThemedText style={[styles.subLabel, { color: mutedText }]}>Preferred Vehicle(s)</ThemedText>
                        <View style={styles.vehicleGrid}>
                            {VEHICLE_OPTIONS.map((v) => {
                                const isSelected = selectedVehicles.includes(v.id);
                                return (
                                    <TouchableOpacity
                                        key={v.id}
                                        style={[styles.vehicleCard, { backgroundColor: inputBg, borderColor: isSelected ? primary : borderColor }, isSelected && styles.vehicleCardSelected]}
                                        onPress={() => toggleVehicle(v.id)}
                                    >
                                        <View style={[styles.vehicleIconBg, { backgroundColor: isSelected ? primary : borderColor }]}>
                                            <Ionicons name={v.icon} size={20} color={isSelected ? '#fff' : mutedText} />
                                        </View>
                                        <ThemedText style={[styles.vehicleLabel, isSelected && { color: primary, fontWeight: '700' }]}>{v.label}</ThemedText>
                                        {isSelected && (
                                            <View style={styles.vehicleCheck}>
                                                <Ionicons name="checkmark-circle" size={18} color={primary} />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Media Upload */}
                        <ThemedText style={[styles.subLabel, { color: mutedText }]}>Package Photo (Optional)</ThemedText>
                        <View style={styles.mediaRow}>
                            <TouchableOpacity style={[styles.mediaBtnLarge, { backgroundColor: inputBg, borderColor }]} onPress={() => pickMedia('image')}>
                                <Ionicons name="camera-outline" size={28} color={mutedText} />
                                <ThemedText style={[styles.mediaBtnText, { color: mutedText }]}>Add Photo</ThemedText>
                            </TouchableOpacity>
                            {media && (
                                <View style={styles.mediaPreviewContainer}>
                                    {media.type === 'image' ? (
                                        <Image source={{ uri: media.uri }} style={styles.mediaPreviewImage} contentFit="cover" />
                                    ) : (
                                        <View style={[styles.mediaPreviewImage, { backgroundColor: inputBg, justifyContent: 'center', alignItems: 'center' }]}>
                                            <Ionicons name="videocam" size={32} color={primary} />
                                        </View>
                                    )}
                                    <TouchableOpacity style={styles.mediaRemoveBtn} onPress={() => setMedia(null)}>
                                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Recipient Details */}
                    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="person" size={18} color={primary} style={{ marginRight: 8 }} />
                            <ThemedText style={styles.sectionTitle}>Recipient Details</ThemedText>
                        </View>

                        <View style={styles.inputRow}>
                            <View style={[styles.inputIconBox, { backgroundColor: inputBg }]}>
                                <Ionicons name="person-outline" size={20} color={mutedText} />
                            </View>
                            <TextInput
                                style={[styles.textInputWithIcon, { backgroundColor: inputBg, color: textColor }]}
                                placeholder="Recipient Name"
                                placeholderTextColor={mutedText}
                                value={recipientName}
                                onChangeText={setRecipientName}
                            />
                        </View>
                        <View style={styles.inputRow}>
                            <View style={[styles.inputIconBox, { backgroundColor: inputBg }]}>
                                <Ionicons name="call-outline" size={20} color={mutedText} />
                            </View>
                            <TextInput
                                style={[styles.textInputWithIcon, { backgroundColor: inputBg, color: textColor }]}
                                placeholder="Recipient Phone"
                                placeholderTextColor={mutedText}
                                value={recipientPhone}
                                onChangeText={setRecipientPhone}
                                keyboardType="phone-pad"
                            />
                        </View>
                        <TextInput
                            style={[styles.textAreaInput, { backgroundColor: inputBg, color: textColor, borderColor }]}
                            placeholder="Delivery notes (optional)"
                            placeholderTextColor={mutedText}
                            value={deliveryNotes}
                            onChangeText={setDeliveryNotes}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* Pricing Section */}
                    {estimatedPrice > 0 && (
                        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="pricetag" size={18} color={primary} style={{ marginRight: 8 }} />
                                <ThemedText style={styles.sectionTitle}>Set Your Price</ThemedText>
                            </View>

                            <View style={styles.priceDisplayCard}>
                                <ThemedText style={[styles.priceLabel, { color: mutedText }]}>Your Offer</ThemedText>
                                <View style={styles.priceRow}>
                                    <TouchableOpacity onPress={() => handlePriceStep('down')} style={[styles.priceStepBtn, { backgroundColor: inputBg }]}>
                                        <Ionicons name="remove" size={24} color={textColor} />
                                    </TouchableOpacity>
                                    <View style={styles.priceValueContainer}>
                                        <ThemedText style={[styles.priceValue, { color: primary }]}>₦{offeredPrice.toLocaleString()}</ThemedText>
                                    </View>
                                    <TouchableOpacity onPress={() => handlePriceStep('up')} style={[styles.priceStepBtn, { backgroundColor: inputBg }]}>
                                        <Ionicons name="add" size={24} color={textColor} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.sliderContainer}>
                                <ThemedText style={[styles.sliderLabel, { color: mutedText }]}>Drag to adjust</ThemedText>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0.5}
                                    maximumValue={2.0}
                                    step={0.05}
                                    value={estimatedPrice > 0 ? offeredPrice / estimatedPrice : 1}
                                    onSlidingComplete={handleSliderChange}
                                    minimumTrackTintColor={primary}
                                    maximumTrackTintColor={borderColor}
                                    thumbTintColor={primary}
                                />
                                <View style={styles.sliderLabels}>
                                    <ThemedText style={[styles.sliderEndLabel, { color: mutedText }]}>₦{minPrice.toLocaleString()}</ThemedText>
                                    <ThemedText style={[styles.sliderEndLabel, { color: mutedText }]}>₦{Math.round(estimatedPrice * 2).toLocaleString()}</ThemedText>
                                </View>
                            </View>

                            <View style={styles.priceHintRow}>
                                <ThemedText style={[styles.priceHint, { color: mutedText }]}>Suggested: ₦{estimatedPrice.toLocaleString()}</ThemedText>
                                <ThemedText style={[styles.priceHint, { color: mutedText }]}>{distanceKm.toFixed(1)} km • {Math.round(durationMin)} min</ThemedText>
                            </View>
                        </View>
                    )}

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitBtn, { opacity: loading ? 0.7 : 1 }]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 10 }} />
                        <ThemedText style={styles.submitText}>{riderId ? 'Send Direct Request' : 'Request Delivery'}</ThemedText>
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
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
    scrollContent: { padding: 16, paddingBottom: 120 },

    // Map
    mapWrapper: { height: 220, borderRadius: 20, overflow: 'hidden', marginBottom: 16, position: 'relative' },
    map: { flex: 1 },
    customMarker: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
    routeInfoBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 4 } }),
    },
    routeInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    routeInfoText: { fontSize: 13, fontWeight: '600' },
    routeInfoDivider: { width: 1, height: 16, marginHorizontal: 12 },

    // Section Card
    sectionCard: {
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 }, android: { elevation: 2 } }),
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700' },

    // Toggle
    toggleContainer: { flexDirection: 'row', borderRadius: 16, padding: 4 },
    toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 8 },
    toggleBtnActive: { backgroundColor: '#F27C22' },
    toggleText: { fontWeight: '600', fontSize: 14 },
    toggleTextActive: { color: '#fff' },

    // Location Autocomplete
    autocompleteContainer: { marginBottom: 8 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    locationDot: { width: 12, height: 12, borderRadius: 6 },
    locationInputWrapper: { flex: 1, position: 'relative' },
    locationInput: { height: 48, borderRadius: 12, paddingHorizontal: 16, paddingRight: 40, fontSize: 15, borderWidth: 1.5 },
    locationSelectedBadge: { position: 'absolute', right: 12, top: 16 },
    locationConnector: { height: 20, borderLeftWidth: 2, borderStyle: 'dashed', marginLeft: 5 },
    locateBtn: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    suggestionsContainer: {
        marginTop: 4,
        marginLeft: 24,
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 4 } }),
    },
    suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    suggestionText: { flex: 1, fontSize: 13 },

    // Inputs
    textInput: { height: 52, borderRadius: 14, paddingHorizontal: 16, fontSize: 15, marginBottom: 16, borderWidth: 1 },
    textAreaInput: { height: 80, borderRadius: 14, paddingHorizontal: 16, paddingTop: 14, fontSize: 15, textAlignVertical: 'top', borderWidth: 1 },
    inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
    inputIconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    textInputWithIcon: { flex: 1, height: 48, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
    subLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 8 },

    // Vehicles
    vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    vehicleCard: { width: (width - 32 - 36 - 30) / 3, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, position: 'relative' },
    vehicleCardSelected: { borderWidth: 2 },
    vehicleIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    vehicleLabel: { fontSize: 12, fontWeight: '500' },
    vehicleCheck: { position: 'absolute', top: -6, right: -6 },

    // Media
    mediaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    mediaBtnLarge: { width: 100, height: 100, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderStyle: 'dashed' },
    mediaBtnText: { fontSize: 11, marginTop: 6, fontWeight: '500' },
    mediaPreviewContainer: { width: 100, height: 100, borderRadius: 16, overflow: 'hidden', position: 'relative' },
    mediaPreviewImage: { width: '100%', height: '100%', borderRadius: 16 },
    mediaRemoveBtn: { position: 'absolute', top: -4, right: -4 },

    // Pricing
    priceDisplayCard: { alignItems: 'center', paddingVertical: 10 },
    priceLabel: { fontSize: 13, fontWeight: '500', marginBottom: 12 },
    priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
    priceStepBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    priceValueContainer: { minWidth: 150, alignItems: 'center', paddingVertical: 8 },
    priceValue: { fontSize: 32, fontWeight: '800', lineHeight: 42 },
    sliderContainer: { marginTop: 16 },
    sliderLabel: { fontSize: 12, textAlign: 'center', marginBottom: 8 },
    slider: { width: '100%', height: 50 },
    sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    sliderEndLabel: { fontSize: 11 },
    priceHintRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    priceHint: { fontSize: 12 },

    // Submit
    submitBtn: {
        flexDirection: 'row',
        backgroundColor: '#F27C22',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        ...Platform.select({ ios: { shadowColor: '#F27C22', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }, android: { elevation: 6 } }),
    },
    submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },

    // Loading
    loadingOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    loadingCard: { width: 280, padding: 30, borderRadius: 24, alignItems: 'center' },
    loadingText: { marginTop: 10, fontSize: 15, fontWeight: '500' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 320, borderRadius: 24, paddingHorizontal: 30, paddingTop: 40, paddingBottom: 30, alignItems: 'center' },
    modalEmoji: { fontSize: 60, marginBottom: 16, lineHeight: 70 },
    modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
    modalText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
    modalMinPrice: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
    modalBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
    modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
