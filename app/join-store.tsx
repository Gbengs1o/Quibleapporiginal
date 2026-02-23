import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => {
    const activeColor = useThemeColor({ light: '#1f2050', dark: '#4a4b8a' }, 'tint');
    const inactiveColor = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'icon');

    return (
        <View style={styles.stepIndicatorContainer}>
            {Array.from({ length: totalSteps }).map((_, index) => (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                        style={[
                            styles.stepDot,
                            { backgroundColor: index + 1 <= currentStep ? activeColor : inactiveColor },
                        ]}
                    />
                    {index < totalSteps - 1 && (
                        <View
                            style={[
                                styles.stepLine,
                                { backgroundColor: index + 1 < currentStep ? activeColor : inactiveColor },
                            ]}
                        />
                    )}
                </View>
            ))}
        </View>
    );
};

const InputField = ({ label, value, onChangeText, placeholder, multiline = false, editable = true, keyboardType = 'default', maxLength }: any) => {
    const inputBg = useThemeColor({ light: '#f3f3f3', dark: '#2c2c2e' }, 'background');
    const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const placeholderColor = useThemeColor({ light: '#888', dark: '#aaa' }, 'text');

    return (
        <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>{label}</ThemedText>
            <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: textColor, height: multiline ? 100 : 50 }]}
                placeholder={placeholder}
                placeholderTextColor={placeholderColor}
                value={value}
                onChangeText={onChangeText}
                multiline={multiline}
                editable={editable}
                keyboardType={keyboardType}
                maxLength={maxLength}
            />
        </View>
    );
};

const Page1 = ({ next, formData, setFormData }: any) => {
    const [loadingAddress, setLoadingAddress] = useState(false);
    const buttonBg = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'background');
    const buttonText = useThemeColor({ light: '#333', dark: '#fff' }, 'text');

    const getAddressFromLocation = async () => {
        setLoadingAddress(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Permission to access location was denied');
                setLoadingAddress(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            let addressResponse = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            if (addressResponse.length > 0) {
                const addr = addressResponse[0];
                const fullAddress = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`;
                setFormData({ ...formData, address: fullAddress.replace(/^ , /, '').replace(/, ,/g, ',') });
            }
        } catch (error) {
            Alert.alert('Error', 'Could not fetch address');
        } finally {
            setLoadingAddress(false);
        }
    };

    return (
        <View>
            <ThemedText style={styles.sectionTitle}>Basic Information</ThemedText>
            <InputField
                label="Store Name"
                placeholder="Enter store name"
                value={formData.storeName}
                onChangeText={(text: string) => setFormData({ ...formData, storeName: text })}
            />
            <InputField
                label="Owner/Manager Name"
                value={formData.ownerName}
                editable={false}
            />
            <InputField
                label="Address"
                placeholder="Enter store address"
                value={formData.address}
                onChangeText={(text: string) => setFormData({ ...formData, address: text })}
            />
            <TouchableOpacity
                style={[styles.smallButton, { backgroundColor: buttonBg }]}
                onPress={getAddressFromLocation}
                disabled={loadingAddress}
            >
                <ThemedText style={[styles.smallButtonText, { color: buttonText }]}>
                    {loadingAddress ? 'Fetching...' : 'Get area address from location'}
                </ThemedText>
            </TouchableOpacity>

            <InputField
                label="Phone Number"
                placeholder="Enter phone number"
                value={formData.phoneNumber}
                onChangeText={(text: string) => setFormData({ ...formData, phoneNumber: text })}
                keyboardType="phone-pad"
            />
            <View style={{ alignItems: 'flex-end', marginTop: 20 }}>
                <NavigationButton onPress={next} icon="→" />
            </View>
        </View>
    );
};

const Page2 = ({ next, back, formData, setFormData }: any) => (
    <View>
        <ThemedText style={styles.sectionTitle}>Business Details</ThemedText>
        <InputField
            label="Short Description (max 50 chars)"
            placeholder="A few words about your store"
            value={formData.shortDescription}
            onChangeText={(text: string) => setFormData({ ...formData, shortDescription: text })}
            maxLength={50}
        />
        <InputField
            label="Detailed Description"
            placeholder="Describe what your store sells..."
            value={formData.detailedDescription}
            onChangeText={(text: string) => setFormData({ ...formData, detailedDescription: text })}
            multiline
        />
        <InputField
            label="Business Registration Number (optional)"
            placeholder="Enter business registration number"
            value={formData.businessRegNumber}
            onChangeText={(text: string) => setFormData({ ...formData, businessRegNumber: text })}
        />
        <InputField
            label="Store Category"
            placeholder="e.g., Grocery, Electronics, Fashion, etc."
            value={formData.category} // Changed from cuisineType
            onChangeText={(text: string) => setFormData({ ...formData, category: text })} // Changed from cuisineType
        />
        <View style={styles.arrowContainer}>
            <NavigationButton onPress={back} icon="←" />
            <NavigationButton onPress={next} icon="→" />
        </View>
    </View>
);

const Page3 = ({ next, back, formData, setFormData }: any) => {
    const [location, setLocation] = useState<any>(null);
    const [tries, setTries] = useState(3);
    const buttonBg = useThemeColor({ light: '#1f2050', dark: '#4a4b8a' }, 'tint');

    const getLocation = async () => {
        if (tries > 0) {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Permission to access location was denied');
                return;
            }
            let { coords } = await Location.getCurrentPositionAsync({});
            setLocation(coords);
            setFormData({ ...formData, latitude: coords.latitude, longitude: coords.longitude });
            setTries(tries - 1);
        } else {
            Alert.alert('Error', 'You have exceeded the maximum number of attempts.');
        }
    };

    const pickImage = async (field: string) => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setFormData({ ...formData, [field]: result.assets[0].uri });
        }
    };

    return (
        <View>
            <ThemedText style={styles.sectionTitle}>Location and Images</ThemedText>
            <ThemedText style={{ color: 'red', marginBottom: 10 }}>
                You must be at the exact position of your store to get the location. You have {tries} tries remaining.
            </ThemedText>
            <TouchableOpacity style={[styles.button, { backgroundColor: buttonBg }]} onPress={getLocation}>
                <ThemedText style={styles.buttonText}>Get Position</ThemedText>
            </TouchableOpacity>
            {location && (
                <MapView
                    style={styles.map}
                    initialRegion={{
                        latitude: location.latitude,
                        longitude: location.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }}
                >
                    <Marker coordinate={location} />
                </MapView>
            )}

            <UploadSection label="Store Logo (optional)" onPress={() => pickImage('logo')} imageUri={formData.logo} />
            <UploadSection label="Store Picture" onPress={() => pickImage('storePicture')} imageUri={formData.storePicture} />

            <View style={styles.arrowContainer}>
                <NavigationButton onPress={back} icon="←" />
                <NavigationButton onPress={next} icon="→" />
            </View>
        </View>
    );
};

const Page4 = ({ back, submit, formData, setFormData, isLoading }: any) => {
    const buttonBg = useThemeColor({ light: '#1f2050', dark: '#4a4b8a' }, 'tint');

    const pickImage = async (field: string) => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setFormData({ ...formData, [field]: result.assets[0].uri });
        }
    };

    return (
        <View>
            <ThemedText style={styles.sectionTitle}>Document Verification</ThemedText>
            <UploadSection label="Business license/permit" onPress={() => pickImage('businessLicense')} imageUri={formData.businessLicense} />
            <UploadSection label="Identification of owner/manager" onPress={() => pickImage('ownerId')} imageUri={formData.ownerId} />

            <View style={styles.arrowContainer}>
                <NavigationButton onPress={back} icon="←" />
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: buttonBg, flex: 1, marginLeft: 10, opacity: isLoading ? 0.7 : 1 }]}
                    onPress={submit}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <ThemedText style={styles.buttonText}>Complete Registration</ThemedText>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const UploadSection = ({ label, onPress, imageUri }: any) => {
    const uploadBg = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'background');
    const textColor = useThemeColor({ light: '#333', dark: '#fff' }, 'text');

    return (
        <View style={{ marginBottom: 20 }}>
            <ThemedText style={styles.label}>{label}</ThemedText>
            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: uploadBg }]} onPress={onPress}>
                <ThemedText style={{ color: textColor }}>Upload Document</ThemedText>
            </TouchableOpacity>
            {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImage} />}
        </View>
    );
};

const NavigationButton = ({ onPress, icon }: any) => {
    const bg = useThemeColor({ light: '#1f2050', dark: '#4a4b8a' }, 'tint');
    return (
        <TouchableOpacity style={[styles.arrowButton, { backgroundColor: bg }]} onPress={onPress}>
            <ThemedText style={styles.arrowButtonText}>{icon}</ThemedText>
        </TouchableOpacity>
    );
};

const JoinStoreScreen = () => {
    const { user } = useAuth();
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    React.useEffect(() => {
        const checkExisting = async () => {
            if (user) {
                const { data } = await supabase
                    .from('stores')
                    .select('id, status')
                    .eq('owner_id', user.id)
                    .single();
                if (data) {
                    router.replace('/store/dashboard');
                }
            }
        };
        checkExisting();
    }, [user]);
    const [formData, setFormData] = useState({
        storeName: '', // Changed from restaurantName
        ownerName: user ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}` : '',
        address: '',
        phoneNumber: '',
        shortDescription: '',
        detailedDescription: '',
        businessRegNumber: '',
        category: '', // Changed from cuisineType
        latitude: null,
        longitude: null,
        logo: null,
        storePicture: null, // Changed from restaurantPicture
        businessLicense: null,
        ownerId: null,
    });

    const uploadFile = async (uri: string, fileName: string) => {
        // For React Native, we need to convert the file to ArrayBuffer
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();

        // Upload the ArrayBuffer to Supabase
        // Note: Using 'restaurant-documents' bucket for now as shared storage for business docs
        const { data, error } = await supabase.storage
            .from('restaurant-documents')
            .upload(fileName, arrayBuffer, {
                contentType: 'image/jpeg', // or detect based on file extension
            });

        if (error) {
            throw error;
        }

        const { data: publicUrlData } = supabase.storage
            .from('restaurant-documents')
            .getPublicUrl(data.path);
        return publicUrlData.publicUrl;
    };

    const handleRegister = async () => {
        if (!user) {
            Alert.alert('Error', 'You must be logged in to register a store.');
            return;
        }

        setIsLoading(true);
        try {
            let logoUrl = null;
            if (formData.logo) {
                logoUrl = await uploadFile(formData.logo, `store-logo-${user.id}-${Date.now()}`);
            }

            let storePictureUrl = null;
            if (formData.storePicture) {
                storePictureUrl = await uploadFile(formData.storePicture, `store-picture-${user.id}-${Date.now()}`);
            }

            let businessLicenseUrl = null;
            if (formData.businessLicense) {
                businessLicenseUrl = await uploadFile(formData.businessLicense, `store-license-${user.id}-${Date.now()}`);
            }

            let ownerIdUrl = null;
            if (formData.ownerId) {
                ownerIdUrl = await uploadFile(formData.ownerId, `store-owner-id-${user.id}-${Date.now()}`);
            }

            const { data, error } = await supabase
                .from('stores') // Changed from restaurants
                .insert([
                    {
                        owner_id: user.id,
                        name: formData.storeName,
                        address: formData.address,
                        phone_number: formData.phoneNumber,
                        short_description: formData.shortDescription,
                        detailed_description: formData.detailedDescription,
                        category: formData.category, // Changed from cuisine_type
                        business_registration_number: formData.businessRegNumber,
                        latitude: formData.latitude,
                        longitude: formData.longitude,
                        location: `POINT(${formData.longitude} ${formData.latitude})`,
                        logo_url: logoUrl,
                        cover_photo_url: storePictureUrl, // Changed from restaurant_picture_url
                        business_license_url: businessLicenseUrl,
                        owner_identification_url: ownerIdUrl,
                    },
                ]);

            if (error) {
                throw error;
            }

            Alert.alert('Application Submitted', 'Your store application is under review. We will notify you once approved.', [
                {
                    text: 'OK',
                    onPress: () => {
                        router.replace('/store/dashboard'); // Redirect to store dashboard
                    },
                },
            ]);
        } catch (error: any) {
            setIsLoading(false);
            Alert.alert('Error', error.message);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <ThemedText type="title" style={styles.title}>Register a Store</ThemedText>
                    <StepIndicator currentStep={page} totalSteps={4} />

                    <View style={styles.card}>
                        {page === 1 && <Page1 next={() => setPage(2)} formData={formData} setFormData={setFormData} />}
                        {page === 2 && <Page2 next={() => setPage(3)} back={() => setPage(1)} formData={formData} setFormData={setFormData} />}
                        {page === 3 && <Page3 next={() => setPage(4)} back={() => setPage(2)} formData={formData} setFormData={setFormData} />}
                        {page === 4 && <Page4 back={() => setPage(3)} submit={handleRegister} formData={formData} setFormData={setFormData} isLoading={isLoading} />}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContainer: {
        padding: 20,
        paddingBottom: 100,
    },
    title: {
        textAlign: 'center',
        marginBottom: 20,
        fontSize: 28,
    },
    card: {
        borderRadius: 15,
        padding: 10,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        marginTop: 10,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        opacity: 0.8,
    },
    input: {
        padding: 15,
        borderRadius: 10,
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(150,150,150,0.2)',
    },
    button: {
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    arrowContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 30,
        alignItems: 'center',
    },
    arrowButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    arrowButtonText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4, // Visual center correction
    },
    smallButton: {
        padding: 12,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 20,
    },
    smallButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    uploadButton: {
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: 'rgba(150,150,150,0.5)',
    },
    previewImage: {
        width: '100%',
        height: 200,
        borderRadius: 10,
        marginBottom: 20,
        resizeMode: 'cover',
    },
    map: {
        height: 200,
        borderRadius: 10,
        marginBottom: 20,
    },
    stepIndicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    stepDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    stepLine: {
        width: 40,
        height: 2,
        marginHorizontal: 5,
    },
});

export default JoinStoreScreen;
