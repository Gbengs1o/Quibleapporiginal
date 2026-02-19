import FoodLoader from '@/components/FoodLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';


interface RestaurantData {
    id: string;
    owner_id: string;
    name: string;
    address: string;
    phone_number: string;
    store_category: string; // Changed from cuisine_type
    short_description: string | null;
    detailed_description: string | null;
    logo_url: string | null;
    cover_photo_url: string | null; // Changed from restaurant_picture_url to match stores schema if we want, or keep consistent. 
    // Wait, let's check schema. I created `cover_photo_url` in stores table.
    business_registration_number: string | null;
    created_at: string;
}

export default function SettingsScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { openMenu } = useRestaurantMenu();
    const { user } = useAuth();
    const iconColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [store, setStore] = useState<RestaurantData | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [category, setCategory] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [detailedDescription, setDetailedDescription] = useState('');

    // Image state
    const [logoImage, setLogoImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [coverImage, setCoverImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

    // Location state
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [showMap, setShowMap] = useState(false);

    useEffect(() => {
        if (user?.id) {
            fetchStoreData();
        }
    }, [user?.id]);

    const fetchStoreData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('stores')
                .select('*')
                .eq('owner_id', user?.id)
                .single();

            if (error) {
                console.error('Error fetching store:', error);
                Alert.alert('Error', 'Failed to load store data');
                return;
            }

            if (data) {
                setStore(data);
                // Populate form fields
                setName(data.name);
                setAddress(data.address);
                setPhoneNumber(data.phone_number);
                setCategory(data.category); // Changed
                setShortDescription(data.short_description || '');
                setDetailedDescription(data.detailed_description || '');

                if (data.latitude && data.longitude) {
                    setLocation({
                        latitude: data.latitude,
                        longitude: data.longitude,
                    });
                }
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async (type: 'logo' | 'cover') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: type === 'logo' ? [1, 1] : [16, 9],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            if (type === 'logo') {
                setLogoImage(result.assets[0]);
            } else {
                setCoverImage(result.assets[0]);
            }
        }
    };

    const uploadImage = async (image: ImagePicker.ImagePickerAsset, bucket: string, path: string) => {
        if (!image.base64) throw new Error('No base64 data');

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, decode(image.base64), {
                contentType: image.mimeType || 'image/jpeg',
                upsert: true,
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);

        return publicUrl;
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    const handleLocationSelect = async (event: any) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;

        // Get current location if we don't have it
        let currentLoc = userLocation;
        if (!currentLoc) {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location permission is required to verify your location');
                return;
            }
            const location = await Location.getCurrentPositionAsync({});
            currentLoc = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            };
            setUserLocation(currentLoc);
        }

        const distance = calculateDistance(
            currentLoc.latitude,
            currentLoc.longitude,
            latitude,
            longitude
        );

        if (distance > 200) {
            Alert.alert(
                'Location too far',
                `You can only select a location within 200 meters of your current position. Selected location is ${Math.round(distance)}m away.`
            );
            return;
        }

        setLocation({ latitude, longitude });
    };

    const getCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location permission is required');
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            };
            setUserLocation(coords);

            // If no location set yet, set it to current
            if (!location) {
                setLocation(coords);
            }

            setShowMap(true);
        } catch (err) {
            console.error('Error getting location:', err);
            Alert.alert('Error', 'Failed to get current location');
        }
    };

    const handleSave = async () => {
        if (!store) return;

        try {
            setSaving(true);

            let logoUrl = store.logo_url;
            let coverUrl = store.cover_photo_url;

            // Upload Logo
            if (logoImage) {
                const path = `store_${store.id}/logo_${Date.now()}.jpg`;
                logoUrl = await uploadImage(logoImage, 'restaurant-documents', path); // Reusing bucket for now
            }

            // Upload Cover
            if (coverImage) {
                const path = `store_${store.id}/cover_${Date.now()}.jpg`;
                coverUrl = await uploadImage(coverImage, 'restaurant-documents', path);
            }

            const updates: any = {
                name,
                address,
                phone: phoneNumber,
                phone_number: phoneNumber,
                category: category,
                short_description: shortDescription || null,
                detailed_description: detailedDescription || null,
                logo_url: logoUrl,
                cover_photo_url: coverUrl,
            };

            if (location) {
                updates.latitude = location.latitude;
                updates.longitude = location.longitude;
                updates.location = `POINT(${location.longitude} ${location.latitude})`;
            }

            const { error } = await supabase
                .from('stores')
                .update(updates)
                .eq('id', store.id);

            if (error) {
                console.error('Error updating store:', error);
                Alert.alert('Error', 'Failed to save changes');
                return;
            }

            Alert.alert('Success', 'Store profile updated successfully');
            fetchStoreData(); // Refresh data

            // Reset image state
            setLogoImage(null);
            setCoverImage(null);
        } catch (err) {
            console.error('Unexpected error:', err);
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <FoodLoader message="Loading restaurant data..." />;
    }

    if (!store) {
        return (
            <ThemedView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={openMenu}>
                        <Ionicons name="menu" size={24} color={iconColor} />
                    </TouchableOpacity>
                    <ThemedText type="title">Profile & Settings</ThemedText>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ThemedText style={styles.errorText}>No store found</ThemedText>
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu}>
                    <Ionicons name="menu" size={24} color={iconColor} />
                </TouchableOpacity>
                <ThemedText type="title">Profile & Settings</ThemedText>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Restaurant Images Section */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Store Images</ThemedText>
                    <View style={styles.imagesContainer}>
                        <View style={styles.imageBox}>
                            <ThemedText style={styles.imageLabel}>Logo</ThemedText>
                            <TouchableOpacity onPress={() => pickImage('logo')}>
                                {logoImage ? (
                                    <Image source={{ uri: logoImage.uri }} style={styles.logoImage} />
                                ) : store.logo_url ? (
                                    <Image source={{ uri: store.logo_url }} style={styles.logoImage} />
                                ) : (
                                    <View style={styles.placeholderImage}>
                                        <Ionicons name="image-outline" size={40} color="#ccc" />
                                    </View>
                                )}
                                <View style={styles.editOverlay}>
                                    <Ionicons name="camera" size={16} color="#fff" />
                                </View>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.imageBox}>
                            <ThemedText style={styles.imageLabel}>Cover Photo</ThemedText>
                            <TouchableOpacity onPress={() => pickImage('cover')}>
                                {coverImage ? (
                                    <Image source={{ uri: coverImage.uri }} style={styles.restaurantImage} />
                                ) : store.cover_photo_url ? (
                                    <Image source={{ uri: store.cover_photo_url }} style={styles.restaurantImage} />
                                ) : (
                                    <View style={styles.placeholderImage}>
                                        <Ionicons name="image-outline" size={40} color="#ccc" />
                                    </View>
                                )}
                                <View style={styles.editOverlay}>
                                    <Ionicons name="camera" size={16} color="#fff" />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <ThemedText style={styles.helperText}>
                        Tap on an image to update it.
                    </ThemedText>
                </View>

                {/* Location Section */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Location</ThemedText>
                    <ThemedText style={styles.helperText}>
                        Tap the map or drag the marker to update your store's location.
                        You must be within 200m of your current physical location.
                    </ThemedText>

                    <View style={{ height: 10 }} />

                    <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
                        <Ionicons name="locate" size={20} color="#f27c22" />
                        <ThemedText style={styles.locationButtonText}>Use Current Location</ThemedText>
                    </TouchableOpacity>

                    {(showMap || location) && location && (
                        <View style={styles.mapContainer}>
                            <MapView
                                provider={PROVIDER_GOOGLE}
                                style={styles.map}
                                region={{
                                    latitude: location.latitude,
                                    longitude: location.longitude,
                                    latitudeDelta: 0.005,
                                    longitudeDelta: 0.005,
                                }}
                                onPress={handleLocationSelect}
                            >
                                <Marker
                                    coordinate={location}
                                    draggable
                                    onDragEnd={handleLocationSelect}
                                />
                            </MapView>
                        </View>
                    )}
                </View>

                {/* Finance Section */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Finance</ThemedText>
                    <TouchableOpacity
                        style={styles.walletButton}
                        onPress={() => router.push('/store/wallet')}
                    >
                        <View style={styles.walletIconContainer}>
                            <Ionicons name="wallet-outline" size={24} color="#fff" />
                        </View>
                        <View style={styles.walletTextContainer}>
                            <ThemedText style={styles.walletTitle}>Store Wallet</ThemedText>
                            <ThemedText style={styles.walletSubtitle}>Manage funds, transfers, and payouts</ThemedText>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={iconColor} />
                    </TouchableOpacity>
                </View>

                {/* Feedback Section */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Support</ThemedText>
                    <TouchableOpacity
                        style={styles.walletButton}
                        onPress={() => router.push('/profile/feedback')}
                    >
                        <View style={[styles.walletIconContainer, { backgroundColor: '#1F2050' }]}>
                            <Ionicons name="chatbox-ellipses-outline" size={24} color="#fff" />
                        </View>
                        <View style={styles.walletTextContainer}>
                            <ThemedText style={styles.walletTitle}>Help & Feedback</ThemedText>
                            <ThemedText style={styles.walletSubtitle}>Report bugs or suggest improvements</ThemedText>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={iconColor} />
                    </TouchableOpacity>
                </View>

                {/* Basic Information Section */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Basic Information</ThemedText>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Store Name *</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter store name"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Phone Number *</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            placeholder="Enter phone number"
                            placeholderTextColor="#999"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Category *</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={category}
                            onChangeText={setCategory}
                            placeholder="e.g., Grocery, Fashion, Electronics"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Address *</ThemedText>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Enter full address"
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={3}
                        />
                    </View>
                </View>

                {/* Description Section */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Description</ThemedText>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Short Description</ThemedText>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={shortDescription}
                            onChangeText={setShortDescription}
                            placeholder="Brief description (1-2 sentences)"
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={2}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Detailed Description</ThemedText>
                        <TextInput
                            style={[styles.input, styles.textArea, styles.largeTextArea]}
                            value={detailedDescription}
                            onChangeText={setDetailedDescription}
                            placeholder="Detailed description about your store"
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={5}
                        />
                    </View>
                </View>

                {/* Non-Editable Information Section */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Business Information (Read-Only)</ThemedText>
                    <ThemedText style={styles.helperText}>
                        These fields cannot be edited. Contact support if changes are needed.
                    </ThemedText>

                    <View style={styles.infoRow}>
                        <ThemedText style={styles.infoLabel}>Business Registration:</ThemedText>
                        <ThemedText style={styles.infoValue}>
                            {store.business_registration_number || 'Not provided'}
                        </ThemedText>
                    </View>

                    <View style={styles.infoRow}>
                        <ThemedText style={styles.infoLabel}>Store ID:</ThemedText>
                        <ThemedText style={styles.infoValue}>{store.id}</ThemedText>
                    </View>

                    <View style={styles.infoRow}>
                        <ThemedText style={styles.infoLabel}>Created:</ThemedText>
                        <ThemedText style={styles.infoValue}>
                            {new Date(store.created_at).toLocaleDateString()}
                        </ThemedText>
                    </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="save-outline" size={20} color="#fff" />
                            <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
                        </>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
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
        padding: 20,
        paddingTop: 50,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        opacity: 0.7,
    },
    errorText: {
        fontSize: 16,
        color: '#FF3B30',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    imagesContainer: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 10,
    },
    imageBox: {
        flex: 1,
    },
    imageLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    logoImage: {
        width: '100%',
        height: 120,
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
    },
    restaurantImage: {
        width: '100%',
        height: 120,
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
    },
    placeholderImage: {
        width: '100%',
        height: 120,
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    helperText: {
        fontSize: 12,
        opacity: 0.6,
        fontStyle: 'italic',
        marginTop: 5,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    largeTextArea: {
        minHeight: 120,
    },
    infoRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    infoLabel: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    infoValue: {
        fontSize: 14,
        flex: 2,
        opacity: 0.7,
    },
    saveButton: {
        backgroundColor: '#f27c22',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 10,
        gap: 8,
        marginTop: 10,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    editOverlay: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 6,
        borderRadius: 20,
    },
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 15,
        padding: 10,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#f27c22',
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    locationButtonText: {
        color: '#f27c22',
        fontWeight: '600',
    },
    mapContainer: {
        height: 300,
        borderRadius: 10,
        overflow: 'hidden',
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    walletButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(242, 124, 34, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(242, 124, 34, 0.2)',
    },
    walletIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f27c22',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    walletTextContainer: {
        flex: 1,
    },
    walletTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    walletSubtitle: {
        fontSize: 13,
        opacity: 0.7,
    },
});
